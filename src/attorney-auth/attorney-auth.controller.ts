/* eslint-disable prettier/prettier */
import { Body, Controller, Delete, HttpCode, HttpException, HttpStatus, Patch, Post } from '@nestjs/common';
import { AttorneyAuthService } from './attorney-auth.service';
import { AttorneySignUpDTO } from 'src/waitlist/dto/attorney_signUp_dto';
import { UpdateAttorneyDto } from 'src/waitlist/dto/attorney_Update_dto copy';

@Controller('attorney-auth')
export class AttorneyAuthController {
    constructor(private attorneyService:AttorneyAuthService){}

    @Post('/signUp')
    @HttpCode(HttpStatus.CREATED)
    async SingUpAttorney(@Body() body:{data:AttorneySignUpDTO }){
        const {data} = body
        try{
            const newUser = await this.attorneyService.signUpAttorney(data)
            if(newUser){
                return newUser
            }

        }catch(error:any){
            console.log(error);
            throw new HttpException("Internal server Error", HttpStatus.INTERNAL_SERVER_ERROR)      
        }

    }
    @Post('/signIn')
    @HttpCode(HttpStatus.OK)
    async signInAttorney(@Body() body: {email:string}){
        const {email} = body
       try{
        const attorneyUser = this.attorneyService.signInAttorney(email)
        if(!attorneyUser){
            throw new HttpException(`User with email ${email} was not found`, HttpStatus.NOT_FOUND)
        }
        return attorneyUser

       }catch(error:any){
        console.log(error);
        throw new HttpException("Internal server Error", HttpStatus.INTERNAL_SERVER_ERROR)
       }
    }
    @Patch('/update')
    async updateAttorney(@Body() body: {email:string, data:UpdateAttorneyDto}){
        const {email, data} = body
        try{
            const updatedUser = this.attorneyService.updateAttorneyDetails(email, data)
            if(!updatedUser){
                throw new HttpException(`User with email ${email} was not found`, HttpStatus.NOT_FOUND)
            }
            return updatedUser

        }catch(error:any){
            console.log(error);
            throw new HttpException("Internal server Error", HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }


    @Delete('/delete')
    async deleteAttorney(@Body() body:{email:string}){
        const {email} = body
        try{
           const resposne =  this.attorneyService.deleteAttorney(email)
           return resposne

        }catch(error:any){
            console.log(error.message);
            throw new HttpException(`Unbale to delete user, ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
            

        }
        
    }
}
