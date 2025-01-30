/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Param,
  Res,
  Req,
  Logger,
  UnauthorizedException,
  InternalServerErrorException
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AuthenticationResultType,
  AdminCreateUserCommand,
  AdminLinkProviderForUserCommand
} from '@aws-sdk/client-cognito-identity-provider';
import * as crypto from 'crypto';
import { IdpConfigService } from './idp-config.service';
import * as jwt from 'jsonwebtoken';

// Session type declaration for Express
declare module 'express' {
  interface Request {
    session: {
      oauthState?: string;
      codeVerifier?: string;
      provider?: string;
      nonce?: string;
    };
  }
}

// Provider configuration interface
interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scopes: string[];
}

// Apple-specific interfaces
interface AppleIdToken {
  email: string;
  email_verified: boolean;
  sub: string;
  is_private_email?: boolean;
}

interface AppleUser {
  name?: {
    firstName: string;
    lastName: string;
  };
}

// Generic token response interface
interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  user?: AppleUser;
  expires_in?: number;
  token_type?: string;
}

// User information interface
interface UserInfo {
  email: string;
  sub: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

// Error types
class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

@Controller('auth')
export class IdpAuthController {
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly logger = new Logger(IdpAuthController.name);

  constructor(
    private readonly idpConfigService: IdpConfigService,
    private readonly configService: ConfigService,
  ) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.configService.get<string>('REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.logger.log('Auth controller initialized', {
      region: this.configService.get<string>('REGION'),
      hasAppUrl: !!this.configService.get<string>('APP_URL'),
      hasFrontendUrl: !!this.configService.get<string>('FRONTEND_URL')
    });
  }

  private getProviderName(provider: string): string {
    const providerMap: { [key: string]: string } = {
      'google': 'Google',
      'microsoft': 'Microsoft',
      'apple': 'SignInWithApple',
      'facebook': 'Facebook'
    };

    const mappedName = providerMap[provider.toLowerCase()];
    if (!mappedName) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    return mappedName;
  }

  private computeSecretHash(username: string): string {
    const clientSecret = this.configService.get<string>('COGNITO_CLIENT_SECRET');
    const clientId = this.configService.get<string>('COGNITO_CLIENT_ID');

    if (!clientSecret || !clientId) {
      throw new Error('Missing Cognito client configuration');
    }

    const hmac = crypto.createHmac('sha256', clientSecret);
    hmac.update(username + clientId);
    return hmac.digest('base64');
  }

  @Get(':provider')
  async getAuthUrl(
    @Param('provider') provider: string,
    @Req() req: Request,
  ) {
    try {
      const providerConfig = this.idpConfigService.getProviderConfig(provider);

      // Generate security parameters
      const state = crypto.randomBytes(32).toString('hex');
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      const nonce = crypto.randomBytes(16).toString('hex');

      // Store in session
      req.session.oauthState = state;
      req.session.codeVerifier = codeVerifier;
      req.session.provider = provider;
      req.session.nonce = nonce;

      const appUrl = this.configService.get<string>('APP_URL');
      if (!appUrl) {
        throw new Error('APP_URL is not configured');
      }

      const redirectUri = `${appUrl}/api/v1/auth/${provider}/callback`;

      const params = new URLSearchParams({
        client_id: providerConfig.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: providerConfig.scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        nonce,
      });

      // Special handling for Apple
      if (provider.toLowerCase() === 'apple') {
        params.append('response_mode', 'form_post');
      }

      const authUrl = `${providerConfig.authEndpoint}?${params.toString()}`;
      this.logger.debug(`Generated auth URL for ${provider}`);

      return { authUrl };
    } catch (error) {
      this.logger.error('Error generating auth URL:', error);
      throw new InternalServerErrorException(
        `Failed to generate authentication URL: ${error.message}`
      );
    }
  }

  @Get(':provider/callback')
  async handleIdpCallback(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Validate callback parameters
      const code = req.query.code as string;
      const state = req.query.state as string;
      const storedState = req.session.oauthState;
      const storedProvider = req.session.provider;
      const codeVerifier = req.session.codeVerifier;

      if (!code || !state || state !== storedState || provider !== storedProvider) {
        throw new UnauthorizedException('Invalid callback parameters');
      }

      const providerConfig = this.idpConfigService.getProviderConfig(provider);
      const redirectUri = `${this.configService.get<string>('APP_URL')}/api/v1/auth/${provider}/callback`;

      // Get tokens from IDP
      const tokens = await this.getIdpTokens(
        provider,
        code,
        redirectUri,
        codeVerifier,
        providerConfig
      );

      // Get user info
      const userInfo = await this.getUserInfo(provider, tokens, providerConfig);

      // Authenticate with Cognito
      const cognitoTokens = await this.authenticateWithCognito(
        provider,
        userInfo,
        tokens.id_token
      );

      // Clean up session
      this.cleanupSession(req);

      // Redirect with tokens
      await this.redirectWithTokens(res, cognitoTokens, userInfo);

    } catch (error) {
      this.logger.error(`Error in ${provider} callback:`, error);
      await this.handleCallbackError(res, provider, error);
    }
  }

  private async getIdpTokens(
    provider: string,
    code: string,
    redirectUri: string,
    codeVerifier: string,
    providerConfig: ProviderConfig
  ): Promise<TokenResponse> {
    try {
      const tokenResponse = await fetch(providerConfig.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: providerConfig.clientId,
          client_secret: providerConfig.clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        this.logger.error(`Token endpoint error: ${errorData}`);
        throw new AuthenticationError(`Failed to exchange code for tokens: ${errorData}`);
      }

      return tokenResponse.json();
    } catch (error) {
      this.logger.error('Error getting IDP tokens:', error);
      throw new AuthenticationError(`Failed to get IDP tokens: ${error.message}`);
    }
  }

  private async getUserInfo(
    provider: string,
    tokens: TokenResponse,
    providerConfig: ProviderConfig
  ): Promise<UserInfo> {
    try {
      if (provider.toLowerCase() === 'apple') {
        return this.getAppleUserInfo(tokens);
      }

      const userInfoResponse = await fetch(providerConfig.userInfoEndpoint, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        const errorData = await userInfoResponse.text();
        this.logger.error(`User info endpoint error: ${errorData}`);
        throw new AuthenticationError('Failed to get user info');
      }

      const userInfo = await userInfoResponse.json();
      this.validateUserInfo(userInfo);

      return {
        email: userInfo.email,
        sub: userInfo.sub,
        name: userInfo.name,
        picture: userInfo.picture,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
      };
    } catch (error) {
      this.logger.error('Error getting user info:', error);
      throw new AuthenticationError(`Failed to get user info: ${error.message}`);
    }
  }

  private getAppleUserInfo(tokens: TokenResponse): UserInfo {
    try {
      const decodedToken = jwt.decode(tokens.id_token);
      if (!decodedToken || typeof decodedToken === 'string') {
        throw new Error('Invalid ID token format from Apple');
      }

      const appleToken = decodedToken as AppleIdToken;
      return {
        email: appleToken.email,
        sub: appleToken.sub,
        name: tokens.user?.name?.firstName
          ? `${tokens.user.name.firstName} ${tokens.user.name.lastName}`
          : appleToken.email.split('@')[0],
      };
    } catch (error) {
      this.logger.error('Error parsing Apple user info:', error);
      throw new AuthenticationError(`Failed to parse Apple user info: ${error.message}`);
    }
  }

  private validateUserInfo(userInfo: any) {
    const requiredFields = ['email', 'sub', 'name'];
    const missingFields = requiredFields.filter(field => !userInfo[field]);

    if (missingFields.length > 0) {
      this.logger.error('Missing required user info fields:', {
        missingFields,
        receivedFields: Object.keys(userInfo),
      });
      throw new Error(`Missing required user info fields: ${missingFields.join(', ')}`);
    }
  }

  private async authenticateWithCognito(
    provider: string,
    userInfo: UserInfo,
    idToken: string
  ): Promise<AuthenticationResultType> {
    try {
      // First, try to create or confirm the user exists
      try {
        await this.cognitoClient.send(
          new AdminCreateUserCommand({
            UserPoolId: this.configService.get('COGNITO_USER_POOL_ID'),
            Username: userInfo.email,
            MessageAction: 'SUPPRESS',
            UserAttributes: [
              {
                Name: 'email',
                Value: userInfo.email,
              },
              {
                Name: 'email_verified',
                Value: 'true',
              },
              {
                Name: 'name',
                Value: userInfo.name,
              },
            ],
          })
        );
      } catch (error) {
        // If user already exists, that's fine
        if (error.name !== 'UsernameExistsException') {
          throw error;
        }
      }
  
      // Link the social identity if not already linked
      try {
        await this.cognitoClient.send(
          new AdminLinkProviderForUserCommand({
            UserPoolId: this.configService.get('COGNITO_USER_POOL_ID'),
            DestinationUser: {
              ProviderAttributeValue: userInfo.email,
              ProviderName: 'Cognito',
            },
            SourceUser: {
              ProviderAttributeName: 'Cognito_Subject',
              ProviderAttributeValue: userInfo.sub,
              ProviderName: this.getProviderName(provider),
            },
          })
        );
      } catch (error) {
        // If already linked, that's fine
        if (error.name !== 'ResourceConflictException') {
          throw error;
        }
      }
  
      // Now get the tokens
      const command = new AdminInitiateAuthCommand({
        UserPoolId: this.configService.get('COGNITO_USER_POOL_ID'),
        ClientId: this.configService.get('COGNITO_CLIENT_ID'),
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
          USERNAME: userInfo.email,
          TOKEN: idToken,
          SECRET_HASH: this.computeSecretHash(userInfo.email),
        },
      });
  
      const response = await this.cognitoClient.send(command);
      
      if (!response.AuthenticationResult) {
        throw new Error('No authentication result from Cognito');
      }
  
      return response.AuthenticationResult;
    } catch (error) {
      this.logger.error('Cognito authentication error:', error);
      throw new AuthenticationError(
        `Failed to authenticate with Cognito: ${error.message}`
      );
    }
  }

  private cleanupSession(req: Request): void {
    delete req.session.oauthState;
    delete req.session.codeVerifier;
    delete req.session.provider;
    delete req.session.nonce;
  }

  private async redirectWithTokens(
    res: Response,
    cognitoTokens: AuthenticationResultType,
    userInfo: UserInfo
  ): Promise<void> {
    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      if (!frontendUrl) {
        throw new Error('FRONTEND_URL is not configured');
      }

      const frontendCallback = `${frontendUrl}/auth/callback`;
      const params = new URLSearchParams({
        access_token: cognitoTokens.AccessToken,
        refresh_token: cognitoTokens.RefreshToken,
        id_token: cognitoTokens.IdToken,
        email: userInfo.email,
      });

      res.redirect(`${frontendCallback}?${params.toString()}`);
    } catch (error) {
      this.logger.error('Error redirecting with tokens:', error);
      throw new AuthenticationError(
        `Failed to redirect with tokens: ${error.message}`
      );
    }
  }

  private async handleCallbackError(
    res: Response,
    provider: string,
    error: Error
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const errorMessage = encodeURIComponent(error.message || 'Unknown error');
    const errorPath = `${frontendUrl}/auth/error`;

    res.redirect(
      `${errorPath}?message=Authentication failed with ${provider}&error=${errorMessage}`
    );
  }
}