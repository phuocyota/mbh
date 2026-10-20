import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { COMMON_STATUS, USER_ROLE } from '../../common/constant/constant';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));

describe('AuthService kitchen login', () => {
  const dto = {
    email: 'operator@example.test',
    password: 'test-password',
    deviceId: 'kitchen-device',
  };
  let service: AuthService;
  let user: any;
  let users: any;
  let employees: any;
  let jwt: any;

  beforeEach(() => {
    jest.clearAllMocks();
    user = {
      id: 'u1',
      email: dto.email,
      passwordHash: 'hash',
      role: USER_ROLE.CASHIER,
      status: COMMON_STATUS.ACTIVE,
      branchId: 'b1',
      fullName: 'Operator',
    };
    users = { findByEmail: jest.fn().mockImplementation(async () => user) };
    employees = { findOne: jest.fn().mockResolvedValue({ id: 'e1' }) };
    jwt = { sign: jest.fn().mockReturnValue('signed-token') };
    service = new AuthService(users, {} as any, jwt, employees);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  it.each([USER_ROLE.CASHIER, USER_ROLE.KITCHEN, USER_ROLE.HEAD_CHEF])(
    'allows %s and preserves its role and branch in the JWT',
    async (role) => {
      user.role = role;
      await expect(service.loginKitchen(dto)).resolves.toMatchObject({
        accessToken: 'signed-token',
        userType: role,
        branchId: 'b1',
        employeeId: 'e1',
        deviceId: dto.deviceId,
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userType: role,
          branchId: 'b1',
          userId: 'u1',
        }),
      );
      expect(employees.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', branchId: 'b1', status: 'working' },
      });
      expect(jwt.sign.mock.calls[0][0]).not.toHaveProperty('passwordHash');
    },
  );

  it.each([
    USER_ROLE.STUDENT,
    USER_ROLE.STAFF,
    USER_ROLE.MANAGER,
    USER_ROLE.ADMIN,
    USER_ROLE.SUPERVISOR,
    USER_ROLE.TEACHER,
  ])('rejects %s', async (role) => {
    user.role = role;
    await expect(service.loginKitchen(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it.each([
    'invalid password',
    'missing user',
    'inactive account',
    'missing branch',
    'missing working employee',
  ])('rejects cashier with %s', async (condition) => {
    if (condition === 'invalid password')
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    if (condition === 'missing user') user = null;
    if (condition === 'inactive account') user.status = 'INACTIVE';
    if (condition === 'missing branch') user.branchId = null;
    if (condition === 'missing working employee')
      employees.findOne.mockResolvedValue(null);
    await expect(service.loginKitchen(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
