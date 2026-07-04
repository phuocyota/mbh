import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { USER_ROLE } from '../../../common/constant/constant';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ) {
    const authenticatedUser = super.handleRequest(
      err,
      user,
      info,
      context,
      status,
    );
    const request = context.switchToHttp().getRequest();

    if (
      authenticatedUser?.userType === USER_ROLE.SUPERVISOR &&
      !READ_ONLY_METHODS.has(request.method)
    ) {
      throw new ForbiddenException('SUPERVISOR chỉ có quyền xem');
    }

    return authenticatedUser;
  }
}
