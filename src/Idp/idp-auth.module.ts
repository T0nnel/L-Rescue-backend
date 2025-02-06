/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdpAuthController } from './idp-auth.controller';
import { IdpConfigService } from './idp-config.service';

@Module({
  imports: [ConfigModule],
  controllers: [IdpAuthController],
  providers: [IdpConfigService],
  exports: [IdpConfigService],
})
export class IdpAuthModule {}