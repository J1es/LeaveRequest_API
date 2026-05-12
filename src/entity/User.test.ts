import { validate } from "class-validator";
import { User } from "../entity/User";
import { Role } from "../entity/Role";
import { instanceToPlain } from "class-transformer";

describe("User Entity tests", () => {
    let user: User;
    let role: Role;
    beforeEach(() => {
        role = new Role();
        role.id = 1;
        role.name = "admin";

        user = new User();
        user.id = 1;
        user.firstName = "first_name";
        user.surname = "surname";
        user.email = "test@email.com";
        user.password = 'a'.repeat(10);
        user.role = role;
    });

    it("A user with no firstname is considered invalid", async () => {
        user.firstName = null as any;

        const errors = await validate(user);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("A user with no surname is considered invalid", async () => {
        user.surname = null as any;

        const errors = await validate(user);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("A password that is not a string is considered invalid", async () => {
        user.password = 1234 as any;

        const errors = await validate(user);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isString");
    });

    it("A password less than 10 characters is considered invalid", async () => {
        user.password = 'a'.repeat(9);

        const errors = await validate(user);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("minLength");
    });

    it('A password containing only whitespace is invalid', async () => {
        user.password = ' ';

        const errors = await validate(user);
        expect(errors.length).toBe(1);
        const constraints = errors[0].constraints;

        expect(constraints).toHaveProperty('matches');
    })

    it("A poorly formed email is considered invalid", async () => {
        user.email = "not a valid email address";

        const errors = await validate(user);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isEmail");
    })

    it("A user with no role is considered invalid", async () => {
        user.role = null as any;

        const errors = await validate(user);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("A user with valid details will be accepted", async () => {
        const errors = await validate(user);

        expect(errors.length).toBe(0);
    });

    it("A user with valid details will not return their password after submitting valid details", () => {
        
        const plainUser = instanceToPlain(user);

        expect(plainUser).toHaveProperty("id", user.id);
        expect(plainUser).toHaveProperty("email", user.email);
        expect(plainUser).toHaveProperty("role", { id: role.id, name: role.name });
        expect(plainUser).not.toHaveProperty("password");
    });

});
