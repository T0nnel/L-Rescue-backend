/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AttorneyAuthService } from './attorney-auth.service';
import { AttorneyAuthController } from './attorney-auth.controller';
import { SupabaseService } from 'src/supabase/supabase.service';
import { DiscountService } from 'src/discount/discount.service';

@Module({
  providers: [AttorneyAuthService, SupabaseService, DiscountService],
  controllers: [AttorneyAuthController]
})
export class AttorneyAuthModule {}
