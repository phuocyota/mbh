import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Customer, StudentProfile, Wallet } from '../../entities';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(StudentProfile)
    private studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
  ) {
    super(userRepository);
  }

  protected getEntityName(): string {
    return 'User';
  }

  async getMe(userId: string) {
    // Find customer by userId
    const customer = await this.customerRepository.findOne({
      where: { userId },
      relations: ['studentProfile', 'wallet'],
    });

    if (!customer) {
      throw new NotFoundException('Customer not found for this user');
    }

    // Get user info
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    return {
      userId: user?.id,
      fullName: customer.fullName,
      email: user?.email,
      phone: customer.phone,
      type: customer.type,
      classId: customer.studentProfile?.classId || null,
      schoolId: customer.studentProfile?.schoolId || null,
      studentCode: customer.studentProfile?.studentCode || null,
      walletBalance: customer.wallet?.balance || 0,
      walletStatus: customer.wallet?.status || null,
    };
  }
}
