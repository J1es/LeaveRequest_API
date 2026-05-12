import { validate } from "class-validator";
import { Repository } from "typeorm";
import { User } from "../entity/User";
import { Role } from "../entity/Role";
import { LeaveRequest, LeaveStatus } from "./LeaveRequest";
import { mock } from "jest-mock-extended";
import { Validation } from '../helpers/Validation'

describe("Leave Request Entity tests", () => {
    let user: User;
    let role: Role;
    let leaveRequest: LeaveRequest;
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

        leaveRequest = new LeaveRequest();
        leaveRequest.leaveRequestId = 1;
        leaveRequest.leaveType = "Annual";
        leaveRequest.startDate = new Date(2026, 5, 10);
        leaveRequest.endDate = new Date(2026, 5, 15);
        leaveRequest.status = LeaveStatus.Pending;
        leaveRequest.user = user;
    });

    it("A Leave Request with no User is considered invalid", async () => {
        leaveRequest.user = null as any;

        const errors = await validate(leaveRequest);
        
        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("A Leave Request with no Leave Type is considered invalid", async () => {
        leaveRequest.leaveType = null as any;

        const errors = await validate(leaveRequest);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("A Leave Request with no Start Date is considered invalid", async () => {
        leaveRequest.startDate = null as any;

        const errors = await validate(leaveRequest);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("A Leave Request with no End Date is considered invalid", async () => {
        leaveRequest.endDate = null as any;

        const errors = await validate(leaveRequest);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("A Leave Request with no Leave Status is considered invalid", async () => {
        leaveRequest.status = null as any;

        const errors = await validate(leaveRequest);

        expect(errors.length).toBe(1);
        expect(errors[0].constraints).toHaveProperty("isNotEmpty");
    });

    it("A Leave Request with an End Date before Start Date is invalid.", async () => {
        let mockLeaveRequestRepo: jest.Mocked<Repository<LeaveRequest>>;
        mockLeaveRequestRepo = mock<Repository<LeaveRequest>>();
    
        mockLeaveRequestRepo.save.mockImplementation(async (entity: any) => {
            const leaveRequest = entity as LeaveRequest;
            leaveRequest.validateFields(); 
            return leaveRequest;
        });

        leaveRequest.startDate = new Date(2026, 5, 20);
        leaveRequest.endDate = new Date(2026, 5, 10);
    
        await expect(mockLeaveRequestRepo.save(leaveRequest)).rejects.toThrow(
            Validation.ERROR_END_DATE_BEFORE_START_DATE(leaveRequest.startDate.toDateString(),
                leaveRequest.endDate.toDateString()
            )
        );

        jest.clearAllMocks();
    });

});

