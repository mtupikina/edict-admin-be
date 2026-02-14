import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(
      process.env.NODE_ENV !== 'production'
        ? process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/edict'
        : process.env.MONGODB_URI || 'mongodb://localhost:27017/edict',
      { lazyConnection: true },
    ),
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
