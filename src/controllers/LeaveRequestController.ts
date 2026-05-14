import { Response } from 'express';
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

    public static readonly ERROR_INVALID_ID_FORMAT = "Invalid ID format";
    public static readonly ERROR_INVALID_DATE_FORMAT = "Invalid Date format";
    public static readonly ERROR_USER_NOT_FOUND = "User Not Found";
    public static readonly ERROR_INSUFFICIENT_BALANCE = "Insufficient leave balance"
    public static readonly ERROR_OVERLAPPING_DATES = "Date range of request overlaps with existing request";
    public static readonly ERROR_LEAVE_REQUEST_NOT_FOUND = "Leave request not found";
    public static readonly ERROR_NOT_ALLOWED = "You are not allowed to perform this action";
    public static readonly ERROR_LEAVE_REQUEST_ALREADY_CANCELLED = "Request is already cancelled";
    public static readonly ERROR_CANNOT_CANCEL_REJECTED = "Rejected requests cannot be cancelled";
    public static readonly ERROR_ONLY_PENDING_APPROVED = "Only pending requests can be approved";
    public static readonly ERROR_ONLY_PENDING_REJECTED = "Only pending requests can be rejected";
    public static readonly ERROR_EMPLOYEE_NOT_FOUND = "Employee not found"

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
                    LeaveRequestController.ERROR_INVALID_ID_FORMAT
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
                    LeaveRequestController.ERROR_INVALID_DATE_FORMAT
                );
                return
            }

            const daysRequested = Validation.daysBetween(requestStart, requestEnd);
            const user = await this.userRepository.findOne({ where: { id: userId } });

            if (!user) {
                throw new Error(LeaveRequestController.ERROR_USER_NOT_FOUND)
            }

            if (daysRequested > user.leaveBalance) {
                ResponseHandler.sendErrorResponse(
                    res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_INSUFFICIENT_BALANCE
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
                    LeaveRequestController.ERROR_OVERLAPPING_DATES
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

            if (isNaN(leaveRequestId)) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_INVALID_ID_FORMAT);
                return;
            }

            const request = await this.leaveRequestRepository.findOne({
                where: { leaveRequestId: Number(leaveRequestId) },
                relations: ["user"]
            });

            if (!request) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND, 
                    LeaveRequestController.ERROR_LEAVE_REQUEST_NOT_FOUND);
                return;
            }

            const isOwner = request.user.id == userId;
            const isAdmin = userRole?.name == "admin";

            if (!isOwner && !isAdmin) {
                Logger.warn(
                    `Unauthorised access attempt by ${req.signedInUser?.email} (role: ${req.signedInUser?.role?.name})`
                );
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.FORBIDDEN,
                    LeaveRequestController.ERROR_NOT_ALLOWED);
                return;
            }

            if (request.status == LeaveStatus.Cancelled) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_LEAVE_REQUEST_ALREADY_CANCELLED);
                return;
            }

            if (request.status == LeaveStatus.Rejected) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_CANNOT_CANCEL_REJECTED);
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

            if (isNaN(leaveRequestId)) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_INVALID_ID_FORMAT);
                return;
            }

            const request = await this.leaveRequestRepository.findOne({
                where: { leaveRequestId: Number(leaveRequestId) },
                relations: ["user"]
            });

            if (!request) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND,
                    LeaveRequestController.ERROR_LEAVE_REQUEST_NOT_FOUND);
                return;
            }

            if (request.status != LeaveStatus.Pending) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_ONLY_PENDING_APPROVED);
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
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.FORBIDDEN,
                    LeaveRequestController.ERROR_NOT_ALLOWED);
                return;
            }

            const daysRequested = Validation.daysBetween(request.startDate, request.endDate);

            if (daysRequested > request.user.leaveBalance) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_INSUFFICIENT_BALANCE);
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

    public rejectLeave = async (req: IAuthenticatedJWTRequest, res: Response): Promise<void> => {
        try {
            const userId = req.signedInUser?.id;
            const userRole = req.signedInUser?.role?.name;
            const { leaveRequestId, reason } = req.body;

            if (isNaN(leaveRequestId)) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_INVALID_ID_FORMAT);
                return;
            }

            const request = await this.leaveRequestRepository.findOne({
                where: { leaveRequestId: Number(leaveRequestId) },
                relations: ["user"]
            });

            if (!request) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND, 
                    LeaveRequestController.ERROR_LEAVE_REQUEST_NOT_FOUND);
                return;
            }

            if (request.status != LeaveStatus.Pending) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_ONLY_PENDING_REJECTED);
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
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.FORBIDDEN,
                    LeaveRequestController.ERROR_NOT_ALLOWED);
                return;
            }

            request.status = LeaveStatus.Rejected;
            request.reason = reason;

            await this.userRepository.save(request.user);
            await this.leaveRequestRepository.save(request);

            ResponseHandler.sendSuccessResponse(res, {
                message: `Leave request ${request.leaveRequestId} for employee_id ${request.user.id} has been Rejected`,
                data: {
                    reason: request.reason
                }
            });

        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message);
        }
    };

    public leaveStatus = async (req: IAuthenticatedJWTRequest, res: Response): Promise<void> => {
        try {
            const userId = req.signedInUser?.id;
            const userRole = req.signedInUser?.role?.name;
            const employeeId = parseInt(req.params.employee_id as string);

            if (isNaN(employeeId)) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_INVALID_ID_FORMAT);
                return;
            }

            const employee = await this.userRepository.findOne({ where: { id: employeeId } });

            if (!employee) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND, 
                    LeaveRequestController.ERROR_EMPLOYEE_NOT_FOUND);
                return;
            }

            const isAdmin = (userRole == "admin");
            const isManager = (userRole == "manager");
            const isSelf = (userId == employeeId);
            let isManagerOfStaff = false;

            if (isManager) {
                const manages = await this.userManagementRepository.findOne({
                    where: {
                        manager: { id: userId },
                        user: { id: employeeId }
                    }
                });
                if (manages) { isManagerOfStaff = true; }
            }

            if (!isAdmin && !isSelf && !isManagerOfStaff) {
                Logger.warn(
                    `Unauthorised access attempt by ${req.signedInUser?.email} (role: ${req.signedInUser?.role?.name})`
                );
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.FORBIDDEN,
                    LeaveRequestController.ERROR_NOT_ALLOWED);
                return;
            }

            const requests = await this.leaveRequestRepository.find({
                where: { user: { id: employeeId } },
            });

            const formattedRequests = requests.map(request => ({
                id: request.leaveRequestId,
                start_date: request.startDate.toISOString().split("T")[0],
                end_date: request.endDate.toISOString().split("T")[0],
                status: request.status,
                reason: request.reason
            }));

            ResponseHandler.sendSuccessResponse(res, {
                message: `Status of leave requests for employee_id ${employeeId}`,
                data: formattedRequests
            });

        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message);
        }
    };

    public remainingDays = async (req: IAuthenticatedJWTRequest, res: Response): Promise<void> => {
        try {
            const userId = req.signedInUser?.id;
            const userRole = req.signedInUser?.role?.name;
            const employeeId = parseInt(req.params.employee_id as string);

            if (isNaN(employeeId)) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.BAD_REQUEST,
                    LeaveRequestController.ERROR_INVALID_ID_FORMAT);
                return;
            }

            const employee = await this.userRepository.findOne({ where: { id: employeeId } });

            if (!employee) {
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.NOT_FOUND,
                    LeaveRequestController.ERROR_EMPLOYEE_NOT_FOUND);
                return;
            }

            const isAdmin = (userRole == "admin");
            const isManager = (userRole == "manager");
            const isSelf = (userId == employeeId);
            let isManagerOfStaff = false;

            if (isManager) {
                const manages = await this.userManagementRepository.findOne({
                    where: {
                        manager: { id: userId },
                        user: { id: employeeId }
                    }
                });
                if (manages) { isManagerOfStaff = true; }
            }

            if (!isAdmin && !isSelf && !isManagerOfStaff) {
                Logger.warn(
                    `Unauthorised access attempt by ${req.signedInUser?.email} (role: ${req.signedInUser?.role?.name})`
                );
                ResponseHandler.sendErrorResponse(res,
                    StatusCodes.FORBIDDEN,
                    LeaveRequestController.ERROR_NOT_ALLOWED);
                return;
            }

            ResponseHandler.sendSuccessResponse(res, {
                message: `Status of leave requests for employee_id ${employeeId}`,
                data: {"days remaining" : employee.leaveBalance}
            });

        } catch (error: any) {
            ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message);
        }
    };


}