import { Request, Response } from 'express';
import { LeaveRequest, LeaveStatus } from '../entity/LeaveRequest';
import { User } from '../entity/User';
import { UserManagement } from '../entity/UserManagement';
import { Repository } from "typeorm";
import { ResponseHandler } from '../helpers/ResponseHandler';
import { StatusCodes } from 'http-status-codes';
import { validate } from "class-validator";
import { IAuthenticatedJWTRequest } from '../types/IAuthenticatedJWTRequest';
import { Validation } from '../helpers/Validation';


export class LeaveRequestController {

    constructor(private leaveRequestRepository: Repository<LeaveRequest>,
        private userManagementRepository: Repository<UserManagement>,
        private userRepository: Repository<User>
    ) { }

    public requestLeave = async (req: IAuthenticatedJWTRequest, res: Response): Promise<void> => {
        try {
            const signedInUser = req.signedInUser;

            const userId = signedInUser?.id;

            if (!userId || typeof userId !== "number") {
                ResponseHandler.sendErrorResponse(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid employee ID"
                );
                return
            }

            const { startDate, endDate } = req.body;

            const requestStart = new Date(startDate);
            const requestEnd = new Date(endDate);

            if (isNaN(requestStart.getTime()) || isNaN(requestEnd.getTime())) {
                ResponseHandler.sendErrorResponse(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid date format"
                );
                return
            }

            const daysRequested = Validation.daysBetween(requestStart, requestEnd);
            const user = await this.userRepository.findOne({ where: { id: userId } });

            if (!user) {
                throw new Error("User not found")
            }

            if (daysRequested > user.leaveBalance) {
                ResponseHandler.sendErrorResponse(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Days requested exceed remaining balance"
                );
                return
            }

            const overlapping = await this.leaveRequestRepository
                .createQueryBuilder("leaveRequest")
                .where("leaveRequest.userId = :id", { id: userId })
                .andWhere("leaveRequest.status != :rejected", { rejected: LeaveStatus.Rejected })
                .andWhere(
                    "leaveRequest.startDate <= :end AND leaveRequest.endDate >= :start",
                    { start: requestStart, end: requestEnd }
                )
                .getOne();

            if (overlapping) {
                ResponseHandler.sendErrorResponse(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Date range of request overlaps with existing request"
                );
                return
            }

            const leaveRequest = new LeaveRequest();
            leaveRequest.user = user;
            leaveRequest.startDate = requestStart;
            leaveRequest.endDate = requestEnd;
            leaveRequest.status = LeaveStatus.Pending;
            leaveRequest.leaveType = "Annual";

            const errors = await validate(leaveRequest);
            if (errors.length > 0) {
                const message = errors
                    .map(err => Object.values(err.constraints || {}))
                    .join(", ");
                ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, message);
                return
            }

            const newLeaveRequest = await this.leaveRequestRepository.save(leaveRequest);

            ResponseHandler.sendSuccessResponse(
                res,
                {
                    message: "Leave request has been submitted for review",
                    data: {
                        id: newLeaveRequest.leaveRequestId,
                        employee_id: newLeaveRequest.user.id,
                        start_date: newLeaveRequest.startDate,
                        end_date: newLeaveRequest.endDate,
                        status: newLeaveRequest.status
                    }
                },
                StatusCodes.CREATED
            );

        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message);
        }
    };

    public cancelLeave = async (req: Request, res: Response): Promise<void> => {

    };

    public approveLeave = async (req: Request, res: Response): Promise<void> => {

    };

    public rejectLeave = async (req: Request, res: Response): Promise<void> => {

    };

    public leaveStatus = async (req: Request, res: Response): Promise<void> => {

    };

    public remainingDays = async (req: Request, res: Response): Promise<void> => {

    };


}