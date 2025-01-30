/* eslint-disable prettier/prettier */
import { IsEmail, IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format' }) 
  phonenumber: string;

  @IsOptional()
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  state: string;

  @IsOptional()
  @IsString()
  county: string;

  @IsOptional()
  @IsString()
  zipcode: string;
}
