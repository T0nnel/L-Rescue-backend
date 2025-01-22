/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AttorneyAuthService } from './attorney-auth.service';
import { AttorneyAuthController } from './attorney-auth.controller';
import { SupabaseService } from 'src/supabase/supabase.service';
import { DiscountService } from 'src/discount/discount.service';
import { StripeModule } from 'src/stripe/stripe.module';
import { StripeService } from 'src/stripe/Stripe.service';
import { CognitoModule } from 'src/cognito/cognito.module';


@Module({
  imports: [StripeModule, CognitoModule],
  providers: [AttorneyAuthService, SupabaseService, StripeService, DiscountService],
  controllers: [AttorneyAuthController]
})
export class AttorneyAuthModule {}
