import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, BeforeInsert } from "typeorm";
import { IsNotEmpty } from 'class-validator';
import { Validation } from '../helpers/Validation'
import { User } from "./User";

export enum LeaveStatus {
    Pending = "Pending",
    Approved = "Approved",
    Rejected = "Rejected",
    Cancelled = "Cancelled"
}

@Entity()
export class LeaveRequest {

    @PrimaryGeneratedColumn()
    leaveRequestId!: number;

    @ManyToOne(() => User)
    @IsNotEmpty({ message: 'User is required' })
    user!: User;

    @Column({ default: "Annual" })
    @IsNotEmpty({ message: 'Leave Type is required' })
    leaveType!: string;

    @Column()
    @IsNotEmpty({ message: 'Start Date is required' })
    startDate!: Date;

    @Column()
    @IsNotEmpty({ message: 'End Date is required' })
    endDate!: Date;

    @Column({
        type: "enum",
        enum: LeaveStatus,
        default: LeaveStatus.Pending
    })
    @IsNotEmpty({ message: 'Leave Status is required' })
    status!: LeaveStatus;

    @Column({ nullable: true })
    reason!: string;

    @BeforeInsert()
    validateFields(){
        Validation.validateDates(this.startDate,this.endDate)
    }
    
}