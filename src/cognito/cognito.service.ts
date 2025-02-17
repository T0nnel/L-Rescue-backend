/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  UpdateUserAttributesCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import * as crypto from 'crypto';

export interface UpdateUserProfileDto {
  phone_number?: string;
  name?: string;
  email?: string;
}

@Injectable()
export class CognitoService {
  private readonly cognitoClient: CognitoIdentityProviderClient;

  constructor(
    @Inject('COGNITO_CONFIG')
    private readonly config: {
      userPoolId: string;
      clientId: string;
      clientSecret: string;
      awsRegion: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {
    const {
      userPoolId,
      clientId,
      accessKeyId,
      secretAccessKey,
      clientSecret,
      awsRegion,
    } = config;

    if (
      !clientId ||
      !userPoolId ||
      !awsRegion ||
      !clientSecret ||
      !accessKeyId ||
      !secretAccessKey
    ) {
      throw new Error(
        `Missing required environment variables:
        - COGNITO_CLIENT_ID: ${clientId || 'Not Set'}
        - COGNITO_USER_POOL_ID: ${userPoolId || 'Not Set'}
        - AWS_REGION: ${awsRegion || 'Not Set'}
        - COGNITO_CLIENT_SECRET: ${clientSecret || 'Not Set'}`,
      );
    }

    this.cognitoClient = new CognitoIdentityProviderClient({
      region: awsRegion,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private computeSecretHash(username: string): string {
    const hmac = crypto.createHmac('sha256', this.config.clientSecret);
    hmac.update(username + this.config.clientId);
    return hmac.digest('base64');
  }

  async registerAttorneyUser(userDetails: {
    email: string;
    password: string;
    username: string;
    phone_number: string;
    first_name: string;
    last_name: string;
  }): Promise<any> {
    const { email, password, username, phone_number, first_name, last_name } =
      userDetails;
    const secretHash = this.computeSecretHash(username);

    const userAttributes = [
      { Name: 'email', Value: email },
      { Name: 'phone_number', Value: phone_number },
      { Name: 'given_name', Value: first_name },
      { Name: 'family_name', Value: last_name },
    ];

    const command = new SignUpCommand({
      ClientId: this.config.clientId,
      Username: username,
      Password: password,
      UserAttributes: userAttributes,
      SecretHash: secretHash,
    });

    try {
      const response = await this.cognitoClient.send(command);
      return response;
    } catch (error) {
      console.error('Failed to register user:', error);

      if (error.__type === 'UsernameExistsException') {
        throw new ConflictException(
          'An account with this email already exists. Please try logging in instead.',
        );
      }

      switch (error.__type) {
        case 'InvalidPasswordException':
          throw new BadRequestException('Password does not meet requirements.');
        case 'InvalidParameterException':
          throw new BadRequestException('Invalid parameters provided.');
        case 'CodeDeliveryFailureException':
          throw new ServiceUnavailableException(
            'Unable to send verification code.',
          );
        default:
          throw new InternalServerErrorException(
            'Registration failed. Please try again later.',
          );
      }
    }
  }
  async confirmAttorneySignUp(email: string, code: string): Promise<any> {
    const secretHash = this.computeSecretHash(email);

    const command = new ConfirmSignUpCommand({
      ClientId: this.config.clientId,
      Username: email,
      ConfirmationCode: code,
      SecretHash: secretHash,
    });

    try {
      const response = await this.cognitoClient.send(command);
      return {
        success: true,
        message: 'Email verified successfully',
        redirectToLogin: true,
        response: response,
      };
    } catch (error) {
      console.error('Error confirming user signup:', error);

      switch (error.__type) {
        case 'CodeMismatchException':
          throw new BadRequestException(
            'Invalid verification code. Please try again.',
          );
        case 'ExpiredCodeException':
          await this.resendAttorneyConfirmationCode(email);
          throw new BadRequestException({
            message:
              'Verification code has expired. A new code has been sent to your email.',
            codeSent: true,
          });
        case 'UserNotFoundException':
          throw new NotFoundException('User not found. Please register first.');
        case 'NotAuthorizedException':
          throw new UnauthorizedException('Account has already been verified.');
        default:
          throw new InternalServerErrorException(
            'Could not verify email. Please try again later.',
          );
      }
    }
  }

  async resendAttorneyConfirmationCode(email: string): Promise<any> {
    const secretHash = this.computeSecretHash(email);

    const command = new ResendConfirmationCodeCommand({
      ClientId: this.config.clientId,
      Username: email,
      SecretHash: secretHash,
    });

    try {
      const response = await this.cognitoClient.send(command);
      return {
        success: true,
        message: 'A new verification code has been sent to your email.',
        response: response,
      };
    } catch (error) {
      console.error('Error resending confirmation code:', error);

      switch (error.__type) {
        case 'UserNotFoundException':
          throw new NotFoundException('No account found with this email.');
        case 'InvalidParameterException':
          throw new BadRequestException('Invalid email address.');

        case 'NotAuthorizedException':
          throw new UnauthorizedException('Account has already been verified.');
        default:
          throw new InternalServerErrorException(
            'Could not send verification code. Please try again later.',
          );
      }
    }
  }

  async loginAttorneyUser(username: string, password: string): Promise<any> {
    const secretHash = this.computeSecretHash(username);

    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.config.clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        ...(this.config.clientSecret ? { SECRET_HASH: secretHash } : {}),
      },
    });

    try {
      const response = await this.cognitoClient.send(command);
      return {
        success: true,
        message: 'Login successful',
        ...response.AuthenticationResult,
      };
    } catch (error) {
      console.error('Failed to log in user:', error);

      switch (error.__type) {
        case 'NotAuthorizedException':
          throw new UnauthorizedException('Incorrect username or password.');
        case 'UserNotFoundException':
          throw new NotFoundException(
            'No account found with this email. Please register first.',
          );
        case 'UserNotConfirmedException':
          await this.resendAttorneyConfirmationCode(username);
          throw new UnauthorizedException({
            message:
              'Please verify your email before logging in. A new verification code has been sent.',
            requiresConfirmation: true,
            email: username,
          });
        case 'PasswordResetRequiredException':
          throw new UnauthorizedException(
            'Password reset required. Please check your email.',
          );
        default:
          throw new InternalServerErrorException(
            'Login failed. Please try again later.',
          );
      }
    }
  }



  async updateAttorneyUser(
    accessToken: string,
    updatedUserAttributes: UpdateUserProfileDto,
  ): Promise<any> {
    const userAttributes = Object.entries(updatedUserAttributes)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, value]) => value !== undefined)
      .map(([Name, Value]) => ({ Name, Value }));

