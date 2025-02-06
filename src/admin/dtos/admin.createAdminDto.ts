import { Privileges } from '../enums/privileges.enum';
import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'First name must be at least 3 characters long' })
  @MaxLength(96)
  firstName: string;

  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'Last name must be at least 3 characters long' })
  @MaxLength(96)
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
    message:
      'Password must contain minimum eight characters, at least one letter, one number and one special character',
  })
  password: string;

  @IsString()
  privilege: Privileges = Privileges.ADMIN;
}
