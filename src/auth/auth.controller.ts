/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateUserProfileDto } from './dto/update-auth.dto';
import { CreateAuthDto } from '../auth/dto/create-auth.dto';
import { CognitoService } from '../cognito/cognito.service';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login_user.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly cognitoService: CognitoService,
    private readonly authService: AuthService,
  ) {}

  @Post('/register')
  async register(@Body() registerUserDto: CreateAuthDto) {
    return this.cognitoService.registerUser(registerUserDto);
  }


  @Post('/confirmSignUp')
  async confirmSignUp(
    @Body('email') email: string,
    @Body('confirmationCode') confirmationCode: string
  ) {
    if (!email || !confirmationCode) {
      throw new BadRequestException('Email and confirmation code are required.');
    }
  
    return await this.cognitoService.confirmSignUp(email, confirmationCode);
  }
  

  @Post('/login')
  async signin(@Body() loginUserDto: LoginUserDto) {
    return this.cognitoService.loginUser(
      loginUserDto.username,
      loginUserDto.password,
    );
  }
  @Post('resend')
  async resendConfirmationCode(@Body('email') email: string): Promise<any> {
    if (!email) {
      throw new BadRequestException('Email address is required.');
    }

    try {
      const response = await this.cognitoService.resendConfirmationCode(email);
      return {
        success: true,
        message: response.message,
      };
    } catch (error) {
      console.error('Error in /resend-confirmation-code:', error.message);

      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(error.message);
      }
      throw new InternalServerErrorException(
        'Could not process your request. Please try again later.',
      );
    }
  }

  
  @Get()
  findAll() {
    return this.authService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findOne(+id);
  }

  @Patch('update')
  async updateUser(
    @Body() updateUserProfileDto: UpdateUserProfileDto,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];

    if (!token) {
      throw new Error('Token not found');
    }

    const accessToken = token;
    return this.cognitoService.updateUser(accessToken, updateUserProfileDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(+id);
  }

}
