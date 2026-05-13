import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, Customer, Wallet, StudentProfile, StudentCard, School, Class } from 'src/entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(StudentProfile)
    private studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(StudentCard)
    private studentCardRepository: Repository<StudentCard>,
    @InjectRepository(School)
    private schoolRepository: Repository<School>,
    @InjectRepository(Class)
    private classRepository: Repository<Class>,
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
    // Find customer by userId
    const customer = await this.customerRepository.findOne({
      where: { userId },
      relations: ['studentProfile', 'wallet'],
    });

    console.log('DEBUG - userId:', userId);
    console.log('DEBUG - customer:', customer);
    console.log('DEBUG - customer?.studentProfile:', customer?.studentProfile);

    if (!customer) {
      return {
        school: null,
        class: null,
        walletBalance: 0,
      };
    }

    // Get actual school and class names
    const classId = customer.studentProfile?.classId;

    console.log('DEBUG - classId:', classId);

    let schoolName: string | null = null;
    let className: string | null = null;

    if (classId) {
      const classEntity = await this.classRepository.findOne({ where: { id: classId } });
      className = classEntity?.name || null;
      if (classEntity?.schoolId) {
        const school = await this.schoolRepository.findOne({ where: { id: classEntity.schoolId } });
        schoolName = school?.name || null;
      }
    }

    return {
      school: schoolName,
      class: className,
      studentCode: customer.studentProfile?.studentCode || null,
      studentFullName: customer.studentProfile?.fullName || customer.fullName,
      walletBalance: customer.wallet?.balance || 0,
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
    const studentCard = await this.studentCardRepository
      .createQueryBuilder('studentCard')
      .innerJoinAndSelect('studentCard.studentProfile', 'studentProfile')
      .innerJoinAndSelect('studentProfile.customer', 'customer')
      .where('(studentCard.cardUid = :cardId OR studentCard.cardNumber = :cardId)', {
        cardId,
      })
      .getOne();

    if (!studentCard) {
      throw new UnauthorizedException('Card not found or not registered');
    }

    if (studentCard.status !== 'ACTIVE') {
      throw new UnauthorizedException(`Student card is ${studentCard.status}`);
    }

    if (studentCard.expiredAt && studentCard.expiredAt < new Date()) {
      throw new UnauthorizedException('Student card is expired');
    }

    const customer = studentCard.studentProfile.customer;
    if (!customer?.userId) {
      throw new UnauthorizedException('Card is not linked to a user account');
    }

    const user = await this.userRepository.findOne({
      where: { id: customer.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
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
      const studentCard = await this.studentCardRepository
        .createQueryBuilder('studentCard')
        .innerJoinAndSelect('studentCard.studentProfile', 'studentProfile')
        .innerJoinAndSelect('studentProfile.customer', 'customer')
        .where('(studentCard.cardUid = :cardId OR studentCard.cardNumber = :cardId)', {
          cardId: dto.cardId,
        })
        .getOne();

      if (!studentCard) {
        throw new UnauthorizedException('Student card not found');
      }

      if (studentCard.status !== 'ACTIVE') {
        throw new UnauthorizedException(`Student card is ${studentCard.status}`);
      }

      if (studentCard.expiredAt && studentCard.expiredAt < new Date()) {
        throw new UnauthorizedException('Student card is expired');
      }

      const customer = studentCard.studentProfile.customer;
      if (!customer?.userId) {
        throw new UnauthorizedException('Student card is not linked to a user account');
      }

      user = await this.userRepository.findOne({
        where: { id: customer.userId },
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
