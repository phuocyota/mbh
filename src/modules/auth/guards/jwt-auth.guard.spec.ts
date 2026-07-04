import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { USER_ROLE } from '../../../common/constant/constant';

describe('JwtAuthGuard', () => {
  const buildContext = (method: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method }),
      }),
    }) as any;

  it('allows supervisor to read', () => {
    const guard = new JwtAuthGuard();
    const user = { userType: USER_ROLE.SUPERVISOR };

    expect(guard.handleRequest(null, user, null, buildContext('GET'))).toBe(
      user,
    );
  });

  it('blocks supervisor from mutating', () => {
    const guard = new JwtAuthGuard();
    const user = { userType: USER_ROLE.SUPERVISOR };

    expect(() =>
      guard.handleRequest(null, user, null, buildContext('POST')),
    ).toThrow(ForbiddenException);
  });

  it('allows manager to mutate', () => {
    const guard = new JwtAuthGuard();
    const user = { userType: USER_ROLE.MANAGER };

    expect(guard.handleRequest(null, user, null, buildContext('POST'))).toBe(
      user,
    );
  });
});
