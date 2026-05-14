import { UserController } from '../controllers/UserController';
import { User } from '../entity/User';
import { Role } from '../entity/Role';
import { Repository } from 'typeorm';
import { StatusCodes } from 'http-status-codes';
import { ResponseHandler } from '../helpers/ResponseHandler';
import { Request, Response } from 'express';
import * as classValidator from "class-validator";
import * as classTransformer from "class-transformer";
import { mock } from "jest-mock-extended"; 

const VALIDATOR_CONSTRAINT_PASSWORD_AT_LEAST_10_CHARS = 'Password must be at least 10 characters long';
const VALIDATOR_CONSTRAINT_PASSWORD_MUST_BE_A_STRING = 'Password must be a string'

jest.mock('../helpers/ResponseHandler');

jest.mock('class-validator', () => ({
    ...jest.requireActual('class-validator'),
    validate: jest.fn(), 
}));

jest.mock("class-transformer", () => ({
    ...jest.requireActual("class-transformer"),
    instanceToPlain: jest.fn(),
}));

describe('UserController', () => {
    function getValidManagerData() : User {
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

    function getValidStaffData() : User {
        let role = new Role();
        role.id = 2;
        role.name = 'staff';

        let user = new User();
        user.id = 1;
        user.password = 'b'.repeat(10);
        user.email = 'staff@email.com';
        user.role = role;
        return user;
    }

    const mockRequest = (params = {}, body = {}): Partial<Request> => ({
        params,
        body,
    });

    const mockResponse = (): Partial<Response> => ({});

    let userController: UserController;
    let mockUserRepository: jest.Mocked<Repository<User>>;

    beforeEach(() => {
        mockUserRepository = mock<Repository<User>>();

        userController = new UserController(mockUserRepository as Repository<User>);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('getAll will return all users', async () => {
        const mockUsers: User[] = [getValidManagerData(), getValidStaffData()];
        const req = mockRequest();
        const res = mockResponse();

        mockUserRepository.find.mockResolvedValue(mockUsers);

        await userController.getAll(req as Request, res as Response);
    
        expect(mockUserRepository.find).toHaveBeenCalledWith({ relations: ['role'] });
        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, mockUsers);
    });

    it('create will return BAD_REQUEST if no user password was provided', async () => {
        const validManagerDetails = getValidManagerData();
        const req = mockRequest({}, { email: validManagerDetails.email, 
                                        roleId: validManagerDetails.role.id }); 
        const res = mockResponse();
    
        const EXPECTED_ERROR_MESSAGE = VALIDATOR_CONSTRAINT_PASSWORD_MUST_BE_A_STRING +
        ',' + VALIDATOR_CONSTRAINT_PASSWORD_AT_LEAST_10_CHARS;
        
        jest.spyOn(classValidator, 'validate').mockResolvedValue([
            {
                property: 'password',
                constraints: {
                    IsString: VALIDATOR_CONSTRAINT_PASSWORD_MUST_BE_A_STRING, 
                    MinLength: VALIDATOR_CONSTRAINT_PASSWORD_AT_LEAST_10_CHARS,
                },
            },
        ]);

        await userController.create(req as Request, res as Response);
        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.BAD_REQUEST, 
                                                                        EXPECTED_ERROR_MESSAGE);
    });

    it('Create will return a valid user and return CREATED status when supplied with valid details', async () => {
        const validManagerDetails= getValidManagerData();

        const req = mockRequest({}, { password: validManagerDetails.password, 
                                        email: validManagerDetails.email, 
                                        roleId: validManagerDetails.role.id });
        const res = mockResponse();

        mockUserRepository.save.mockResolvedValue(validManagerDetails);

        jest.spyOn(classTransformer, "instanceToPlain").mockReturnValue({
            id: validManagerDetails.id,
            email: validManagerDetails.email,
            role: { id: validManagerDetails.role.id, 
                    name: validManagerDetails.role.name },
        } as any);

        jest.spyOn(classValidator, 'validate').mockResolvedValue([]);

        await userController.create(req as Request, res as Response);

        expect(mockUserRepository.save).toHaveBeenCalledWith(expect.objectContaining({ password: validManagerDetails.password, 
                                                                                        email: validManagerDetails.email, 
                                                                                        role: { id: validManagerDetails.role.id } }));
        
                                                                                        
        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, 
                                                                        {   id: validManagerDetails.id, 
                                                                            email: validManagerDetails.email, 
                                                                            role: validManagerDetails.role },
                                                                            StatusCodes.CREATED);
    });

    it('update returns a BAD_REQUEST if no id is provided', async () => {
        const req = mockRequest(); 
        const res = mockResponse();
    
        await userController.update(req as Request, res as Response);
    
        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                    StatusCodes.BAD_REQUEST, 
                                                                    UserController.ERROR_INVALID_USER_ID_FORMAT);
    });


});
