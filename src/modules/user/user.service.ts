import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities';
import { BaseService } from '../../common/sql/base.service';
import { CustomerService } from '../customer/customer.service';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private customerService: CustomerService,
  ) {
    super(userRepository);
  }

  protected getEntityName(): string {
    return 'User';
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async createStaffUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
  }): Promise<User> {
    const user = this.userRepository.create({
      ...data,
      role: 'STAFF',
      status: 'ACTIVE',
    });

    return this.userRepository.save(user);
  }

  async getMe(userId: string) {
    const customerInfo = await this.customerService.getUserCustomerInfo(userId);
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      email: user.email,
      ...customerInfo,
    };
  }
}
