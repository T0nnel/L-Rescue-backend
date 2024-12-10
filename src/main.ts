/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(bodyParser.json());
  
  // Enable CORS for specific origins
  app.enableCors({
    origin: 'https://nextjs-boilerplate-five-opal-54.vercel.app', // Your frontend's origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // If you need to send cookies or HTTP auth
  });
  
  
  await app.listen(3001);
}

bootstrap();
