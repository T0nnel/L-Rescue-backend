/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { RecaptchaController } from './recaptcha.controller';

@Module({
  controllers: [RecaptchaController],
  providers: [RecaptchaService],
})
export class RecaptchaModule {}
