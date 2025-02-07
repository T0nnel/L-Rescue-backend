/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { StripeModule } from 'src/stripe/stripe.module';
import { PaymentController } from './payment.controller';
import { StripeService } from 'src/stripe/Stripe.service';
import { SupabaseService } from 'src/supabase/supabase.service';

@Module({
    imports: [StripeModule],
    controllers: [PaymentController],
    providers: [StripeService, SupabaseService],
})
export class PaymentModule {}
