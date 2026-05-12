import { validate } from 'class-validator';
import { Repository } from "typeorm";
import { Role } from './Role';
import { User } from './User';
import { UserManagement } from './UserManagement';
import { mock } from "jest-mock-extended";
import { Validation } from '../helpers/Validation';


describe('User Management entity tests', () => {
    
    let user: User;
    let manager: User;
    let role: Role;
    let userManagement: UserManagement;

    beforeEach(() => {
        role = new Role();
        role.id = 1;
        role.name = "staff";

        role = new Role();
        role.id = 2;
        role.name = "manager";

        user = new User();
        user.id = 1;
        user.firstName = "first_name_user";
        user.surname = "surname_user";
        user.email = "user@email.com";
        user.password = 'a'.repeat(10);
        user.role = role;

        manager = new User();
        user.id = 2;
        user.firstName = "first_name_manager";
        user.surname = "surname_manager";
        user.email = "manager@email.com";
        user.password = 'b'.repeat(10);
        user.role = role;

        userManagement = new UserManagement();
        userManagement.user = user;
        userManagement.manager = manager;
        userManagement.startDate = new Date(2026, 5, 10)
        userManagement.endDate = new Date(2026, 5, 20)
    });

    it("User Management with no User is considered invalid", async () => {
        userManagement.user = null as any;

        const errors = await validate(userManagement);
        
        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("User Management with no Manager is considered invalid", async () => {
        userManagement.manager = null as any;

        const errors = await validate(userManagement);
        
        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("User Management with no Start Date is considered invalid", async () => {
        userManagement.startDate = null as any;

        const errors = await validate(userManagement);
        
        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("User Management with an End Date before Start Date is invalid.", async () => {
        let mockUserManagementRepo: jest.Mocked<Repository<UserManagement>>;
        mockUserManagementRepo = mock<Repository<UserManagement>>();
    
        mockUserManagementRepo.save.mockImplementation(async (entity: any) => {
            const userManagement = entity as UserManagement;
            userManagement.validateFields(); 
            return userManagement;
        });

        userManagement.startDate = new Date(2026, 5, 20);
        userManagement.endDate = new Date(2026, 5, 10);
    
        await expect(mockUserManagementRepo.save(userManagement)).rejects.toThrow(
            Validation.ERROR_END_DATE_BEFORE_START_DATE(userManagement.startDate.toDateString(),
                userManagement.endDate.toDateString()
            )
        );

        jest.clearAllMocks();
    });

});


