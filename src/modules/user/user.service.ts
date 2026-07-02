import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '../../entities';
import { BaseService } from '../../common/sql/base.service';
import { CustomerService } from '../customer/customer.service';
import { COMMON_STATUS, USER_ROLE } from '../../common/constant/constant';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';

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

  async findAll(page?: any, size?: any, branchId?: string) {
    const pagination = normalizePagination(page, size);
    const where: FindOptionsWhere<User> = {};

    if (branchId) {
      where.branchId = branchId;
    }

    const [data, total] = await this.userRepository.findAndCount({
      where,
      relations: ['branch'],
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['branch'],
    });
  }

  async createStaffUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
  }): Promise<User> {
    const user = this.userRepository.create({
      ...data,
      role: USER_ROLE.STAFF,
      status: COMMON_STATUS.ACTIVE,
    });

    return this.userRepository.save(user);
  }

  async getMe(userId: string) {
    const customerInfo = await this.customerService.getUserCustomerInfo(userId);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['branch'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...customerInfo,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      address: user.address,
      province: user.province,
      district: user.district,
      birthday: user.birthday,
      note: user.note,
      avatar: user.avatar,
      branchId: user.branchId || null,
      branchName: user.branch?.name || null,
    };
  }

  async updateProfile(userId: string, data: {
    fullName?: string;
    phone?: string;
    address?: string;
    province?: string;
    district?: string;
    birthday?: string;
    note?: string;
  }) {
    const user = await this.findOne(userId);
    
    Object.assign(user, data);
    user.updatedBy = userId;
    
    return this.userRepository.save(user);
  }
}
