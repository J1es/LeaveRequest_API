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
import { Logger } from '../helpers/Logger';


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

    public cancelLeave = async (req: IAuthenticatedJWTRequest, res: Response): Promise<void> => {
        try {
            const userId = req.signedInUser?.id;
            const userRole = req.signedInUser?.role;
            const { leaveRequestId, reason } = req.body;

            const request = await this.leaveRequestRepository.findOne({
                where: { leaveRequestId: Number(leaveRequestId) },
                relations: ["user"]
            });

            if (!request) {
                ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, "Leave request not found");
                return;
            }

            const isOwner = request.user.id == userId;
            const isAdmin = userRole?.name == "admin";

            if (!isOwner && !isAdmin) {
                Logger.warn(
                    `Unauthorised access attempt by ${req.signedInUser?.email} (role: ${req.signedInUser?.role?.name})`
                );
                ResponseHandler.sendErrorResponse(res, StatusCodes.FORBIDDEN, "You are not allowed to cancel this leave request");
                return;
            }

            if (request.status == LeaveStatus.Cancelled) {
                ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Request is already cancelled");
                return;
            }

            if (request.status == LeaveStatus.Rejected) {
                ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Rejected requests cannot be cancelled");
                return;
            }

            if (request.status == LeaveStatus.Approved) {
                const days = Validation.daysBetween(request.startDate, request.endDate);
                request.user.leaveBalance += days;
                await this.userRepository.save(request.user);
            }

            request.status = LeaveStatus.Cancelled;
            request.reason = reason;
            await this.leaveRequestRepository.save(request);

            ResponseHandler.sendSuccessResponse(res, {
                message: "Leave request cancelled successfully",
                reason: request.reason,
                data: {
                    id: request.leaveRequestId,
                    employee_id: request.user.id,
                    start_date: request.startDate,
                    end_date: request.endDate,
                    status: request.status
                }
            });

        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message);
        }
    };

    public approveLeave = async (req: IAuthenticatedJWTRequest, res: Response): Promise<void> => {
        try {
            const userId = req.signedInUser?.id;
            const userRole = req.signedInUser?.role?.name;
            const { leaveRequestId, reason } = req.body;

            const request = await this.leaveRequestRepository.findOne({
                where: { leaveRequestId: Number(leaveRequestId) },
                relations: ["user"]
            });

            if (!request) {
                ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, "Leave request not found");
                return;
            }

            if (request.status != LeaveStatus.Pending) {
                ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Only pending requests can be approved");
                return;
            }

            const isAdmin = (userRole == "admin");
            let isManagerOfStaff = false;

            if (userRole == "manager") {
                const manages = await this.userManagementRepository.findOne({
                    where: {
                        manager: { id: userId },
                        user: { id: request.user.id }
                    }
                });
                if (manages) { isManagerOfStaff = true; }
            }

            if (!isAdmin && !isManagerOfStaff) {
                Logger.warn(
                    `Unauthorised access attempt by ${req.signedInUser?.email} (role: ${req.signedInUser?.role?.name})`
                );
                ResponseHandler.sendErrorResponse(res, StatusCodes.FORBIDDEN, "You are not allowed to cancel this leave request");
                return;
            }

            const daysRequested = Validation.daysBetween(request.startDate, request.endDate);

            if (daysRequested > request.user.leaveBalance) {
                ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, "Insufficient leave balance");
                return;
            }

            request.user.leaveBalance -= daysRequested;
            request.status = LeaveStatus.Approved;
            request.reason = reason;

            await this.userRepository.save(request.user);
            await this.leaveRequestRepository.save(request);

            ResponseHandler.sendSuccessResponse(res, {
                message: `Leave request ${request.leaveRequestId} for employee_id ${request.user.id} has been approved`,
                data: {
                    reason: request.reason
                }
            });

        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message);
        }
    };

    public rejectLeave = async (req: Request, res: Response): Promise<void> => {

    };

    public leaveStatus = async (req: Request, res: Response): Promise<void> => {

    };

    public remainingDays = async (req: Request, res: Response): Promise<void> => {

    };


}