import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { StudentCard } from '../../entities/student-card.entity';
import { Wallet } from '../../entities/wallet.entity';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';

@Injectable()
export class CustomerService extends BaseService<Customer> {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(StudentCard)
    private studentCardRepository: Repository<StudentCard>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
  ) {
    super(customerRepository);
  }

  protected getEntityName(): string {
    return 'Customer';
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

    if (studentCard.status !== 'ACTIVE') {
      throw new NotFoundException(
        `The ${cardUid} card is ${studentCard.status}`,
      );
    }

    const customer = await this.customerRepository.findOne({
      where: { id: studentCard.studentProfile.customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          'Customer',
          studentCard.studentProfile.customerId,
        ),
      );
    }

    const wallet = await this.walletRepository.findOne({
      where: { customerId: customer.id },
    });

    return {
      customer,
      card: {
        id: studentCard.id,
        cardUid: studentCard.cardUid,
        cardNumber: studentCard.cardNumber,
        status: studentCard.status,
      },
      wallet: wallet
        ? {
            id: wallet.id,
            balance: Number(wallet.balance),
            status: wallet.status,
          }
        : null,
    };
  }

  async searchCustomers(keyword: string, limit = 20) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    if (!keyword || !keyword.trim()) {
      return this.customerRepository.find({ take: safeLimit });
    }

    const qb = this.customerRepository.createQueryBuilder('c');
    qb.where('c.full_name ILIKE :kw', { kw: `%${keyword}%` })
      .orWhere('c.customer_code ILIKE :kw', { kw: `%${keyword}%` })
      .orWhere('c.phone ILIKE :kw', { kw: `%${keyword}%` })
      .orderBy('c.created_at', 'DESC')
      .take(safeLimit);

    return qb.getMany();
  }
}
