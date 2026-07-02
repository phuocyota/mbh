import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { Class } from '../../entities/class.entity';
import { StudentCard } from '../../entities/student-card.entity';
import { StudentProfile } from '../../entities/student-profile.entity';
import { Branch } from '../../entities/branch.entity';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { COMMON_STATUS } from '../../common/constant/constant';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class CustomerService extends BaseService<Customer> {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(StudentCard)
    private studentCardRepository: Repository<StudentCard>,
    @InjectRepository(StudentProfile)
    private studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(Class)
    private classRepository: Repository<Class>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
  ) {
    super(customerRepository);
  }

  protected getEntityName(): string {
    return 'Customer';
  }

  async findByUserId(userId: string): Promise<Customer | null> {
    return this.customerRepository.findOne({
      where: { userId },
    });
  }

  async findByUserIdWithStudentAndWallet(
    userId: string,
  ): Promise<Customer | null> {
    return this.customerRepository.findOne({
      where: { userId },
      relations: ['studentProfile', 'wallet'],
    });
  }

  async getUserCustomerInfo(userId: string) {
    const customer = await this.findByUserIdWithStudentAndWallet(userId);

    if (!customer) {
      throw new NotFoundException('Customer not found for this user');
    }

    const classEntity = customer.studentProfile?.classId
      ? await this.classRepository.findOne({
          where: { id: customer.studentProfile.classId },
        })
      : null;

    return {
      fullName: customer.studentProfile?.fullName || customer.fullName,
      phone: customer.phone,
      type: customer.type,
      classId: customer.studentProfile?.classId || null,
      schoolId: classEntity?.schoolId || null,
      studentCode: customer.studentProfile?.studentCode || null,
      walletBalance: customer.wallet?.balance || 0,
      walletStatus: customer.wallet?.status || null,
    };
  }

  async getStudentInfoByUserId(userId: string) {
    const customer = await this.findByUserIdWithStudentAndWallet(userId);

    if (!customer) {
      return {
        school: null,
        class: null,
        walletBalance: 0,
      };
    }

    const classId = customer.studentProfile?.classId;

    let schoolName: string | null = null;
    let className: string | null = null;
    let branchId: string | null = null;
    let branchName: string | null = null;

    if (classId) {
      const classEntity = await this.classRepository.findOne({
        where: { id: classId },
        relations: ['school'],
      });
      className = classEntity?.name || null;
      schoolName = classEntity?.school?.name || null;

      if (schoolName) {
        const branch = await this.branchRepository
          .createQueryBuilder('branch')
          .where('LOWER(branch.name) = LOWER(:schoolName)', { schoolName })
          .getOne();

        branchId = branch?.id || null;
        branchName = branch?.name || null;
      }
    }

    return {
      school: schoolName,
      class: className,
      branchId,
      branchName,
      studentCode: customer.studentProfile?.studentCode || null,
      studentFullName: customer.studentProfile?.fullName || customer.fullName,
      walletBalance: customer.wallet?.balance || 0,
    };
  }

  async findUserIdByActiveCard(cardId: string): Promise<string> {
    const studentCard = await this.studentCardRepository
      .createQueryBuilder('studentCard')
      .innerJoinAndSelect('studentCard.studentProfile', 'studentProfile')
      .innerJoinAndSelect('studentProfile.customer', 'customer')
      .where(
        '(studentCard.cardUid = :cardId OR studentCard.cardNumber = :cardId)',
        { cardId },
      )
      .getOne();

    if (!studentCard) {
      throw new NotFoundException('Student card not found');
    }

    if (studentCard.status !== COMMON_STATUS.ACTIVE) {
      throw new NotFoundException(`Student card is ${studentCard.status}`);
    }

    if (studentCard.expiredAt && studentCard.expiredAt < new Date()) {
      throw new NotFoundException('Student card is expired');
    }

    const userId = studentCard.studentProfile.customer?.userId;
    if (!userId) {
      throw new NotFoundException(
        'Student card is not linked to a user account',
      );
    }

    return userId;
  }

  async findUserIdByStudentCode(studentCode: string): Promise<string> {
    const studentProfile = await this.studentProfileRepository.findOne({
      where: { studentCode },
      relations: ['customer'],
    });

    if (!studentProfile) {
      throw new NotFoundException('Student with this code not found');
    }

    const userId = studentProfile.customer?.userId;
    if (!userId) {
      throw new NotFoundException(
        'Student profile is not linked to a user account',
      );
    }

    return userId;
  }

  async findByCardUid(cardUid: string) {
    const studentCard = await this.studentCardRepository
      .createQueryBuilder('studentCard')
      .innerJoinAndSelect('studentCard.studentProfile', 'studentProfile')
      .where(
        '(studentCard.cardUid = :cardUid OR studentCard.cardNumber = :cardUid)',
        { cardUid },
      )
      .getOne();

    if (!studentCard) {
      throw new NotFoundException(`The ${cardUid} card does not exist`);
    }

    if (studentCard.status !== COMMON_STATUS.ACTIVE) {
      throw new NotFoundException(
        `The ${cardUid} card is ${studentCard.status}`,
      );
    }

    const customer = await this.customerRepository.findOne({
      where: { id: studentCard.studentProfile.customerId },
      relations: ['wallet'],
    });

    if (!customer) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          'Customer',
          studentCard.studentProfile.customerId,
        ),
      );
    }

    return {
      customer,
      card: {
        id: studentCard.id,
        cardUid: studentCard.cardUid,
        cardNumber: studentCard.cardNumber,
        status: studentCard.status,
      },
      wallet: customer.wallet
        ? {
            id: customer.wallet.id,
            balance: Number(customer.wallet.balance),
            status: customer.wallet.status,
          }
        : null,
    };
  }

  async searchCustomers(
    keyword: string,
    page?: number | string,
    size?: number | string,
  ) {
    const pagination = normalizePagination(page, size);
    if (!keyword || !keyword.trim()) {
      const [data, total] = await this.customerRepository.findAndCount({
        skip: pagination.skip,
        take: pagination.size,
      });

      return toPaginationResponse(data, total, pagination.page, pagination.size);
    }

    const qb = this.customerRepository.createQueryBuilder('c');
    qb.where('c.full_name ILIKE :kw', { kw: `%${keyword}%` })
      .orWhere('c.customer_code ILIKE :kw', { kw: `%${keyword}%` })
      .orWhere('c.phone ILIKE :kw', { kw: `%${keyword}%` })
      .orderBy('c.created_at', 'DESC')
      .skip(pagination.skip)
      .take(pagination.size);

    const [data, total] = await qb.getManyAndCount();
    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }
}
