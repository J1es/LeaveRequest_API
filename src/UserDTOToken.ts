import { Role } from "./entity/Role";

export class UserDTOToken {
    constructor(
        private id: number,
        private email: string,
        private role: Role
    ) {}
}