/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { promisify } from 'util';

// TypeScript interfaces for better type safety
export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string | null;
  scopes: string[];
}

export interface ApplePrivateKeyConfig {
  teamId: string;
  keyId: string;
  privateKeyPath: string;
  clientId: string;
}

@Injectable()
export class IdpConfigService {
  private readonly logger = new Logger(IdpConfigService.name);
  private readonly providers: Record<string, ProviderConfig>;
  private readonly readFileAsync = promisify(fs.readFile);

  constructor(private readonly configService: ConfigService) {
    this.providers = this.initializeProviders();
    this.validateConfigurations();
  }

  private initializeProviders(): Record<string, ProviderConfig> {
    return {
      google: {
        clientId: this.configService.get<string>('GOOGLE_CLIENT_ID'),
        clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
        authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
        scopes: ['openid', 'email', 'profile']
      },
      microsoft: {
        clientId: this.configService.get<string>('MICROSOFT_CLIENT_ID'),
        clientSecret: this.configService.get<string>('MICROSOFT_CLIENT_SECRET'),
        authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
        scopes: ['openid', 'email', 'profile', 'User.Read']
      },
      apple: {
        clientId: this.configService.get<string>('APPLE_CLIENT_ID'),
        clientSecret: 'gfhdjdj',
        authEndpoint: 'https://appleid.apple.com/auth/authorize',
        tokenEndpoint: 'https://appleid.apple.com/auth/token',
        userInfoEndpoint: null, 
        scopes: ['name', 'email']
      }
    };
  }

  private validateConfigurations(): void {
    Object.entries(this.providers).forEach(([provider, config]) => {
      const missingFields = Object.entries(config)
        .filter(([key, value]) => {
          
          if (provider === 'apple' && key === 'userInfoEndpoint') return false;
          return !value;
        })
        .map(([key]) => key);

      if (missingFields.length > 0) {
        this.logger.warn(
          `Missing configuration for ${provider}: ${missingFields.join(', ')}`
        );
      }
    });
  }


  private getAppleConfig(): ApplePrivateKeyConfig {
    const config: ApplePrivateKeyConfig = {
      teamId: this.configService.get<string>('APPLE_TEAM_ID'),
      keyId: this.configService.get<string>('APPLE_KEY_ID'),
      privateKeyPath: this.configService.get<string>('APPLE_PRIVATE_KEY_PATH'),
      clientId: this.configService.get<string>('APPLE_CLIENT_ID')
    };

    
    const missingFields = Object.entries(config)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing Apple configuration fields: ${missingFields.join(', ')}`
      );
    }

    return config;
  }

  async refreshAppleClientSecret(): Promise<void> {
    try {
      const config = this.getAppleConfig();
      const privateKey = await this.readFileAsync(config.privateKeyPath);

      this.providers.apple.clientSecret = jwt.sign({}, privateKey, {
        algorithm: 'ES256',
        expiresIn: '24h',
        audience: 'https://appleid.apple.com',
        issuer: config.teamId,
        subject: config.clientId,
        keyid: config.keyId
      });

      this.logger.log('Apple client secret refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh Apple client secret:', error);
      throw new Error('Failed to refresh Apple client secret');
    }
  }

  getProviderConfig(provider: string): ProviderConfig {
    const normalizedProvider = provider.toLowerCase();
    const config = this.providers[normalizedProvider];

    if (!config) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    return config;
  }

  isProviderSupported(provider: string): boolean {
    return provider.toLowerCase() in this.providers;
  }

  getSupportedProviders(): string[] {
    return Object.keys(this.providers);
  }
}