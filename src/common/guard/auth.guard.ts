import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator';
import { JwtPayload } from '../interface/jwt-payload.interface';
import { ERROR_MESSAGES } from '../constant/error-messages.constant';
import { USER_ROLE } from '../constant/constant';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.MISSING_AUTHORIZATION_HEADER,
      );
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const secret = process.env.JWT_SECRET || 'secretKey';
      const decoded = jwt.verify(token, secret) as JwtPayload;

      // Validate required fields
      if (!decoded.userId || !decoded.userType) {
        throw new UnauthorizedException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
      }
      // Attach user to request
      request.user = decoded;

      if (
        decoded.userType === USER_ROLE.SUPERVISOR &&
        !READ_ONLY_METHODS.has(request.method)
      ) {
        throw new ForbiddenException('SUPERVISOR chỉ có quyền xem');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_TOKEN);
    }
  }
}
