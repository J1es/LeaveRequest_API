import { Server } from "./Server";
import { Router } from "express";
import { AppDataSource } from "./data_source";
import { Role } from './entity/Role';
import { User } from './entity/User';
import { UserManagement } from "./entity/UserManagement";
import { LoginRouter } from "./routes/LoginRouter";
import { RoleRouter } from "./routes/RoleRouter";
import { UserRouter } from "./routes/UserRouter";
import { UserManagementRouter } from "./routes/UserManagementRouter";
import { LoginController } from "./controllers/LoginController";
import { RoleController } from "./controllers/RoleController";
import { UserController } from "./controllers/UserController";
import { UserManagementController } from "./controllers/UserManagementController";
import { LeaveRequestRouter } from "./routes/LeaveRequestRouter";
import { LeaveRequestController } from "./controllers/LeaveRequestController";
import { LeaveRequest } from "./entity/LeaveRequest";

const DEFAULT_PORT = 8900
const port = process.env.SERVER_PORT || DEFAULT_PORT;
if (!process.env.SERVER_PORT) {
    console.log("PORT environment variable is not set, defaulting to " + DEFAULT_PORT);
}

const appDataSource = AppDataSource;

const routers = [
new LoginRouter(Router(), new LoginController(AppDataSource.getRepository(User))),
new RoleRouter(Router(), new RoleController(AppDataSource.getRepository(Role))),
new UserRouter(Router(), new UserController(AppDataSource.getRepository(User))),
new UserManagementRouter(Router(), new UserManagementController(AppDataSource.getRepository(UserManagement))),
new LeaveRequestRouter(Router(), new LeaveRequestController(
    AppDataSource.getRepository(LeaveRequest),
    AppDataSource.getRepository(UserManagement),
    AppDataSource.getRepository(User)))
];

const server = new Server(port, routers, appDataSource);

server.start();