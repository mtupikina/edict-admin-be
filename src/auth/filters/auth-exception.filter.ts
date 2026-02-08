import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuthExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { url?: string }>();

    const isAuthCallback = request.url?.includes('/auth/google/callback');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

    if (isAuthCallback) {
      this.logger.warn(`Auth callback error: ${exception}`);
      response.redirect(`${frontendUrl}/auth/callback?error=unauthorized`);
      return;
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    response.status(status).json(message);
  }
}
