import { Router } from "express";
import { UserController } from '../controllers/UserController';
import { IRouter } from "../types/IRouter";
import { MiddlewareFactory } from "../helpers/MiddlewareFactory";
import { isAdmin } from "../helpers/RouteAuthenticationHandler";

export class UserRouter implements IRouter {
    authenticate: boolean = true;
    routeName: string = "users";
    limiter: any = MiddlewareFactory.jwtRateLimiter;
    basePath: string = "/api/users";

    constructor(private router: Router,
        private userController: UserController) {
        this.addRoutes();
    }

    public getRouter(): Router {
        return this.router;
    }
    private addRoutes() {
        this.router.delete('/:id', isAdmin, this.userController.delete);
        this.router.get('/', isAdmin, this.userController.getAll);
        this.router.get('/email/:emailAddress', isAdmin, this.userController.getByEmail);
        this.router.get('/:id', isAdmin, this.userController.getById);
        this.router.post('/', isAdmin, this.userController.create);
        this.router.patch('/:id', isAdmin, this.userController.update);
    }
}