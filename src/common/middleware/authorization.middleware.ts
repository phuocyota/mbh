import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '../interface/jwt-payload.interface';
import { ERROR_MESSAGES } from '../constant/error-messages.constant';
import { USER_ROLE } from '../constant/constant';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class AuthorizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.MISSING_AUTHORIZATION_HEADER,
      );
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // --- Kiểm tra token phải có các trường bắt buộc ---
      if (!decoded.userId || !decoded.userType) {
        throw new UnauthorizedException(ERROR_MESSAGES.INVALID_TOKEN_STRUCTURE);
      }

      // --- Gắn user vào req ---
      (req as any).user = decoded;

      if (
        decoded.userType === USER_ROLE.SUPERVISOR &&
        !READ_ONLY_METHODS.has(req.method)
      ) {
        throw new ForbiddenException('SUPERVISOR chỉ có quyền xem');
      }

      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_TOKEN);
    }
  }
}
