/* eslint-disable prettier/prettier */
import { IsEmail, IsString,  } from 'class-validator';

export class CreateAuthDto {
    @IsEmail()
    email: string;
  
    @IsString()
    password: string;
  
    @IsString()
    username: string;
  
    @IsString()
    phone_number: string;
  
    @IsString()
    first_name: string;
  
    @IsString()
    last_name: string;
  }