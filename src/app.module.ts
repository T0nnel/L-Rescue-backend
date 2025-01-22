/* eslint-disable prettier/prettier */
// app.module.ts
import { Module } from '@nestjs/common';
import { WaitlistModule } from './waitlist/waitlist.module'; 
import { MailerModule } from './mailer/mailer.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';
import { DiscountService } from './discount/discount.service';
import { AttorneyAuthModule } from './attorney-auth/attorney-auth.module';
import { ConfigModule } from "@nestjs/config";
import { SupabaseService } from './supabase/supabase.service';
import { DiscountController } from './discount/discount.controller';
import { DiscountModule } from './discount/discount.module';
import { StripeModule } from './stripe/stripe.module';
import { PaymentModule } from './payment/payment.module';
import { CognitoModule } from './cognito/cognito.module';

@Module({
  imports: [WaitlistModule, MailerModule, RecaptchaModule, AttorneyAuthModule,
    ConfigModule.forRoot({
      isGlobal: true
    }),
    DiscountModule,
    StripeModule,
    PaymentModule,
    CognitoModule
  ],
  providers: [DiscountService, SupabaseService],
  controllers: [DiscountController], 
})
export class AppModule {}
