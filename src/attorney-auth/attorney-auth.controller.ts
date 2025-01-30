/* eslint-disable prettier/prettier */
import { Body, Controller, Delete, HttpCode, HttpException, HttpStatus, Patch, Post, UsePipes } from '@nestjs/common';
import { AttorneyAuthService } from './attorney-auth.service';
import { AttorneySignUpDTO } from 'src/waitlist/dto/attorney_signUp_dto';
import { UpdateAttorneyDto } from 'src/waitlist/dto/attorney_Update_dto copy';
import { ValidationConfig } from 'src/config';
import { CreateAuthDto } from 'src/cognito/dto/create-auth.dto';
import { LoginUserDto } from 'src/cognito/dto/login_user.dto';
import { CognitoService } from 'src/cognito/cognito.service';

@Controller('auth')
export class AttorneyAuthController {
    constructor(private readonly attorneyService: AttorneyAuthService,
        private cognitoService: CognitoService
    ) {}


    
  @Post('/register')
  async register(@Body() registerUserDto: CreateAuthDto) {
    return this.cognitoService.registerUser(registerUserDto);
  }
  @Post('/confirmSignUp')
  async confirmSignUp(
    @Body('email') email: string,
    @Body('confirmationCode') confirmationCode: string
  ){
    return this.cognitoService.confirmSignUp(email, confirmationCode)
  }

  @Post('/login')
  async signin(@Body() loginUserDto: LoginUserDto) {
    return this.cognitoService.loginUser(
      loginUserDto.username,
      loginUserDto.password,
    );
  }

    @Post('/signup')
    @HttpCode(HttpStatus.CREATED)
    @UsePipes(ValidationConfig)
    async signUpAttorney(@Body() body: { data: AttorneySignUpDTO }) {
        try {
            const { data } = body;
            const response = await this.attorneyService.signUpAttorney(data);
            return response
        } catch (error) {
            this.handleError(error);
        }
    }

      @Post('/create-checkout-session')
        async createCheckoutSession(@Body() body: { basePrice:number, attorneyId: string, customerEmail: string, statesLicensing: { barLicenseNumber: string; }[]} ) {
          const { basePrice, customerEmail, attorneyId, statesLicensing } = body;
          const session = await this.attorneyService.registerAttorneySubscription(customerEmail, attorneyId, basePrice, statesLicensing);
          return { url: session.url };
        }
      

    @Post('/signin')
    @HttpCode(HttpStatus.OK)
    @UsePipes(ValidationConfig)
    async signInAttorney(@Body() body: { email: string }) {
        try {
            const { email } = body;
            const attorneyUser = await this.attorneyService.signInAttorney(email);
            if (!attorneyUser) {
                throw new HttpException(
                    `User with email ${email} was not found`,
                    HttpStatus.NOT_FOUND
                );
            }
            return attorneyUser;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Patch('/update')
    @HttpCode(HttpStatus.OK)
    @UsePipes(ValidationConfig)
    async updateAttorney(@Body() body: { email: string; data: UpdateAttorneyDto }) {
        try {
            const { email, data } = body;
            const updatedUser = await this.attorneyService.updateAttorneyDetails(email, data);
            if (!updatedUser) {
                throw new HttpException(
                    `User with email ${email} was not found`,
                    HttpStatus.NOT_FOUND
                );
            }
            return updatedUser;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Delete('/delete')
    @HttpCode(HttpStatus.OK)
    @UsePipes(ValidationConfig)
    async deleteAttorney(@Body() body: { email: string }) {
        try {
            const { email } = body;
            const response = await this.attorneyService.deleteAttorney(email);
            return response;
        } catch (error) {
            this.handleError(error);
        }
    }

    private handleError(error: any) {
        console.error('Attorney Auth Error:', error);
        if (error instanceof HttpException) {
            throw error;
        }
        throw new HttpException(
            error.message || 'Internal Server Error',
            HttpStatus.INTERNAL_SERVER_ERROR
        );
    }
}