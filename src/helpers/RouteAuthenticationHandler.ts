import { Response, NextFunction } from "express";
import { IAuthenticatedJWTRequest } from "../types/IAuthenticatedJWTRequest";
import { ResponseHandler } from "./ResponseHandler";
import { StatusCodes } from "http-status-codes";
import { Logger } from "./Logger";

export function isAdmin(
    req: IAuthenticatedJWTRequest,
    res: Response,
    next: NextFunction
) { 

    if (!req.signedInUser) {
        Logger.warn("Unauthorised access attempt: No signed-in user");
        return ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.UNAUTHORIZED,
            "Not authenticated"
        );
    }

    if (req.signedInUser.role?.name !== "admin") {
        Logger.warn(
            `Unauthorised access attempt by ${req.signedInUser.email} (role: ${req.signedInUser.role?.name})`
        );
        return ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.FORBIDDEN,
            "Admins only"
        );
    }

    next();
}

export function isManager(
    req: IAuthenticatedJWTRequest,
    res: Response,
    next: NextFunction
) {

    if (!req.signedInUser) {
        Logger.warn("Unauthorised access attempt: No signed-in user");
        return ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.UNAUTHORIZED,
            "Not authenticated"
        );
    }

    if (req.signedInUser.role?.name !== "manager") {
        Logger.warn(
            `Unauthorised access attempt by ${req.signedInUser.email} (role: ${req.signedInUser.role?.name})`
        );
        return ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.FORBIDDEN,
            "Managers only"
        );
    }

    next();
}
