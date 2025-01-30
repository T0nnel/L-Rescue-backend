/* eslint-disable prettier/prettier */
import {  Module } from '@nestjs/common';

import { CognitoService } from './cognito.service';

@Module({
  providers: [CognitoService,
    {
      provide: 'COGNITO_CONFIG',
      useFactory: () => ({
          userPoolId: process.env.COGNITO_USER_POOL_ID,
          clientId: process.env.COGNITO_CLIENT_ID,
          clientSecret: process.env.COGNITO_CLIENT_SECRET,
          awsRegion: process.env.REGION ,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,  
         secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY, 
      })
  }
  ],
  exports: [CognitoService],
})
export class CognitoModule {}
