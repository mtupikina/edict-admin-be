import { Controller, Get, Post, Req, Res, UseGuards, UseFilters } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './auth.service';
import { AuthExceptionFilter } from './filters/auth-exception.filter';

@Controller('auth')
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { email: string; googleId: string };
    const { access_token } = await this.authService.login(user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    res.redirect(`${frontendUrl}/auth/callback?token=${access_token}`);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      await this.authService.logout(token);
    }
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: JwtPayload) {
    return { email: user.email };
  }
}
