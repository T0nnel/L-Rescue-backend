/* eslint-disable prettier/prettier */
import {
    Body,
    Controller,
    Get,
    Post,
    Query,
    Req,
    Res,
   
  } from '@nestjs/common';
  import { Request, Response } from 'express';
import { StripeService } from 'src/stripe/Stripe.service';
import { DiscountTier } from 'src/types';

  @Controller('payments')
  export class PaymentController {
    constructor(private stripeService: StripeService) {}


    @Get('/verify-payment')
    async verifyPayment(@Query('session_id') sessionId: string){
      return this.stripeService.getSession(sessionId)
      
      
    }
  
    @Post('/create-checkout-session')
    async createCheckoutSession(@Body() body: { basePrice:number, discountTier: DiscountTier, attorneyId: string, customerEmail: string}) {
      const { basePrice, discountTier, customerEmail, attorneyId } = body;
      const session = await this.stripeService.createCheckoutSession( basePrice, discountTier, customerEmail, attorneyId );
      return { url: session.url };
    }
  
    @Post('/webhook')
    async handleWebhook(@Req() request: Request, @Res() response: Response) {
      console.log('calling webhook');
      
      return this.stripeService.handleWebhook(request, response);
    }
  
  
  }