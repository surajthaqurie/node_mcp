import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Override handleRequest to allow unauthenticated access.
   * If a valid JWT token is provided, req.user will be populated.
   * If no token or an invalid token is provided, req.user will be null (no exception thrown).
   */
  handleRequest<TUser = any>(_err: any, user: any): TUser {
    if (_err || !user) {
      return null as unknown as TUser;
    }
    return user as TUser;
  }
}
