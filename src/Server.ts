import express, { Request, Response, NextFunction } from "express";
import { Logger } from "./helpers/Logger";
import { DataSource } from "typeorm";
import { IRouter } from "./types/IRouter";
import morgan, { StreamOptions } from "morgan";
import { MiddlewareFactory } from "./helpers/MiddlewareFactory";
import { AppError } from "./helpers/AppError";
import { ErrorHandler } from "./ErrorHandler";

export class Server {
    public static readonly ERROR_TOKEN_IS_INVALID = "Not authorised - Token is invalid";
    public static readonly ERROR_TOKEN_NOT_FOUND = "Not authorised - Token not found";
    public static readonly ERROR_TOKEN_SECRET_NOT_DEFINED = "Not authorised - JWT_SECRET_KEY is missing/Not Defined"
    public static readonly TOO_MANY_REQUESTS_MESSAGE = "Too many requests";

    private readonly app: express.Application;

    constructor(private readonly port: string | number,
        private readonly routers: IRouter[],
        private readonly appDataSource: DataSource
    ) {
        this.app = express();
        const helmet = require('helmet');
        this.app.use(helmet());
        this.initialiseMiddlewares();
        this.initialiseRoutes();
        this.initialiseErrorHandling();
    }

    private initialiseMiddlewares() {
        const morganStream: StreamOptions = {
            write: (message: string): void => {
                Logger.info(message.trim());
            }
        };
        this.app.use(express.json());
        this.app.use(morgan("combined", { stream: morganStream }));
    }

    private initialiseRoutes() {

        for (const route of this.routers) {

            const middlewares: express.RequestHandler[] = [];

            if (route.authenticate) {
                middlewares.push(MiddlewareFactory.authenticateToken);
            }

            middlewares.push(route.limiter);
            middlewares.push(MiddlewareFactory.logRouteAccess(route.routeName));
            this.app.use(route.basePath, ...middlewares, route.getRouter());
        }
    }

    private initialiseErrorHandling() {
        this.app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
            ErrorHandler.handle(err, res);
        });
    }

    public async start() {
        await this.initialiseDataSource();
        this.app.listen(this.port, () => {
            Logger.info(`Server running on http://localhost:${this.port}`)
        });
    }

    private async initialiseDataSource() {
        try {
            await this.appDataSource.initialize();
            Logger.info("Data Source initialised");
        } catch (error) {
            Logger.error("Error during initialisation:", error);
            throw error;
        }
    }

}