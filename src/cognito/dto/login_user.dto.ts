/* eslint-disable prettier/prettier */
import { IsString, MinLength } from 'class-validator';

export class LoginUserDto {
    @IsString()
    username: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password: string;
}


