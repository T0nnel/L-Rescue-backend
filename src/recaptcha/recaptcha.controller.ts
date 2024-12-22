/* eslint-disable prettier/prettier */
import { Controller, Post, Body } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';

@Controller('recaptcha')
export class RecaptchaController {
  constructor(private readonly recaptchaService: RecaptchaService) {}

  @Post('/verify')
  async verify(@Body('token') token: string): Promise<{ success: boolean }> {
    const isVerified = await this.recaptchaService.verifyCaptcha(token);
    return { success: isVerified };
  }
}
