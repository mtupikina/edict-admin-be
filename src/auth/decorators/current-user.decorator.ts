import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../auth.service';

/** Extracts JWT payload from the request (used by {@link CurrentUser} and unit tests). */
export function extractCurrentUserFromContext(ctx: ExecutionContext): JwtPayload {
  const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
  return request.user;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => extractCurrentUserFromContext(ctx),
);
