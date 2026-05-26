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
    const payload = {
      email: user.email,
      userId: user.id,
      userType: user.role,
      deviceId: deviceId || 'default-device',
    };

    const result: any = {
      accessToken: this.jwtService.sign(payload),
      userId: user.id,
      userType: user.role,
      deviceId: deviceId || 'default-device',
      fullName: user.fullName,
      avatar: user.avatar || null,
    };

    // Add student-specific info if role is STUDENT
    if (user.role === 'STUDENT') {
      const studentInfo = await this.getStudentInfo(user.id);
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

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return this.login(userWithoutPassword, deviceId);
  }

  async loginStudent(dto: {
    cardId?: string;
    email?: string;
    password?: string;
    deviceId?: string;
  }) {
    let user: User | null = null;

    // Login by cardId
    if (dto.cardId) {
      const userId = await this.findUserIdByCardForAuth(dto.cardId);
      user = await this.userService.findById(userId);
    }
    // Login by email/password
    else if (dto.email && dto.password) {
      user = await this.userService.findByEmail(dto.email);
      if (user && !(await bcrypt.compare(dto.password, user.passwordHash))) {
        throw new UnauthorizedException('Invalid credentials');
      }
    } else {
      throw new UnauthorizedException(
        'Please provide cardId or email with password',
      );
    }

    if (!user) {
      throw new UnauthorizedException('Student not found');
    }

    if (user.role !== 'STUDENT') {
      throw new UnauthorizedException('This endpoint is only for students');
    }

    if (user.status !== 'ACTIVE') {
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
  async loginCashier(dto: {
    email: string;
    password: string;
    deviceId?: string;
  }) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== 'CASHIER') {
      throw new UnauthorizedException('This endpoint is only for cashiers');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Cashier account is inactive');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return this.login(userWithoutPassword, dto.deviceId);
  }
}
