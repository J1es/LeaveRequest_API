import { Router } from "express";
import { UserManagementController } from '../controllers/UserManagementController';
import { IRouter } from "../types/IRouter";
import { MiddlewareFactory } from "../helpers/MiddlewareFactory";
import { isAdmin } from "../helpers/AuthenticationHandler";

export class UserManagementRouter implements IRouter {
    authenticate: boolean = true;
    routeName: string = "user-management";
    limiter: any = MiddlewareFactory.jwtRateLimiter;
    basePath: string = "/api/user-management"

    constructor(private router: Router,
        private UserManagementController: UserManagementController) {
        this.addRoutes();
    }

    public getRouter(): Router {
        return this.router;
    }

    private addRoutes() {
        this.router.get('/', isAdmin, this.UserManagementController.getAll);
        this.router.post('/', isAdmin, this.UserManagementController.create);
        this.router.delete('/:id', isAdmin, this.UserManagementController.endManagement);
    }
}