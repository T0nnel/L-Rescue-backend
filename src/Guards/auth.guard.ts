/* eslint-disable prettier/prettier */
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import fetch from 'node-fetch';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        const refreshToken = request.headers['x-refresh-token'];

        if (!authHeader) {
            throw new UnauthorizedException('No token provided');
        }

        const idToken = authHeader.split(' ')[1];

        const verifier = CognitoJwtVerifier.create({
            userPoolId: process.env.COGNITO_USER_POOL_ID,
            tokenUse: "id", 
            clientId: process.env.COGNITO_CLIENT_ID,
        });

        try {
            const payload = await verifier.verify(idToken);
         
            
            request.user = payload;
            return true;
        } catch (error) {
            if (error.message.includes('Token is expired') && refreshToken) {
                const tokens = await this.refreshTokens(refreshToken);
                
                if (!tokens?.id_token) {
                    throw new UnauthorizedException('Invalid refresh token');
                }

                const payload = await verifier.verify(tokens.id_token);
                request.user = payload;
                request.newIdToken = tokens.id_token;
                return true;
            }

            throw new UnauthorizedException('Invalid token');
        }
    }

    private async refreshTokens(refreshToken: string): Promise<{ id_token?: string } | null> {
        try {
            const response = await fetch(`https://${process.env.COGNITO_DOMAIN}/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: process.env.COGNITO_CLIENT_ID,
                    refresh_token: refreshToken,
                }),
            });

            const data = await response.json();

            if (data.id_token) {
                return {
                    id_token: data.id_token
                };
            }

            return null;
        } catch (error) {
            console.error('Error refreshing tokens:', error);
            return null;
        }
    }
}