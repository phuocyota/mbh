import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { Card } from '../../entities/card.entity';
import { Wallet } from '../../entities/wallet.entity';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';

@Injectable()
export class CustomerService extends BaseService<Customer> {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
  ) {
    super(customerRepository);
  }

  protected getEntityName(): string {
    return 'Customer';
  }

  /**
   * Tìm customer theo card UID (NFC/RFID).
   * Trả về customer kèm số dư ví (nếu có) để tiện flow quẹt thẻ tại POS.
   */
  async findByCardUid(cardUid: string) {
    const card = await this.cardRepository.findOne({
      where: { cardUid },
    });

    if (!card) {
      throw new NotFoundException(`Thẻ với UID ${cardUid} không tồn tại`);
    }

    if (card.status !== 'ACTIVE') {
      throw new NotFoundException(
        `Thẻ ${cardUid} đang ở trạng thái ${card.status}`,
      );
    }

    const customer = await this.customerRepository.findOne({
      where: { id: card.customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Customer', card.customerId),
      );
    }

    const wallet = await this.walletRepository.findOne({
      where: { customerId: customer.id },
    });

    return {
      customer,
      card: {
        id: card.id,
        cardUid: card.cardUid,
        cardNumber: card.cardNumber,
        status: card.status,
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
