import { RoleController } from '../controllers/RoleController';
import { Role } from '../entity/Role';
import { Repository } from 'typeorm';
import { StatusCodes } from 'http-status-codes';
import { ResponseHandler } from '../helpers/ResponseHandler';
import { Request, Response } from 'express';
import { DeleteResult } from 'typeorm'; 
import * as classValidator from "class-validator";
import { mock } from "jest-mock-extended"; 

const VALIDATOR_CONSTRAINT_NAME_IS_REQUIRED = "Name is required";
const VALIDATOR_CONSTRAINT_EMPTY_OR_WHITESPACE = "Name cannot be empty or whitespace";
const VALIDATOR_CONSTRAINT_MAX_LENGTH_EXCEEDED = "Name must be 30 characters or less";

const INVALID_ROLE_ID_NUMBER = 99;
const INVALID_ROLE_ID_TYPE = "abc";
const BLANK_ROLE_NAME = "";

jest.mock('../helpers/ResponseHandler');

jest.mock('class-validator', () => ({
    ...jest.requireActual('class-validator'),
    validate: jest.fn(),
}));

describe('RoleController', () => {
    function getValidManagerData() : Role {
        let role = new Role();
        role.id = 1;
        role.name = 'manager';
        return role;
    }

    const mockRequest = (params = {}, body = {}): Partial<Request> => ({
        params,
        body,
    });

    const mockResponse = (): Partial<Response> => ({});

    let roleController: RoleController;
    let mockRoleRepository: jest.Mocked<Repository<Role>>;

    beforeEach(() => { 
        mockRoleRepository = mock<Repository<Role>>();

        roleController = new RoleController(mockRoleRepository as Repository<Role>);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('getAll returns NO_CONTENT if no roles exist', async () => {
        const req = mockRequest();
        const res = mockResponse();

        mockRoleRepository.find.mockResolvedValue([]); 

        await roleController.getAll(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, StatusCodes.NO_CONTENT);
    });

    it('getAll return all roles', async () => {
        const validManagerDetails = getValidManagerData();
        const req = mockRequest();
        const res = mockResponse();
        mockRoleRepository.find.mockResolvedValue([validManagerDetails]);

        await roleController.getAll(req as Request, res as Response);

        expect(mockRoleRepository.find).toHaveBeenCalled();
        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, 
                                                                            [validManagerDetails]);
    });

    it('getAll returns INTERNAL_SERVER_ERROR if server fails to retrieve roles', async () => {
        const req = mockRequest();
        const res = mockResponse();
 
        mockRoleRepository.find.mockRejectedValue(new Error("Database connection error"));
    
        await roleController.getAll(req as Request, res as Response);
    
        expect(mockRoleRepository.find).toHaveBeenCalled();
        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.INTERNAL_SERVER_ERROR, 
                                                                        RoleController.ERROR_FAILED_TO_RETRIEVE_ROLES);
    });

    it('getById returns an error if an invalid id is supplied', async () => {
        const req = mockRequest({ id: INVALID_ROLE_ID_TYPE });
        const res = mockResponse();

        await roleController.getById(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.BAD_REQUEST, 
                                                                        RoleController.ERROR_INVALID_ID_FORMAT);
    });

    it('getById returns NOT_FOUND if the role id does not exist', async () => {
        const req = mockRequest({ id: INVALID_ROLE_ID_NUMBER });
        const res = mockResponse();

        await roleController.getById(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.NOT_FOUND, 
                                                                        RoleController.ERROR_ROLE_NOT_FOUND_WITH_ID(INVALID_ROLE_ID_NUMBER));
    });
    
    it('getById returns a role if a valid id is supplied', async () => {
        const validManagerDetails = getValidManagerData();
        const req = mockRequest({ id: validManagerDetails.id });
        const res = mockResponse();

        mockRoleRepository.findOne.mockResolvedValue(validManagerDetails);

        await roleController.getById(req as Request, res as Response);

        expect(mockRoleRepository.findOne).toHaveBeenCalledWith({ where: { id: validManagerDetails.id } });
        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, 
                                                                        validManagerDetails);
    });

    it('getById returns INTERNAL_SERVER_ERROR if server fails to retrieve role by id', async () => {
        const validManagerDetails = getValidManagerData();
        const req = mockRequest({ id: validManagerDetails.id });
        const res = mockResponse();
        //Mock a database error
        mockRoleRepository.findOne.mockRejectedValue(new Error("Database connection error"));
    
        await roleController.getById(req as Request, res as Response);
    
        expect(mockRoleRepository.findOne).toHaveBeenCalled();
        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.INTERNAL_SERVER_ERROR, 
                                                                        RoleController.ERROR_FAILED_TO_RETRIEVE_ROLE);
    });

    it('create will return BAD_REQUEST if the role name is missing', async () => {
        const req = mockRequest(); 
        const res = mockResponse();
        
        const EXPECTED_ERROR_MESSAGE = 
            `${VALIDATOR_CONSTRAINT_NAME_IS_REQUIRED},${VALIDATOR_CONSTRAINT_EMPTY_OR_WHITESPACE},${VALIDATOR_CONSTRAINT_MAX_LENGTH_EXCEEDED}`;

        jest.spyOn(classValidator, 'validate').mockResolvedValue([
        {
            property: 'name',
            constraints: {
                isNotEmpty: VALIDATOR_CONSTRAINT_NAME_IS_REQUIRED, 
                Matches: VALIDATOR_CONSTRAINT_EMPTY_OR_WHITESPACE,
                MaxLength: VALIDATOR_CONSTRAINT_MAX_LENGTH_EXCEEDED
            },
        },
    ]);

        await roleController.create(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.BAD_REQUEST, 
                                                                        EXPECTED_ERROR_MESSAGE);
    });


    it('create will return BAD_REQUEST if the role name is not a string', async () => {
        const req = mockRequest(); 
        const res = mockResponse();
   
        jest.spyOn(classValidator, 'validate').mockResolvedValue([
            {
                property: 'name',
                constraints: {
                    Matches: VALIDATOR_CONSTRAINT_EMPTY_OR_WHITESPACE,
                },
            },
        ]);

        await roleController.create(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.BAD_REQUEST, 
                                                                        VALIDATOR_CONSTRAINT_EMPTY_OR_WHITESPACE);

    });
 
    it('create will return BAD_REQUEST if the role name is longer than 30 chars', async () => {
        let nameTooLong = 'a'.repeat(31); 
        const req = mockRequest({}, { name: nameTooLong }); 
        const res = mockResponse();

        jest.spyOn(classValidator, 'validate').mockResolvedValue([
            {
                property: 'name',
                constraints: {
                    Matches: VALIDATOR_CONSTRAINT_MAX_LENGTH_EXCEEDED,
                },
            },
        ]);

        await roleController.create(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.BAD_REQUEST, 
                                                                        VALIDATOR_CONSTRAINT_MAX_LENGTH_EXCEEDED);
    });

    it('create a new role with valid data', async () => {
        const validManagerDetails = getValidManagerData();
        const req = mockRequest({}, { name: validManagerDetails.name });
        const res = mockResponse();

        mockRoleRepository.save.mockResolvedValue(validManagerDetails);
        jest.spyOn(classValidator, 'validate').mockResolvedValue([]);

        await roleController.create(req as Request, res as Response);

        expect(mockRoleRepository.save).toHaveBeenCalledWith(expect.objectContaining({ name: validManagerDetails.name }));
        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, 
                                                                            validManagerDetails, 
                                                                            StatusCodes.CREATED);
    });
    
    it('delete will return NO_ID_PROVIDED if no id is provided', async () => {
        const req = mockRequest(); 
        const res = mockResponse();
    
        await roleController.delete(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.BAD_REQUEST, 
                                                                        RoleController.ERROR_NO_ID_PROVIDED);
    });

    it('delete will return NOT_FOUND if the role id does not exist', async () => {
        const req = mockRequest({ id: INVALID_ROLE_ID_NUMBER });
        const res = mockResponse();
    
        const deleteResult: DeleteResult = { affected: 0 } as DeleteResult; 
        mockRoleRepository.delete.mockResolvedValue(deleteResult); 
    
        await roleController.delete(req as Request, res as Response);
    
        expect(mockRoleRepository.delete).toHaveBeenCalledWith(INVALID_ROLE_ID_NUMBER);
        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.NOT_FOUND, 
                                                                        RoleController.ERROR_ROLE_NOT_FOUND_FOR_DELETION);
    });
    
    it('delete will return SUCCESS if the role is successfully deleted', async () => {
        const validManagerDetails = getValidManagerData();
        const req = mockRequest({ id: validManagerDetails.id }); 
        const res = mockResponse();
    
        const deleteResult: DeleteResult = { affected: 1 } as DeleteResult; 
        mockRoleRepository.delete.mockResolvedValue(deleteResult); 
    
        await roleController.delete(req as Request, res as Response);
    
        expect(mockRoleRepository.delete).toHaveBeenCalledWith(validManagerDetails.id);
        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, "Role deleted");
    });    

    it('update returns a BAD_REQUEST if no id is provided', async () => {
        const validManagerDetails = getValidManagerData();
        const req = mockRequest({}, { name:validManagerDetails.name }); 
        const res = mockResponse();
       
        await roleController.update(req as Request, res as Response);

        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.BAD_REQUEST, 
                                                                        RoleController.ERROR_NO_ID_PROVIDED);
    });

    it('update returns a Not_Found if id provided does not exist', async () => {
        const validManagerDetails = getValidManagerData();
        const req = mockRequest({id: validManagerDetails.id}, { name: validManagerDetails.name}); 
        const res = mockResponse();

        mockRoleRepository.findOneBy.mockResolvedValue(null);

        await roleController.update(req as Request, res as Response);

        expect(mockRoleRepository.findOneBy).toHaveBeenCalledWith({id: validManagerDetails.id});
        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.NOT_FOUND, 
                                                                        RoleController.ERROR_ROLE_NOT_FOUND);
    });

    it('update will return a BAD_REQUEST if the name does not exist/blank', async () => {
        const validManagerDetails = getValidManagerData();
        const req = mockRequest({id: validManagerDetails.id}, { name: BLANK_ROLE_NAME});
        const res = mockResponse();

        mockRoleRepository.findOneBy.mockResolvedValue(validManagerDetails);

        const EXPECTED_ERROR_MESSAGE = 
        `${VALIDATOR_CONSTRAINT_NAME_IS_REQUIRED},${VALIDATOR_CONSTRAINT_EMPTY_OR_WHITESPACE},${VALIDATOR_CONSTRAINT_MAX_LENGTH_EXCEEDED}`;
        jest.spyOn(classValidator, 'validate').mockResolvedValue([
            {
                property: 'name',
                constraints: {
                    isNotEmpty: VALIDATOR_CONSTRAINT_NAME_IS_REQUIRED, 
                    Matches: VALIDATOR_CONSTRAINT_EMPTY_OR_WHITESPACE,
                    MaxLength: VALIDATOR_CONSTRAINT_MAX_LENGTH_EXCEEDED
                },
            },
        ]);

        await roleController.update(req as Request, res as Response);

        expect(mockRoleRepository.findOneBy).toHaveBeenCalledWith({id: validManagerDetails.id});
        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.BAD_REQUEST, 
                                                                        EXPECTED_ERROR_MESSAGE);
    });

    it('update will return NOT_FOUND if the role does not exist', async () => {
        const req = mockRequest({id: INVALID_ROLE_ID_NUMBER}, { name: 'amended name'});
        const res = mockResponse();

        mockRoleRepository.findOneBy.mockResolvedValue(null);

        await roleController.update(req as Request, res as Response);

        expect(mockRoleRepository.findOneBy).toHaveBeenCalledWith( {id: INVALID_ROLE_ID_NUMBER} );
        expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, 
                                                                        StatusCodes.NOT_FOUND, 
                                                                        RoleController.ERROR_ROLE_NOT_FOUND);
    });

    it('update with valid details', async () => {
        const validManagerDetails = getValidManagerData();
        
        const roleDetailsToChange = new Role();
        roleDetailsToChange.id = validManagerDetails.id;
        roleDetailsToChange.name = 'old role'; 
   
        mockRoleRepository.findOneBy.mockResolvedValue(roleDetailsToChange); 
    
        
        const req = mockRequest({ id: validManagerDetails.id },{ name: validManagerDetails.name });
        const res = mockResponse();

        mockRoleRepository.save.mockResolvedValue(validManagerDetails);
        jest.spyOn(classValidator, 'validate').mockResolvedValue([]);
       
        await roleController.update(req as Request, res as Response);
      
        expect(mockRoleRepository.findOneBy).toHaveBeenCalledWith({id: validManagerDetails.id});
        expect(mockRoleRepository.save).toHaveBeenCalledWith( {id: validManagerDetails.id, name: validManagerDetails.name} );
        expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, 
                                                                        validManagerDetails);
    });
});
