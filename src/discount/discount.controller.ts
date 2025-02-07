/* eslint-disable prettier/prettier */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { DiscountService } from './discount.service';

@Controller('discount')
export class DiscountController {
    constructor(private readonly discountService: DiscountService){}
    @Post('/discount_tiers')
    @HttpCode(HttpStatus.CREATED)
    async getDiscountTierForAttorney(@Body() body: {email:string, barLicenses: string[]}){
        const {email, barLicenses} = body
        const attorneyTier = this.discountService.getAttorneyTier(email, barLicenses)
        if(attorneyTier == null){
            return null
        }
        return attorneyTier

    }


}
