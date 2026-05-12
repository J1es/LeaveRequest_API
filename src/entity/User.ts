import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, BeforeInsert } from "typeorm"
import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { Role } from "./Role";
import { Exclude } from "class-transformer";
import { PasswordHandler } from '../helpers/PasswordHandler';

@Entity({ name: "user" })
export class User {

    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    @IsNotEmpty({ message: 'User requires a Firstname' })
    firstName!: string

    @Column()
    @IsNotEmpty({ message: 'User requires a surname' })
    surname!: string

    @Column({ select: false })
    @Exclude({toPlainOnly: true})
    @IsString()
    @Matches(/\S/, { message: 'Password cannot be empty or whitespace' })
    @MinLength(10, { message: 'Password must be at least 10 characters long' })
    password!: string

    @Column({ select: false })
    @Exclude()
    salt!: string

    @Column({ unique: true })
    @IsEmail({}, { message: 'Must be a valid email address' })
    email!: string

    @ManyToOne(() => Role, { nullable: false, eager: true })
    @IsNotEmpty({ message: 'Role is required' })
    role!: Role;

    @Column({ default: 25 })
    leaveBalance!: number;

    @BeforeInsert()
    hashPassword() {
        if (!this.password) {
            throw new Error("Password must be provided before inserting a user.");
        }
        const { hashedPassword, salt } = PasswordHandler.hashPassword(this.password);
        this.password = hashedPassword;
        this.salt = salt;
    }
    
}