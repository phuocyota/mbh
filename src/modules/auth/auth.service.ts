import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from 'src/entities';
import { UserService } from '../user/user.service';
import { CustomerService } from '../customer/customer.service';
import {
  ADMIN_LOGIN_ROLES,
  COMMON_STATUS,
  USER_ROLE,
} from '../../common/constant/constant';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private customerService: CustomerService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, deviceId?: string) {
    const studentInfo =
      user.role === USER_ROLE.STUDENT
        ? await this.getStudentInfo(user.id)
        : {};
    const resolvedBranchId = user.branchId || (studentInfo as any).branchId;
    const resolvedBranchName =
      user.branch?.name || (studentInfo as any).branchName;
    const branchInfo = resolvedBranchId
      ? {
          branchId: resolvedBranchId,
          branchName: resolvedBranchName || null,
        }
      : {};

    const payload = {
      email: user.email,
      userId: user.id,
      userType: user.role,
      deviceId: deviceId || 'default-device',
      ...branchInfo,
    };

    const result: any = {
      accessToken: this.jwtService.sign(payload),
      userId: user.id,
      userType: user.role,
      deviceId: deviceId || 'default-device',
      fullName: user.fullName,
      avatar: user.avatar || null,
      ...branchInfo,
    };

    if (user.role === USER_ROLE.STUDENT) {
      Object.assign(result, studentInfo);
    }

    return result;
  }

  async getStudentInfo(userId: string) {
    return this.customerService.getStudentInfoByUserId(userId);
  }

  async register(email: string, password: string, fullName: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userService.createStaffUser({
      email,
      passwordHash: hashedPassword,
      fullName,
    });
    const { passwordHash, ...result } = user;
    return result;
  }

  async loginByCard(cardId: string, deviceId?: string) {
    const userId = await this.findUserIdByCardForAuth(cardId);
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== COMMON_STATUS.ACTIVE) {
      throw new UnauthorizedException('User account is inactive');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return this.login(userWithoutPassword, deviceId);
  }

  async loginStudent(dto: {
    cardId?: string;
    username?: string;
    password?: string;
    deviceId?: string;
  }) {
    let user: User | null = null;

    // Login by cardId (no password needed)
    if (dto.cardId) {
      const userId = await this.findUserIdByCardForAuth(dto.cardId);
      user = await this.userService.findById(userId);
    }
    // Login by username/password (username can be email or studentCode)
    else if (dto.username && dto.password) {
      // Check if username is email (contains @)
      if (dto.username.includes('@')) {
        user = await this.userService.findByEmail(dto.username);
      } else {
        // Treat as studentCode
        const userId = await this.findUserIdByStudentCodeForAuth(dto.username);
        user = await this.userService.findById(userId);
      }
      if (user && !(await bcrypt.compare(dto.password, user.passwordHash))) {
        throw new UnauthorizedException('Invalid credentials');
      }
    } else {
      throw new UnauthorizedException(
        'Please provide cardId or username with password',
      );
    }

    if (!user) {
      throw new UnauthorizedException('Student not found');
    }

    if (user.role !== USER_ROLE.STUDENT) {
      throw new UnauthorizedException('This endpoint is only for students');
    }

    if (user.status !== COMMON_STATUS.ACTIVE) {
      throw new UnauthorizedException('Student account is inactive');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return this.login(userWithoutPassword, dto.deviceId);
  }

  private async findUserIdByCardForAuth(cardId: string): Promise<string> {
    try {
      return await this.customerService.findUserIdByActiveCard(cardId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  private async findUserIdByStudentCodeForAuth(studentCode: string): Promise<string> {
    try {
      return await this.customerService.findUserIdByStudentCode(studentCode);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
  async loginAdmin(dto: { email: string; password: string }) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!ADMIN_LOGIN_ROLES.includes(user.role as any)) {
      throw new UnauthorizedException('This endpoint is only for admin/manager/staff');
    }

    if (user.status !== COMMON_STATUS.ACTIVE) {
      throw new UnauthorizedException('Account is inactive');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return this.login(userWithoutPassword);
  }

  async loginCashier(dto: {
    email: string;
    password: string;
    deviceId?: string;
  }) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== USER_ROLE.CASHIER) {
      throw new UnauthorizedException('This endpoint is only for cashiers');
    }

    if (user.status !== COMMON_STATUS.ACTIVE) {
      throw new UnauthorizedException('Cashier account is inactive');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return this.login(userWithoutPassword, dto.deviceId);
  }
}
