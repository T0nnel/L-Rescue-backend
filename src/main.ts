/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://nextjs-boilerplate-five-opal-54.vercel.app',
      'http://localhost:3000',
      "https://www.legalrescue.ai",
      'https://main.d1d7vpftwumgan.amplifyapp.com',
      'https://dev.d1wv5zmnajfzzh.amplifyapp.com'     ,
      'https://africanblockchamp.io'                                  
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  await app.listen(3001);
}
bootstrap();
