import { Request, Response } from 'express';
import { ResponseHandler } from "../helpers/ResponseHandler";
import { Role } from '../entity/Role';
import { Repository } from "typeorm";
import { StatusCodes } from 'http-status-codes';
import { validate } from 'class-validator'

export class RoleController {

    public static readonly ERROR_NO_ID_PROVIDED = "No ID provided";
    public static readonly ERROR_INVALID_ID_FORMAT = "Invalid ID format";
    public static readonly ERROR_ROLE_NOT_FOUND = "Role not found";
    public static readonly ERROR_ROLE_NOT_FOUND_WITH_ID = (id: number) => `Role not found with ID: ${id}`;
    public static readonly ERROR_NAME_IS_BLANK = "Name is blank";
    public static readonly ERROR_FAILED_TO_RETRIEVE_ROLES = "Failed to retrieve roles";
    public static readonly ERROR_FAILED_TO_RETRIEVE_ROLE = "Failed to retrieve role";
    public static readonly ERROR_ROLE_NOT_FOUND_FOR_DELETION = "Role with the provided ID not found"


    constructor(private roleRepository: Repository<Role>) { }

    public getAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const roles = await this.roleRepository.find();
            if (roles.length === 0) {
                ResponseHandler.sendErrorResponse(res, StatusCodes.NO_CONTENT);
                return;
            }
            ResponseHandler.sendSuccessResponse(res, roles);
        } catch (error) {
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                RoleController.ERROR_FAILED_TO_RETRIEVE_ROLES);
        }
    };

    public getById = async (req: Request, res: Response): Promise<void> => {
        const id = parseInt(req.params.id as string);
        if (isNaN(id)) {
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.BAD_REQUEST,
                RoleController.ERROR_INVALID_ID_FORMAT);
            return;
        }

        try {
            const role = await this.roleRepository.findOne({ where: { id: id } });
            if (!role) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND,
                    RoleController.ERROR_ROLE_NOT_FOUND_WITH_ID(id));
                return;
            }
            ResponseHandler.sendSuccessResponse(res, role);
        } catch (error) {
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                RoleController.ERROR_FAILED_TO_RETRIEVE_ROLE);
        }
    };

    public create = async (req: Request, res: Response): Promise<void> => {
        try {
            const role = new Role();
            role.name = req.body.name;
            const errors = await validate(role);
            if (errors.length > 0) {
                throw new Error(errors.map(err => Object.values(err.constraints || {})).join(", "));
            }
            const newRole = await this.roleRepository.save(role);
            ResponseHandler.sendSuccessResponse(res, newRole, StatusCodes.CREATED);
        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message);
        }
    };

    public delete = async (req: Request, res: Response): Promise<void> => {
        const id = req.params.id;
        try {
            if (!id) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    RoleController.ERROR_NO_ID_PROVIDED);
                return;
            }
            const result = await this.roleRepository.delete(id);
            if (result.affected === 0) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND,
                    RoleController.ERROR_ROLE_NOT_FOUND_FOR_DELETION);
                return;
            }
            ResponseHandler.sendSuccessResponse(res, "Role deleted");
        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, error.message);
        }
    };

    public update = async (req: Request, res: Response): Promise<void> => {
        const id = parseInt(req.params.id as string);
        const name = req.body.name;
        if (isNaN(id)) {
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.BAD_REQUEST,
                RoleController.ERROR_NO_ID_PROVIDED);
            return;
        }
        try {
            if (!id) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND,
                    RoleController.ERROR_NO_ID_PROVIDED);
                return;
            }
            const role = await this.roleRepository.findOneBy({ id });
            if (!role) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND,
                    RoleController.ERROR_ROLE_NOT_FOUND);
                return;
            }
            if (name !== undefined) role.name = name;
            const errors = await validate(role);
            if (errors.length > 0) {
                throw new Error(errors.map(err => Object.values(err.constraints || {})).join(", "));
            }
            const updatedRole = await this.roleRepository.save(role);
            ResponseHandler.sendSuccessResponse(res, updatedRole);
        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message);
        }
    };

}