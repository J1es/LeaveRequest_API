import { Request, Response } from 'express';
import { User } from '../entity/User';
import { Repository } from "typeorm";
import { ResponseHandler } from '../helpers/ResponseHandler';
import { StatusCodes } from 'http-status-codes';
import { validate } from "class-validator";
import { instanceToPlain } from 'class-transformer';

export class UserController {
    public static readonly ERROR_NO_USER_ID_PROVIDED = "No ID provided";
    public static readonly ERROR_INVALID_USER_ID_FORMAT = "Invalid ID format";
    public static readonly ERROR_USER_NOT_FOUND = "User not found";
    public static readonly ERROR_USER_NOT_FOUND_WITH_ID = (id: number) => `User not found with ID: ${id}`;
    public static readonly ERROR_PASSWORD_IS_BLANK = "Password is blank";
    public static readonly ERROR_FAILED_TO_RETRIEVE_USERS = "Failed to retrieve users";
    public static readonly ERROR_FAILED_TO_RETRIEVE_USER = "Failed to retrieve user";
    public static readonly ERROR_USER_NOT_FOUND_FOR_DELETION = "User with the provided ID not found";
    public static readonly ERROR_EMAIL_REQUIRED = "Email is required";
    public static readonly ERROR_EMAIL_NOT_FOUND = (email: string) => `${email} not found`;
    public static readonly ERROR_RETRIEVING_USER = (error: string) => `Error retrieving user:${error}`;
    public static readonly ERROR_UNABLE_TO_FIND_USER_EMAIL = (email: string) => `Unable
to find user with the email: ${email}`;
    public static readonly ERROR_VALIDATION_FAILED = "Validation failed";

    constructor(private userRepository: Repository<User>) { }

    public getAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const users = await this.userRepository.find({
                relations: ["role"]
            });
            
            if (users.length === 0) {
                ResponseHandler.sendSuccessResponse(res, StatusCodes.NO_CONTENT);
                return;
            }

            ResponseHandler.sendSuccessResponse(res, users);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                `${UserController.ERROR_FAILED_TO_RETRIEVE_USERS}: ${message}`);
        }
    };

    public getByEmail = async (req: Request, res: Response): Promise<void> => {

        const emailParam = req.params.emailAddress;

        if (typeof emailParam !== 'string' || emailParam.trim().length === 0) {
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.BAD_REQUEST,
                UserController.ERROR_EMAIL_REQUIRED);
            return;
        }

        const email = emailParam.trim().toLowerCase();
        
        try {
            const user = await this.userRepository.findOne({
                where: { email: email },
                relations: ["role"]
            });
            
            if (!user) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND,
                    `${email} not found`);
                return;
            }

            ResponseHandler.sendSuccessResponse(res, user);
        } catch (error) {
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                UserController.ERROR_UNABLE_TO_FIND_USER_EMAIL(email));
        }
    };

    public getById = async (req: Request, res: Response): Promise<void> => {

        const id = parseInt(req.params.id as string);

        if (isNaN(id)) {
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.BAD_REQUEST,
                UserController.ERROR_INVALID_USER_ID_FORMAT);
            return;
        }

        try {
            const user = await this.userRepository.findOne({
                where: { id: id },
                relations: ["role"]
            });

            if (!user) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NO_CONTENT,
                    UserController.ERROR_USER_NOT_FOUND_WITH_ID(id));
                return;
            }

            ResponseHandler.sendSuccessResponse(res, user);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.BAD_REQUEST,
                UserController.ERROR_RETRIEVING_USER(message));
        }
    };

    public create = async (req: Request, res: Response): Promise<void> => {
        try {

            const {firstName, surname, password, email, roleId } = req.body;
            var user = new User();
            user.firstName = firstName;
            user.surname = surname;
            user.password = password;
            user.email = email;
            user.role = { id: roleId } as any;

            const errors = await validate(user);
            if (errors.length > 0) {
                throw new Error(errors.map(err => Object.values(err.constraints || {})).join(", "));
            }

            const newUser = await this.userRepository.save(user);

            ResponseHandler.sendSuccessResponse(res,
                instanceToPlain(newUser),
                StatusCodes.CREATED);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.BAD_REQUEST,
                message);
        }
    };

    public delete = async (req: Request, res: Response): Promise<void> => {

        const id = req.params.id;

        try {
            const result = await this.userRepository.delete(id);
            if (result.affected === 0) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND,
                    UserController.ERROR_USER_NOT_FOUND_FOR_DELETION);
                return;
            }
            
            ResponseHandler.sendSuccessResponse(res, "User deleted", StatusCodes.OK);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.NOT_FOUND,
                message);

        }
    };

    public update = async (req: Request, res: Response): Promise<void> => {
        const id = parseInt(req.params.id as string);
        const { firstName, surname, email, roleId, leaveBalance } = req.body;

        if (isNaN(id)) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, UserController.ERROR_INVALID_USER_ID_FORMAT);
            return;
        }

        try {
            const user = await this.userRepository.findOne({
            where: { id },
            select: ["id", "firstName", "surname", "email", "leaveBalance", "role", "password", "salt"]
            });

            if (!user) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, UserController.ERROR_USER_NOT_FOUND);
            return;
            }

            if (firstName !== undefined) user.firstName = firstName;
            if (surname !== undefined) user.surname = surname;
            if (email !== undefined) user.email = email;
            if (roleId !== undefined) user.role = { id: roleId } as any;
            if (leaveBalance !== undefined) user.leaveBalance = leaveBalance;

            const errors = await validate(user);
            if (errors.length > 0) {
                throw new Error(errors.map(err => Object.values(err.constraints || {})).join(", "));
            }

            const updatedUser = await this.userRepository.save(user);

            ResponseHandler.sendSuccessResponse(res, updatedUser, StatusCodes.OK);
        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res,
                StatusCodes.BAD_REQUEST,
                error.message);
        }
    };

}


