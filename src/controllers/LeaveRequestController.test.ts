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

    it('Leave request approve returns FORBIDDEN if manager is not mangager of leave request user', async () => {
        const validManager = getValidManagerData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);
        mockUserManagementRepository.findOne.mockResolvedValue(null);

        await leaveRequestController.approveLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.FORBIDDEN,
            LeaveRequestController.ERROR_NOT_ALLOWED);
    });

    it('Leave request successfully cancelled when request owner performs the action', async () => {
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validLeaveRequest.user.id, email: validLeaveRequest.user.email, role: validLeaveRequest.user.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);
        mockUserRepository.save.mockResolvedValue(validLeaveRequest.user);
        mockLeaveRequestRepository.save.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.cancelLeave(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, {
            message: "Leave request cancelled successfully",
            reason: validLeaveRequest.reason,
            data: {
                id: validLeaveRequest.leaveRequestId,
                employee_id: validLeaveRequest.user.id,
                start_date: validLeaveRequest.startDate,
                end_date: validLeaveRequest.endDate,
                status: validLeaveRequest.status
            }
        },
            StatusCodes.OK)
    });

    it('Leave request successfully cancelled when an admin performs the action', async () => {
        const validUser = getValidAdminData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);
        mockUserRepository.save.mockResolvedValue(validLeaveRequest.user);
        mockLeaveRequestRepository.save.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.cancelLeave(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, {
            message: "Leave request cancelled successfully",
            reason: validLeaveRequest.reason,
            data: {
                id: validLeaveRequest.leaveRequestId,
                employee_id: validLeaveRequest.user.id,
                start_date: validLeaveRequest.startDate,
                end_date: validLeaveRequest.endDate,
                status: validLeaveRequest.status
            }
        },
            StatusCodes.OK)
    });

    it('Leave request cancel returns a BAD_REQUEST if invalid leave request ID format is entered', async () => {
        const validUser = getValidStaffData();

        const req = {
            body: {
                leaveRequestId: "InvalidFormat",
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        await leaveRequestController.cancelLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_ID_FORMAT);
    });

    it('Leave request cancel returns FORBIDDEN if user is not owner of leave request user', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();
        validLeaveRequest.user.id += 1;

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.cancelLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.FORBIDDEN,
            LeaveRequestController.ERROR_NOT_ALLOWED);
    });

    it('Leave request cancel returns a BAD_REQUEST if leave request is already cancelled', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();
        validLeaveRequest.status = LeaveStatus.Cancelled;

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.cancelLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_LEAVE_REQUEST_ALREADY_CANCELLED);
    });

    it('Leave request cancel returns a BAD_REQUEST if leave request is rejected', async () => {
        const validUser = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();
        validLeaveRequest.status = LeaveStatus.Rejected;

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.cancelLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_CANNOT_CANCEL_REJECTED);
    });

    it('Leave request successfully approved when valid manager performs the action', async () => {
        const validManager = getValidManagerData();
        const validMangement = getValidManagementRecord();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);
        mockUserManagementRepository.findOne.mockResolvedValue(validMangement);
        mockUserRepository.save.mockResolvedValue(validLeaveRequest.user);
        mockLeaveRequestRepository.save.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.approveLeave(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Leave request ${validLeaveRequest.leaveRequestId} for employee_id ${validLeaveRequest.user.id} has been approved`,
                data: {
                    reason: validLeaveRequest.reason
                }
            },
            StatusCodes.OK);
    });

    it('Leave request successfully approved when an admin performs the action', async () => {
        const validUser = getValidAdminData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);
        mockUserRepository.save.mockResolvedValue(validLeaveRequest.user);
        mockLeaveRequestRepository.save.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.approveLeave(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Leave request ${validLeaveRequest.leaveRequestId} for employee_id ${validLeaveRequest.user.id} has been approved`,
                data: {
                    reason: validLeaveRequest.reason
                }
            },
            StatusCodes.OK);
    });

    it('Leave request approve returns FORBIDDEN if manager is not mangager of leave request user', async () => {
        const validManager = getValidManagerData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);
        mockUserManagementRepository.findOne.mockResolvedValue(null);

        await leaveRequestController.approveLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.FORBIDDEN,
            LeaveRequestController.ERROR_NOT_ALLOWED);
    });

    it('Leave request approve returns a BAD_REQUEST if invalid leave request ID format is entered', async () => {
        const validManager = getValidManagerData();

        const req = {
            body: {
                leaveRequestId: "InvalidFormat",
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        await leaveRequestController.approveLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_ID_FORMAT);
    });

    it('Leave request approve returns NOT_FOUND if leave request isnt found', async () => {
        const validManager = getValidManagerData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(null);

        await leaveRequestController.cancelLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.NOT_FOUND,
            LeaveRequestController.ERROR_LEAVE_REQUEST_NOT_FOUND);
    });

    it('Leave request approve returns a BAD_REQUEST if request is already approved', async () => {
        const validManager = getValidAdminData();
        const validLeaveRequest = getValidLeaveRequest();
        validLeaveRequest.status = LeaveStatus.Approved;

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.approveLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_ONLY_PENDING_APPROVED);
    });

    it('Leave request successfully rejected when valid manager performs the action', async () => {
        const validManager = getValidManagerData();
        const validMangement = getValidManagementRecord();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);
        mockUserManagementRepository.findOne.mockResolvedValue(validMangement);
        mockUserRepository.save.mockResolvedValue(validLeaveRequest.user);
        mockLeaveRequestRepository.save.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.rejectLeave(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Leave request ${validLeaveRequest.leaveRequestId} for employee_id ${validLeaveRequest.user.id} has been Rejected`,
                data: {
                    reason: validLeaveRequest.reason
                }
            },
            StatusCodes.OK);
    });

    it('Leave request successfully rejected when an admin performs the action', async () => {
        const validUser = getValidAdminData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);
        mockUserRepository.save.mockResolvedValue(validLeaveRequest.user);
        mockLeaveRequestRepository.save.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.rejectLeave(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Leave request ${validLeaveRequest.leaveRequestId} for employee_id ${validLeaveRequest.user.id} has been Rejected`,
                data: {
                    reason: validLeaveRequest.reason
                }
            },
            StatusCodes.OK);
    });

    it('Leave request reject returns a BAD_REQUEST if manager is not mangager of leave request user', async () => {
        const validManager = getValidManagerData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);
        mockUserManagementRepository.findOne.mockResolvedValue(null);

        await leaveRequestController.rejectLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.FORBIDDEN,
            LeaveRequestController.ERROR_NOT_ALLOWED);
    });

    it('Leave request reject returns a BAD_REQUEST if invalid leave request ID format is entered', async () => {
        const validManager = getValidManagerData();

        const req = {
            body: {
                leaveRequestId: "InvalidFormat",
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        await leaveRequestController.rejectLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_ID_FORMAT);
    });

    it('Leave request reject returns NOT_FOUND if leave request isnt found', async () => {
        const validManager = getValidManagerData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(null);

        await leaveRequestController.rejectLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.NOT_FOUND,
            LeaveRequestController.ERROR_LEAVE_REQUEST_NOT_FOUND);
    });

    it('Leave request reject returns a BAD_REQUEST if request is already rejected', async () => {
        const validManager = getValidAdminData();
        const validLeaveRequest = getValidLeaveRequest();
        validLeaveRequest.status = LeaveStatus.Rejected;

        const req = {
            body: {
                leaveRequestId: validLeaveRequest.leaveRequestId,
                reason: "ValidString"
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockLeaveRequestRepository.findOne.mockResolvedValue(validLeaveRequest);

        await leaveRequestController.rejectLeave(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_ONLY_PENDING_REJECTED);
    });

    it('Get Leave status successfully returns employee leave status (as Admin)', async () => {
        const validAdmin = getValidAdminData();
        const validStaff = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            params: {
                employee_id: validStaff.id,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validAdmin.id, email: validAdmin.email, role: validAdmin.role }
        const res = {} as unknown as Response;


        mockUserRepository.findOne.mockResolvedValue(validStaff);
        mockLeaveRequestRepository.find.mockResolvedValue([validLeaveRequest]);

        await leaveRequestController.leaveStatus(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Status of leave requests for employee_id ${validStaff.id}`,
                data: [
                    {
                        id: validLeaveRequest.leaveRequestId,
                        start_date: validLeaveRequest.startDate.toISOString().split("T")[0],
                        end_date: validLeaveRequest.endDate.toISOString().split("T")[0],
                        status: validLeaveRequest.status,
                        reason: validLeaveRequest.reason
                    }
                ]
            },
            StatusCodes.OK);
    });

    it('Get Leave status successfully returns employee leave status (as Manager)', async () => {
        const validManager = getValidManagerData();
        const validManagement = getValidManagementRecord();
        const validStaff = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            params: {
                employee_id: validStaff.id,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;


        mockUserRepository.findOne.mockResolvedValue(validStaff);
        mockUserManagementRepository.findOne.mockResolvedValue(validManagement);
        mockLeaveRequestRepository.find.mockResolvedValue([validLeaveRequest]);

        await leaveRequestController.leaveStatus(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Status of leave requests for employee_id ${validStaff.id}`,
                data: [
                    {
                        id: validLeaveRequest.leaveRequestId,
                        start_date: validLeaveRequest.startDate.toISOString().split("T")[0],
                        end_date: validLeaveRequest.endDate.toISOString().split("T")[0],
                        status: validLeaveRequest.status,
                        reason: validLeaveRequest.reason
                    }
                ]
            },
            StatusCodes.OK);
    });

    it('Get Leave status successfully returns leave status (as Staff)', async () => {
        const validStaff = getValidStaffData();
        const validLeaveRequest = getValidLeaveRequest();

        const req = {
            params: {
                employee_id: validStaff.id,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validStaff.id, email: validStaff.email, role: validStaff.role }
        const res = {} as unknown as Response;


        mockUserRepository.findOne.mockResolvedValue(validStaff);
        mockUserManagementRepository.findOne.mockResolvedValue(null);
        mockLeaveRequestRepository.find.mockResolvedValue([validLeaveRequest]);

        await leaveRequestController.leaveStatus(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Status of leave requests for employee_id ${validStaff.id}`,
                data: [
                    {
                        id: validLeaveRequest.leaveRequestId,
                        start_date: validLeaveRequest.startDate.toISOString().split("T")[0],
                        end_date: validLeaveRequest.endDate.toISOString().split("T")[0],
                        status: validLeaveRequest.status,
                        reason: validLeaveRequest.reason
                    }
                ]
            },
            StatusCodes.OK);
    });

    it('Get Leave status returns BAD_REQUEST if invalid employee ID is provided', async () => {
        const validStaff = getValidStaffData();

        const req = {
            params: {
                employee_id: "InvalidFormat",
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validStaff.id, email: validStaff.email, role: validStaff.role }
        const res = {} as unknown as Response;

        await leaveRequestController.leaveStatus(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_ID_FORMAT);
    });

    it('Get Leave status returns NOT_FOUND if employee is not found from employee ID', async () => {
        const validStaff = getValidStaffData();

        const req = {
            params: {
                employee_id: validStaff.id + 1,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validStaff.id, email: validStaff.email, role: validStaff.role }
        const res = {} as unknown as Response;

        await leaveRequestController.leaveStatus(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.NOT_FOUND,
            LeaveRequestController.ERROR_EMPLOYEE_NOT_FOUND);
    });

    it('Get Leave status returns FORBIDDEN if user does not have access to employee records', async () => {
        const validManager = getValidManagerData();
        const validStaff = getValidStaffData();

        const req = {
            params: {
                employee_id: validStaff.id,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockUserRepository.findOne.mockResolvedValue(validStaff);

        await leaveRequestController.leaveStatus(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.FORBIDDEN,
            LeaveRequestController.ERROR_NOT_ALLOWED);
    });

    it('Get remaining days successfully returns employee remaining days (as Admin)', async () => {
        const validAdmin = getValidAdminData();
        const validStaff = getValidStaffData();

        const req = {
            params: {
                employee_id: validStaff.id,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validAdmin.id, email: validAdmin.email, role: validAdmin.role }
        const res = {} as unknown as Response;

        mockUserRepository.findOne.mockResolvedValue(validStaff);
        mockUserManagementRepository.findOne.mockResolvedValue(null);

        await leaveRequestController.remainingDays(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Status of leave requests for employee_id ${validStaff.id}`,
                data: { "days remaining": validStaff.leaveBalance }
            },
            StatusCodes.OK
        );
    });

    it('Get remaining days successfully returns employee remaining days (as Manager)', async () => {
        const validManager = getValidManagerData();
        const validManagement = getValidManagementRecord();
        const validStaff = getValidStaffData();

        const req = {
            params: {
                employee_id: validStaff.id,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockUserRepository.findOne.mockResolvedValue(validStaff);
        mockUserManagementRepository.findOne.mockResolvedValue(validManagement);

        await leaveRequestController.remainingDays(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Status of leave requests for employee_id ${validStaff.id}`,
                data: { "days remaining": validStaff.leaveBalance }
            },
            StatusCodes.OK
        );
    });

    it('Get remaining days successfully returns employee remaining days (as Staff)', async () => {
        const validStaff = getValidStaffData();

        const req = {
            params: {
                employee_id: validStaff.id,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validStaff.id, email: validStaff.email, role: validStaff.role }
        const res = {} as unknown as Response;

        mockUserRepository.findOne.mockResolvedValue(validStaff);

        await leaveRequestController.remainingDays(req, res);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            {
                message: `Status of leave requests for employee_id ${validStaff.id}`,
                data: { "days remaining": validStaff.leaveBalance }
            },
            StatusCodes.OK
        );
    });

    it('Get remaining days returns BAD_REQUEST if invalid employee ID is provided', async () => {
        const validUser = getValidStaffData();

        const req = {
            params: {
                employee_id: "InvalidFormat",
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        await leaveRequestController.remainingDays(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            LeaveRequestController.ERROR_INVALID_ID_FORMAT);
    });

    it('Get remaining days returns NOT_FOUND if employee cannot be found from employee ID', async () => {
        const validUser = getValidStaffData();

        const req = {
            params: {
                employee_id: validUser.id + 1,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validUser.id, email: validUser.email, role: validUser.role }
        const res = {} as unknown as Response;

        mockUserRepository.findOne.mockResolvedValue(null);

        await leaveRequestController.remainingDays(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.NOT_FOUND,
            LeaveRequestController.ERROR_EMPLOYEE_NOT_FOUND);
    });


    it('Get remaining days returns FORBIDDEN if user does not have access to employee', async () => {
        const validManager = getValidManagerData();
        const validStaff = getValidStaffData();

        const req = {
            params: {
                employee_id: validStaff.id,
            }
        } as unknown as IAuthenticatedJWTRequest;
        req.signedInUser = { id: validManager.id, email: validManager.email, role: validManager.role }
        const res = {} as unknown as Response;

        mockUserRepository.findOne.mockResolvedValue(validStaff);

        await leaveRequestController.remainingDays(req, res);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.FORBIDDEN,
            LeaveRequestController.ERROR_NOT_ALLOWED);
    })

});
