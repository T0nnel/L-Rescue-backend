/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(bodyParser.json());
  
  // Enable CORS for specific origins
  app.enableCors({
    origin: 'http://localhost:3000',  // Allow requests from this origin (frontend)
    methods: 'GET, POST, PUT, DELETE', // Allowed methods
    allowedHeaders: 'Content-Type, Authorization', // Allowed headers
  });
  
  
  await app.listen(3001);
}

bootstrap();
