import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'development-secret-min-32-chars',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayload> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      const isBlacklisted = await this.authService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been invalidated');
      }
    }
    return { email: payload.email, sub: payload.sub };
  }
}
