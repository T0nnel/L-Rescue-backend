/* eslint-disable prettier/prettier */
import { IsString, IsArray, IsNotEmpty, IsEmail } from 'class-validator';

export class SaveUserDataDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  firmName: string;

  @IsString()
  @IsNotEmpty()
  firmAddress: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsArray()
  @IsString({ each: true })
  legalPractices: string[];

  @IsString()
  @IsNotEmpty()
  selectedMembership: string;

  @IsArray()
  @IsString({ each: true })
  licenses: string[];

  @IsArray()
  @IsString({ each: true })
  state: string[];

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
