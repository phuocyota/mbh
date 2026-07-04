import { ForbiddenException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { USER_ROLE } from '../constant/constant';
import { ReadOnlyRoleGuard } from './read-only-role.guard';

describe('ReadOnlyRoleGuard', () => {
  const secret = 'test-secret';
  const configService = {
    get: jest.fn((key: string) => (key === 'JWT_SECRET' ? secret : undefined)),
  };
  const buildContext = (method: string, token?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          headers: token ? { authorization: `Bearer ${token}` } : {},
        }),
      }),
    }) as any;

  it('allows supervisor read requests', () => {
    const token = jwt.sign(
      { userId: 'user-id', userType: USER_ROLE.SUPERVISOR },
      secret,
    );
    const guard = new ReadOnlyRoleGuard(configService as any);

    expect(guard.canActivate(buildContext('GET', token))).toBe(true);
  });

  it('blocks supervisor write requests', () => {
    const token = jwt.sign(
      { userId: 'user-id', userType: USER_ROLE.SUPERVISOR },
      secret,
    );
    const guard = new ReadOnlyRoleGuard(configService as any);

    expect(() => guard.canActivate(buildContext('POST', token))).toThrow(
      ForbiddenException,
    );
  });

  it('allows manager write requests', () => {
    const token = jwt.sign(
      { userId: 'user-id', userType: USER_ROLE.MANAGER },
      secret,
    );
    const guard = new ReadOnlyRoleGuard(configService as any);

    expect(guard.canActivate(buildContext('POST', token))).toBe(true);
  });
});
