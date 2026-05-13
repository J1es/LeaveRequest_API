import { Router } from "express";
import { RoleController } from '../controllers/RoleController';
import { IRouter } from "../types/IRouter";
import { MiddlewareFactory } from "../helpers/MiddlewareFactory";
import { isAdmin } from "../helpers/RouteAuthenticationHandler";

export class RoleRouter implements IRouter {
    authenticate: boolean = true;
    routeName: string = "roles";
    limiter: any = MiddlewareFactory.jwtRateLimiter;
    basePath: string = "/api/roles"

    constructor(private router: Router,
        private roleController: RoleController) {
        this.addRoutes();
    }

    public getRouter(): Router {
        return this.router;
    }

    private addRoutes() {
        this.router.get('/', isAdmin, this.roleController.getAll);
        this.router.get('/:id', isAdmin, this.roleController.getById);
        this.router.post('/', isAdmin, this.roleController.create);
        this.router.delete('/:id', isAdmin, this.roleController.delete);
        this.router.patch('/:id', isAdmin, this.roleController.update);
    }
}