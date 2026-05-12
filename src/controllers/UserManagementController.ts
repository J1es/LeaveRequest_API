import { Request, Response } from 'express';
import { UserManagement } from '../entity/UserManagement';
import { Repository } from "typeorm";
import { ResponseHandler } from '../helpers/ResponseHandler';
import { StatusCodes } from 'http-status-codes';
import { validate } from "class-validator";
import { User } from '../entity/User'

export class UserManagementController {

    public static readonly ERROR_FAILED_TO_RETRIEVE_MANAGEMENT = "Failed to retrieve user management records";
    public static readonly ERROR_INVALID_RECORD_ID_FORMAT = "Invalid ID format";
    public static readonly ERROR_END_DATE_REQUIRED = "endDate is required";
    public static readonly ERROR_RECORD_NOT_FOUND_WITH_ID = (id: number) => `Management Record not found with ID: ${id}`;

    constructor(private userManagementRepository: Repository<UserManagement>) {}

    public getAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const records = await this.userManagementRepository.find({
                relations: ["user", "manager"]
            });

            ResponseHandler.sendSuccessResponse(res, records, StatusCodes.OK);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            ResponseHandler.sendErrorResponse(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                `${UserManagementController.ERROR_FAILED_TO_RETRIEVE_MANAGEMENT}: ${message}`
            );
        }
    };

    public create = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userId, managerId, startDate } = req.body;

            const record = new UserManagement();
            record.user = { id: userId } as User;
            record.manager = { id: managerId } as User;
            record.startDate = new Date(startDate);

            const errors = await validate(record);
            if (errors.length > 0) {
                const message = errors
                    .map(err => Object.values(err.constraints || {}))
                    .join(", ");
                ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, message);
                return;
            }

            const newRecord = await this.userManagementRepository.save(record);

            ResponseHandler.sendSuccessResponse(res, newRecord, StatusCodes.CREATED);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, message);
        }
    };

    public endManagement = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            const { endDate } = req.body;

            if (isNaN(id)) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    UserManagementController.ERROR_INVALID_RECORD_ID_FORMAT);
                return;
            }

            if (!endDate) {
                ResponseHandler.sendErrorResponse(
                    res,
                    StatusCodes.BAD_REQUEST,
                    UserManagementController.ERROR_END_DATE_REQUIRED
                );
                return;
            }

            const record = await this.userManagementRepository.findOne({
                where: { id },
                relations: ["user", "manager"]
            });

            if (!record) {
                ResponseHandler.sendErrorResponse(
                    res,
                    StatusCodes.NOT_FOUND,
                    UserManagementController.ERROR_RECORD_NOT_FOUND_WITH_ID(id)
                );
                return;
            }

            record.endDate = new Date(endDate);

            const errors = await validate(record);
            if (errors.length > 0) {
                const message = errors
                    .map(err => Object.values(err.constraints || {}))
                    .join(", ");
                ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, message);
                return;
            }

            const newRecord = await this.userManagementRepository.save(record);

            ResponseHandler.sendSuccessResponse(res, newRecord, StatusCodes.OK);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, message);
        }

    };

}