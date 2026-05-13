import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
    });
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
    return {
      accessToken: this.jwtService.sign(payload),
      userId: user.id,
      userType: user.role,
      deviceId: deviceId || 'default-device',
    };
  }

  async register(email: string, password: string, fullName: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      passwordHash: hashedPassword,
      fullName: fullName,
      role: 'STAFF',
      status: 'ACTIVE',
    });
    await this.userRepository.save(user);
    const { passwordHash, ...result } = user;
    return result;
  }

  async loginByCard(cardId: string, deviceId?: string) {
    const user = await this.userRepository.findOne({
      where: { cardId },
    });

    if (!user) {
      throw new UnauthorizedException('Card not found or not registered');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return this.login(userWithoutPassword, deviceId);
  }

  async loginStudent(dto: { cardId?: string; email?: string; password?: string; deviceId?: string }) {
    let user: User | null = null;

    // Login by cardId
    if (dto.cardId) {
      user = await this.userRepository.findOne({
        where: { cardId: dto.cardId },
      });
    }
    // Login by email/password
    else if (dto.email && dto.password) {
      user = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (user && !(await bcrypt.compare(dto.password, user.passwordHash))) {
        throw new UnauthorizedException('Invalid credentials');
      }
    } else {
      throw new UnauthorizedException('Please provide cardId or email with password');
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
}
