/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { StripeService } from './Stripe.service';
import { PaymentController } from 'src/payment/payment.controller';
import { SupabaseService } from 'src/supabase/supabase.service';

@Module({
    imports: [],
    controllers: [PaymentController],
    providers: [StripeService, SupabaseService],
})
export class StripeModule {}
