import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, BeforeInsert } from "typeorm";
import { IsNotEmpty } from 'class-validator';
import { Validation } from "../helpers/Validation";
import { User } from "./User";

@Entity()
export class UserManagement {

    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => User)
    @IsNotEmpty({ message: 'User is required' })
    user!: User;
 
    @ManyToOne(() => User)
    @IsNotEmpty({ message: 'Manager is required' })
    manager!: User;

    @Column()
    @IsNotEmpty({ message: 'Manager start date required' })
    startDate!: Date;

    @Column({ nullable: true })
    endDate!: Date;

    @BeforeInsert()
    validateFields(){
        Validation.validateDates(this.startDate,this.endDate)
    }
    
}