    const command = new UpdateUserAttributesCommand({
      AccessToken: accessToken,
      UserAttributes: userAttributes,
    });

    try {
      const response = await this.cognitoClient.send(command);
      console.log('User profile updated successfully:', response);
      return response;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw new Error(`Update failed: ${error.message || error}`);
    }
  }

  async initiateAttorneyForgotPassword(email: string): Promise<any> {
    const secretHash = this.computeSecretHash(email);

    const command = new ForgotPasswordCommand({
      ClientId: this.config.clientId,
      Username: email,
      SecretHash: secretHash,
    });

    try {
      const response = await this.cognitoClient.send(command);
      return {
        success: true,
        message: 'Password reset code has been sent to your email.',
        response: response,
      };
    } catch (error) {
      console.error('Error initiating password reset:', error);

      switch (error.__type) {
        case 'UserNotFoundException':
          throw new NotFoundException('No account found with this email.');
        case 'InvalidParameterException':
          throw new BadRequestException('Invalid email address.');
        case 'LimitExceededException':
          throw new BadRequestException('Too many attempts. Please try again later.');
        case 'NotAuthorizedException':
          throw new UnauthorizedException('Password reset not allowed for this user.');
        default:
          throw new InternalServerErrorException(
            'Could not initiate password reset. Please try again later.',
          );
      }
    }
  }

  async confirmAttorneyForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<any> {
    const secretHash = this.computeSecretHash(email);

    const command = new ConfirmForgotPasswordCommand({
      ClientId: this.config.clientId,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
      SecretHash: secretHash,
    });

    try {
      const response = await this.cognitoClient.send(command);
      return {
        success: true,
        message: 'Password has been reset successfully.',
        response: response,
      };
    } catch (error) {
      console.error('Error confirming password reset:', error);

      switch (error.__type) {
        case 'CodeMismatchException':
          throw new BadRequestException(
            'Invalid verification code. Please try again.',
          );
        case 'ExpiredCodeException':
          throw new BadRequestException(
            'Verification code has expired. Please request a new code.',
          );
        case 'UserNotFoundException':
          throw new NotFoundException('No account found with this email.');
        case 'InvalidPasswordException':
          throw new BadRequestException(
            'Password does not meet the requirements. Password must contain at least 8 characters, including uppercase and lowercase letters, numbers, and special characters.',
          );
        case 'LimitExceededException':
          throw new BadRequestException('Too many attempts. Please try again later.');
        default:
          throw new InternalServerErrorException(
            'Could not reset password. Please try again later.',
          );
      }
    }
  }

  
}
