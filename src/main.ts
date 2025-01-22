/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express'
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);


  app.useGlobalPipes(new ValidationPipe({
    whitelist:true,
    transform:true,
    forbidNonWhitelisted:true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    validationError: {
      target: false,
      value: false,
    },
  }))

  app.setGlobalPrefix('/api/v1')

  app.enableCors({
    origin: [
      'https://nextjs-boilerplate-five-opal-54.vercel.app',
      'http://localhost:3000',
      "https://www.legalrescue.ai",
      'https://main.d1d7vpftwumgan.amplifyapp.com',
      'https://dev.d1wv5zmnajfzzh.amplifyapp.com'                                       
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });
  app.use('/payments/webhook', express.raw({ type: 'application/json' }));

  await app.listen(3001);
}
bootstrap();
