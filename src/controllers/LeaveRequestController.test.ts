import { UserManagement } from '../entity/UserManagement';
import { LeaveRequestController } from './LeaveRequestController';
import { LeaveRequest, LeaveStatus } from '../entity/LeaveRequest';
import { User } from '../entity/User';
import { Role } from '../entity/Role';
import { Repository } from 'typeorm';
import { StatusCodes } from 'http-status-codes';
import { ResponseHandler } from '../helpers/ResponseHandler';
import { Request, Response } from 'express';
import * as classValidator from "class-validator";
import { mock } from "jest-mock-extended";
import { IAuthenticatedJWTRequest } from '../types/IAuthenticatedJWTRequest';
import { Validation } from '../helpers/Validation';

jest.mock('../helpers/ResponseHandler');

jest.mock('class-validator', () => ({
    ...jest.requireActual('class-validator'),
    validate: jest.fn(),
}));

describe('LeaveRequestController', () => {
    function getValidManagerData(): User {
        let role = new Role();
        role.id = 1;
        role.name = 'manager';

        let user = new User();
        user.id = 1;
        user.password = 'a'.repeat(10);
        user.email = 'manager@email.com';
        user.leaveBalance = 25;
        user.role = role;
        return user;
    }

    function getValidStaffData(): User {
        let role = new Role();
        role.id = 2;
        role.name = 'staff';

        let user = new User();
        user.id = 2;
        user.password = 'b'.repeat(10);
        user.email = 'staff@email.com';
        user.leaveBalance = 25;
        user.role = role;
        return user;
    }

    function getValidAdminData(): User {
        let role = new Role();
        role.id = 3;
        role.name = 'admin';

        let user = new User();
        user.id = 3;
        user.password = 'c'.repeat(10);
        user.email = 'admin@email.com';
        user.leaveBalance = 25;
        user.role = role;
        return user;
    }

    function getValidManagementRecord(): UserManagement {
        let managementRecord = new UserManagement();
        managementRecord.id = 1;
        managementRecord.manager = getValidManagerData()
        managementRecord.user = getValidStaffData()
        managementRecord.startDate = new Date(2025, 1, 1)
        return managementRecord;
    }

    function getValidLeaveRequest(): LeaveRequest {
        let leaveRequest = new LeaveRequest();
        leaveRequest.leaveRequestId = 1;
        leaveRequest.user = getValidStaffData();
        leaveRequest.reason = "";
        leaveRequest.leaveType = "Annual"
        leaveRequest.status = LeaveStatus.Pending;
        leaveRequest.startDate = new Date(2026, 5, 1);
        leaveRequest.endDate = new Date(2026, 5, 10);
        return leaveRequest;
    }

    const mockRequest = (params = {}, body = {}): Partial<IAuthenticatedJWTRequest> => ({
        params,
        body,
    });

    const mockResponse = (): Partial<Response> => ({});

    let leaveRequestController: LeaveRequestController;
    let mockLeaveRequestRepository: jest.Mocked<Repository<LeaveRequest>>;
    let mockUserManagementRepository: jest.Mocked<Repository<UserManagement>>;
    let mockUserRepository: jest.Mocked<Repository<User>>;

    beforeEach(() => {
        mockLeaveRequestRepository = mock<Repository<LeaveRequest>>();
        mockUserManagementRepository = mock<Repository<UserManagement>>();
        mockUserRepository = mock<Repository<User>>();

        leaveRequestController = new LeaveRequestController(mockLeaveRequestRepository as Repository<LeaveRequest>,
            mockUserManagementRepository as Repository<UserManagement>,
            mockUserRepository as Repository<User>
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Request Leave will return a valid Leave Request and return CREATED status when supplied with valid details', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = mockRequest({}, {
            startDate: validLeaveRequest.startDate,
            endDate: validLeaveRequest.endDate
        });
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }

        const res = mockResponse();

        mockUserRepository.findOne.mockResolvedValue(validUser);

        const overlapping: any = {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null)
        };

        mockLeaveRequestRepository.createQueryBuilder.mockReturnValue(overlapping);

        mockLeaveRequestRepository.save.mockResolvedValue(validLeaveRequest);

        jest.spyOn(classValidator, 'validate').mockResolvedValue([]);

        await leaveRequestController.requestLeave(req as Request, res as Response);

        expect(mockLeaveRequestRepository.save).toHaveBeenCalledWith(expect.objectContaining({
            user: validUser,
            startDate: validLeaveRequest.startDate,
            endDate: validLeaveRequest.endDate,
        }));

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: "Leave request has been submitted for review",
                data: {
                    id: validLeaveRequest.leaveRequestId,
                    employee_id: validLeaveRequest.user.id,
                    start_date: validLeaveRequest.startDate,
                    end_date: validLeaveRequest.endDate,
                    status: validLeaveRequest.status
                }
            },
            StatusCodes.CREATED);
    });

    it('Leave request returns a BAD_REQUEST if no start date is provided', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();
        const req = mockRequest({}, {
            endDate: validLeaveRequest.endDate
        });
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = mockResponse();

        await leaveRequestController.requestLeave(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_DATE_FORMAT);
    });

    it('Leave request returns a BAD_REQUEST if no end date is provided', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();
        const req = mockRequest({}, {
            startDate: validLeaveRequest.startDate,
        });
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = mockResponse();

        await leaveRequestController.requestLeave(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_DATE_FORMAT);
    });

    it('Leave request returns a BAD_REQUEST if invalid start date format is provided', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();
        const req = mockRequest({}, {
            startDate: new Date("InvalidFormat"),
            endDate: validLeaveRequest.endDate
        });
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = mockResponse();

        await leaveRequestController.requestLeave(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_DATE_FORMAT);
    });

    it('Leave request returns a BAD_REQUEST if invalid end date format is provided', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();
        const req = mockRequest({}, {
            startDate: validLeaveRequest.startDate,
            endDate: new Date("Invalid Format")
        });
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = mockResponse();

        await leaveRequestController.requestLeave(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_DATE_FORMAT);
    });

    it('Leave request returns a BAD_REQUEST if invalid user ID is provided', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();
        const req = mockRequest({}, {
            startDate: validLeaveRequest.startDate,
            endDate: validLeaveRequest.endDate
        });
        req.signedInUser = { email: validUser.email, role: validUser.role }
        const res = mockResponse();

        await leaveRequestController.requestLeave(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_ID_FORMAT);
    });

    it('Leave request returns a BAD_REQUEST if user does not exist', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();
        const req = {
            body: {
                startDate: validLeaveRequest.startDate,
                endDate: validLeaveRequest.endDate
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        mockUserRepository.findOne.mockResolvedValue(null);

        await leaveRequestController.requestLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
            res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_USER_NOT_FOUND
        );
    });

    it('Leave request returns a BAD_REQUEST if user has insufficeient leave balance', async () => {
        const validUser = getValidStaffData();
        validUser.leaveBalance = 0;
        const validLeaveRequest = getValidLeaveRequest();
        const req = {
            body: {
                startDate: validLeaveRequest.startDate,
                endDate: validLeaveRequest.endDate
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        mockUserRepository.findOne.mockResolvedValue(validUser);

        await leaveRequestController.requestLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
            res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INSUFFICIENT_BALANCE
        );
    });

    

});
