import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { TokenBlacklist, TokenBlacklistDocument } from './schemas/token-blacklist.schema';

export interface JwtPayload {
  email: string;
  sub: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @InjectModel(TokenBlacklist.name)
    private readonly tokenBlacklistModel: Model<TokenBlacklistDocument>,
  ) {}

  async validateGoogleUser(profile: {
    emails?: { value: string }[];
    id: string;
  }): Promise<{ email: string; googleId: string } | null> {
    const email = profile.emails?.[0]?.value;
    if (!email) return null;

    const isAllowed = await this.usersService.isUserAllowed(email);
    if (!isAllowed) return null;

    return { email, googleId: profile.id };
  }

  async login(user: { email: string; googleId: string }): Promise<{ access_token: string }> {
    const payload: JwtPayload = { email: user.email, sub: user.googleId };
    const access_token = this.jwtService.sign(payload);
    return { access_token };
  }

  async logout(token: string): Promise<void> {
    try {
      const decoded = this.jwtService.verify<JwtPayload>(token);
      const expiresAt = decoded.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 6 * 60 * 60 * 1000);
      await this.tokenBlacklistModel.create({ token, expiresAt });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const found = await this.tokenBlacklistModel.findOne({ token }).exec();
    return !!found;
  }
}
