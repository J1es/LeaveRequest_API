import { Router } from "express";
import { IRouter } from "../types/IRouter";
import { MiddlewareFactory } from "../helpers/MiddlewareFactory";
import { LeaveRequestController } from "../controllers/LeaveRequestController";

export class LeaveRequestRouter implements IRouter {
    authenticate: boolean = true;
    routeName: string = "leave-requests";
    limiter: any = MiddlewareFactory.jwtRateLimiter;
    basePath: string = "/api/leave-requests";

    constructor(private router: Router,
        private leaveRequestController: LeaveRequestController) {
        this.addRoutes();
    }

    public getRouter(): Router {
        return this.router;
    }
    
    private addRoutes() {
        this.router.post('/', this.leaveRequestController.requestLeave);
        this.router.delete('/', this.leaveRequestController.cancelLeave);
        this.router.patch('/approve', this.leaveRequestController.approveLeave);
        this.router.patch('/reject', this.leaveRequestController.rejectLeave);
        this.router.get('/status/:employee_id', this.leaveRequestController.leaveStatus);
        this.router.get('/remaining/:employee_id', this.leaveRequestController.remainingDays);
    }
}