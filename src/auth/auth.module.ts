import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenBlacklist, TokenBlacklistSchema } from './schemas/token-blacklist.schema';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'development-secret-min-32-chars',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION') || '6h',
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: TokenBlacklist.name, schema: TokenBlacklistSchema }]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
