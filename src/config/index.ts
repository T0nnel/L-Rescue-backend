/* eslint-disable prettier/prettier */
import { BadRequestException, ValidationPipe } from "@nestjs/common";




export const ValidationConfig = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform:true,
    transformOptions: {
        enableImplicitConversion: true
    },
    exceptionFactory: (errors) => {
        const messages = errors.map((error) => ({
            field: error.property,
            errors: Object.values(error.constraints || {})
        }));
        return new BadRequestException({
            message: 'Validate failed',
            error: messages
        })
    }
    
})