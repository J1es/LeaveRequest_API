import { UserManagementController } from './UserManagementController';
import { UserManagement } from '../entity/UserManagement';
import { User } from '../entity/User';
import { Role } from '../entity/Role';
import { Repository } from 'typeorm';
import { StatusCodes } from 'http-status-codes';
import { ResponseHandler } from '../helpers/ResponseHandler';
import { Request, Response } from 'express';
import * as classValidator from "class-validator";
import { mock } from "jest-mock-extended";

const INVALID_RECORD_NUMBER = 99;

jest.mock('../helpers/ResponseHandler');

jest.mock('class-validator', () => ({
    ...jest.requireActual('class-validator'),
    validate: jest.fn(),
}));

describe('UserManagement', () => {
    function getValidManagerData(): User {
        let role = new Role();
        role.id = 1;
        role.name = 'manager';

        let user = new User();
        user.id = 1;
        user.password = 'a'.repeat(10);
        user.email = 'manager@email.com';
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

    const mockRequest = (params = {}, body = {}): Partial<Request> => ({
        params,
        body,
    });

    const mockResponse = (): Partial<Response> => ({});

    let userManagementController: UserManagementController;
    let mockUserManagementRepository: jest.Mocked<Repository<UserManagement>>;

    beforeEach(() => {
        mockUserManagementRepository = mock<Repository<UserManagement>>();

        userManagementController = new UserManagementController(mockUserManagementRepository as Repository<UserManagement>);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('getAll will return all user management records', async () => {
        const mockRecords: UserManagement[] = [getValidManagementRecord()];
        const req = mockRequest();
        const res = mockResponse();

        mockUserManagementRepository.find.mockResolvedValue(mockRecords);

        await userManagementController.getAll(req as Request, res as Response);

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            mockRecords,
            StatusCodes.OK);
    });

    it('Create will return a valid record and return CREATED status when supplied with valid details', async () => {
        const validManagementRecord = getValidManagementRecord();
        const req = mockRequest({}, {
            userId: validManagementRecord.user.id,
            managerId: validManagementRecord.manager.id,
            startDate: validManagementRecord.startDate
        });
        const res = mockResponse();

        mockUserManagementRepository.save.mockResolvedValue(validManagementRecord);

        jest.spyOn(classValidator, 'validate').mockResolvedValue([]);

        await userManagementController.create(req as Request, res as Response);

        expect(mockUserManagementRepository.save).toHaveBeenCalledWith(expect.objectContaining({
            user: { id: validManagementRecord.user.id },
            manager: { id: validManagementRecord.manager.id },
            startDate: validManagementRecord.startDate
        }));

        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res,
            validManagementRecord,
            StatusCodes.CREATED);
    });

    it('End Management returns a BAD_REQUEST if no id is provided', async () => {
        const validManagementRecord = getValidManagementRecord();
        const req = mockRequest({},
            { endDate: new Date(2026,1,1) });
        const res = mockResponse();

        await userManagementController.endManagement(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            UserManagementController.ERROR_INVALID_RECORD_ID_FORMAT);
    });

    it('End Management returns a BAD_REQUEST if no end date is provided', async () => {
        const validManagementRecord = getValidManagementRecord();
        const req = mockRequest({ id: validManagementRecord.id },
            {});
        const res = mockResponse();

        await userManagementController.endManagement(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.BAD_REQUEST,
            UserManagementController.ERROR_END_DATE_REQUIRED);
    });

    it('End Management returns NOT_FOUND if the record id does not exist', async () => {
        const validManagementRecord = getValidManagementRecord();
        validManagementRecord.endDate = new Date(2026,1,1);
        const req = mockRequest({ id: INVALID_RECORD_NUMBER },
            { endDate: validManagementRecord.endDate });
        const res = mockResponse();

        await userManagementController.endManagement(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res,
            StatusCodes.NOT_FOUND,
            UserManagementController.ERROR_RECORD_NOT_FOUND_WITH_ID(INVALID_RECORD_NUMBER));
    });

});
