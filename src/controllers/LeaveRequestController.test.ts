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

jest.mock('../helpers/ResponseHandler');

jest.mock('class-validator', () => ({
    ...jest.requireActual('class-validator'),
    validate: jest.fn(),
}));

describe('UserController', () => {
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

    function getValidAdminData(): User {
        let role = new Role();
        role.id = 3;
        role.name = 'admin';

        let user = new User();
        user.id = 3;
        user.password = 'c'.repeat(10);
        user.email = 'admin@email.com';
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



});
