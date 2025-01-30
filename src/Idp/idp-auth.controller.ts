/* eslint-disable prettier/prettier */
import { Controller, Get, Param, Res, Req, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { 
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import * as crypto from 'crypto';
import { IdpConfigService } from './idp-config.service';
import * as jwt from 'jsonwebtoken';


// Session type declaration
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

// Provider-specific interfaces
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

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  user?: AppleUser;
}

interface UserInfo {
  email: string;
  sub: string;
  name: string;
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
    });
    
    this.logger.log('Auth controller initialized with:', {
      region: this.configService.get<string>('REGION'),
      hasAppUrl: !!this.configService.get<string>('APP_URL'),
      hasFrontendUrl: !!this.configService.get<string>('FRONTEND_URL')
    });
  }

  private getProviderName(provider: string): string {
    const providerMap = {
      'google': 'Google',
      'microsoft': 'Microsoft',
      'apple': 'SignInWithApple'
    };
    
    const mappedName = providerMap[provider.toLowerCase()];
    if (!mappedName) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    return mappedName;
  }

  private computeSecretHash(username: string): string {
    const clientId = this.configService.get<string>('COGNITO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('COGNITO_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('Missing Cognito configuration');
    }
    
    const message = username + clientId;
    const hmac = crypto.createHmac('sha256', clientSecret);
    hmac.update(message);
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
  
      
      req.session.oauthState = state;
      req.session.codeVerifier = codeVerifier;
      req.session.provider = provider;
      req.session.nonce = nonce;
  
      const redirectUri = `${this.configService.get<string>('APP_URL')}/api/v1/auth/${provider}/callback`;
  
      const params = new URLSearchParams({
        client_id: providerConfig.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: providerConfig.scopes.join(' '),
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        nonce: nonce
      });

      
      if (provider.toLowerCase() === 'apple') {
        params.append('response_mode', 'form_post');
      }
  
      const authUrl = `${providerConfig.authEndpoint}?${params.toString()}`;
      this.logger.debug(`Generated auth URL for ${provider}`);
      
      return { authUrl };
    } catch (error) {
      this.logger.error('Error generating auth URL:', error);
      throw error;
    }
  }
  
  @Get(':provider/callback')
  async handleIdpCallback(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      const storedState = req.session.oauthState;
      const storedProvider = req.session.provider;
      const codeVerifier = req.session.codeVerifier;
   
  
      if (!code || !state || state !== storedState || provider !== storedProvider) {
        throw new Error('Invalid callback parameters');
      }
  
      const providerConfig = this.idpConfigService.getProviderConfig(provider);
      const redirectUri = `${this.configService.get<string>('APP_URL')}/api/v1/auth/${provider}/callback`;
  
      
      const tokenResponse = await fetch(providerConfig.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: providerConfig.clientId,
          client_secret: providerConfig.clientSecret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }).toString(),
      });
  
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        this.logger.error(`Token endpoint error: ${errorData}`);
        throw new Error('Failed to exchange code for tokens');
      }
  
      const tokens: TokenResponse = await tokenResponse.json();
  
      
      let userInfo: UserInfo;
      
      if (provider.toLowerCase() === 'apple') {
        const decodedToken = jwt.decode(tokens.id_token);
        if (!decodedToken || typeof decodedToken === 'string') {
          throw new Error('Invalid ID token format from Apple');
        }
        
        const appleToken = decodedToken as AppleIdToken;
        userInfo = {
          email: appleToken.email,
          sub: appleToken.sub,
          name: tokens.user?.name?.firstName 
            ? `${tokens.user.name.firstName} ${tokens.user.name.lastName}`
            : appleToken.email.split('@')[0]
        };
      } else {
        const userInfoResponse = await fetch(providerConfig.userInfoEndpoint, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });
  
        if (!userInfoResponse.ok) {
          const errorData = await userInfoResponse.text();
          this.logger.error(`User info endpoint error: ${errorData}`);
          throw new Error('Failed to get user info');
        }
  
        const providerUserInfo = await userInfoResponse.json();
        
        if (!providerUserInfo.email || !providerUserInfo.sub || !providerUserInfo.name) {
          this.logger.error('Missing required user info fields:', providerUserInfo);
          throw new Error('Missing required user info fields from provider');
        }

        userInfo = {
          email: providerUserInfo.email,
          sub: providerUserInfo.sub,
          name: providerUserInfo.name
        };
      }

     
      let userExists = false;
      try {
        await this.cognitoClient.send(
          new AdminGetUserCommand({
            UserPoolId: this.configService.get('COGNITO_USER_POOL_ID'),
            Username: userInfo.email,
          }),
        );
        userExists = true;
      } catch (error) {
        if (error.name !== 'UserNotFoundException') {
          throw error;
        }
      }

      if (!userExists) {
        
        const password = crypto.randomBytes(32).toString('hex');
        
        await this.cognitoClient.send(
          new AdminCreateUserCommand({
            UserPoolId: this.configService.get('COGNITO_USER_POOL_ID'),
            Username: userInfo.email,
            UserAttributes: [
              { Name: 'email', Value: userInfo.email },
              { Name: 'name', Value: userInfo.name },
              { Name: 'email_verified', Value: 'true' },
            ],
            MessageAction: 'SUPPRESS',
            TemporaryPassword: password
          })
        );

        
        await this.cognitoClient.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: this.configService.get('COGNITO_USER_POOL_ID'),
            Username: userInfo.email,
            Password: password,
            Permanent: true
          })
        );
      }

      
      delete req.session.oauthState;
      delete req.session.codeVerifier;
      delete req.session.provider;
      delete req.session.nonce;

     
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const frontendCallback = `${frontendUrl}/attorney/emailSignUp`;
      
      const callbackParams = new URLSearchParams({
        access_token: tokens.access_token,
        id_token: tokens.id_token,
        provider: provider,
        email: userInfo.email,  
      });

      res.redirect(`${frontendCallback}?${callbackParams.toString()}`);

    } catch (error) {
      this.logger.error(`Error in ${provider} callback:`, error);
      const errorMessage = encodeURIComponent(error.message || 'Unknown error');
      res.redirect(`/error?message=Authentication failed with ${provider}&error=${errorMessage}`);
    }
  }
}