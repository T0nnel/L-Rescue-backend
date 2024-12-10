/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [WaitlistController],
  providers: [WaitlistService, SupabaseService],
})
export class WaitlistModule {}
