/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Param,
  Req,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
  Post,
  Body
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import * as crypto from 'crypto';
import { IdpConfigService } from './idp-config.service';

declare module 'express' {
  interface Request {
    session: {
      oauthState?: string;
      codeVerifier?: string;
      provider?: string;
      nonce?: string;
      authType: string
    };
  }
}

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
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

 

  @Get(':provider')
  async getAuthUrl(
    @Param('provider') provider: string,
    @Param('authType') authType: 'signUp' | 'login',
    @Req() req: Request,
  ) {
    try {
      const providerConfig = this.idpConfigService.getProviderConfig(provider);

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

      const redirectUri = `${this.configService.get<string>('FRONTEND_URL')}/auth/callback`;

      const params = new URLSearchParams({
        client_id: this.configService.get<string>('COGNITO_CLIENT_ID'),
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: providerConfig.scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        nonce,
        identity_provider: this.getProviderName(provider),
        idp_identifier: 'sub',
        username_attributes: 'email'
      });

      if (provider.toLowerCase() === 'apple') {
        params.append('response_mode', 'form_post');
      }

      const authUrl = `${this.configService.get('COGNITO_DOMAIN')}/oauth2/authorize?${params.toString()}`;

      return {
        authUrl,
        state,
        codeVerifier,
        nonce,
        provider
      };
    } catch (error) {
      this.logger.error('Error generating auth URL:', error);
      throw new InternalServerErrorException(
        `Failed to generate authentication URL: ${error.message}`
      );
    }
  }

  @Post('token')
  async handleTokenExchange(
    @Body() body: {
      code: string,
      redirect_uri: string,
      codeVerifier: string,
      provider: string
    }
  ) {
    try {
      const { code, redirect_uri, codeVerifier, provider } = body;

      if (!code || !redirect_uri || !provider) {
        throw new UnauthorizedException('Missing required parameters');
      }

      // Get tokens - the Lambda trigger will handle any user linking
      const tokens = await this.getTokens(code, redirect_uri, codeVerifier);
      const userInfo = await this.getUserInfo(tokens.access_token);

      return {
        ...tokens,
        email: userInfo.email,
        cognitoSub: userInfo.sub
      };
    } catch (error) {
      this.logger.error('Error in token exchange:', error);
      throw new UnauthorizedException(error.message || 'Token exchange failed');
    }
  }

  private async getTokens(code: string, redirectUri: string, codeVerifier: string): Promise<TokenResponse> {
    try {
      const tokenEndpoint = `${this.configService.get('COGNITO_DOMAIN')}/oauth2/token`;
      const clientId = this.configService.get('COGNITO_CLIENT_ID');
      const clientSecret = this.configService.get('COGNITO_CLIENT_SECRET');

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      });

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Token exchange failed: ${errorData}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error('Error getting tokens:', error);
      throw new Error(`Failed to get tokens: ${error.message}`);
    }
  }

  private async getUserInfo(accessToken: string) {
    try {
      const userinfoEndpoint = `${this.configService.get('COGNITO_DOMAIN')}/oauth2/userInfo`;
      const response = await fetch(userinfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get user info from userinfo endpoint');
      }

      return response.json();
    } catch (error) {
      this.logger.error('Error getting user info:', error);
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  private cleanupSession(req: Request): void {
    delete req.session.oauthState;
    delete req.session.codeVerifier;
    delete req.session.provider;
    delete req.session.nonce;
  }
}
  
