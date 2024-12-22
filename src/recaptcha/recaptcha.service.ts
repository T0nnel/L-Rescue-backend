/* eslint-disable prettier/prettier */

import { Injectable, BadRequestException } from "@nestjs/common";
import axios from "axios";

/* eslint-disable @typescript-eslint/no-unused-vars */
@Injectable()
export class RecaptchaService {
  private readonly RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
  private readonly secretKey = process.env.RECAPTCHA_SECRET_KEY; // Ensure this is set in your .env file

  async verifyCaptcha(token: string): Promise<boolean> {
    if (!token) {
      throw new BadRequestException('reCAPTCHA token is required.');
    }

    try {
      const response = await axios.post(
        this.RECAPTCHA_VERIFY_URL,
        null, // No body for POST request
        {
          params: {
            secret: this.secretKey,
            response: token, // the token received from frontend
          },
        },
      );

      const { success } = response.data; // Handle the response properly
      if (!success) {
        throw new BadRequestException('Invalid reCAPTCHA token.');
      }

      return true;
    } catch (error) {
      throw new BadRequestException('Failed to verify reCAPTCHA.');
    }
  }
}
