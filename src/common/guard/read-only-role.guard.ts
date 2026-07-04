import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { USER_ROLE } from '../constant/constant';
import { JwtPayload } from '../interface/jwt-payload.interface';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class ReadOnlyRoleGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (READ_ONLY_METHODS.has(request.method)) {
      return true;
    }

    const authHeader = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return true;
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(
        token,
        this.configService.get('JWT_SECRET') || 'your-secret-key-here',
      ) as JwtPayload;

      if (decoded.userType === USER_ROLE.SUPERVISOR) {
        throw new ForbiddenException('SUPERVISOR chỉ có quyền xem');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
    }

    return true;
  }
}
