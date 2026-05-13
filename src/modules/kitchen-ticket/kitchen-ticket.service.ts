import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KitchenTicket } from '../../entities/kitchen-ticket.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class KitchenTicketService extends BaseService<KitchenTicket> {
  constructor(
    @InjectRepository(KitchenTicket)
    private kitchenTicketRepository: Repository<KitchenTicket>,
  ) {
    super(kitchenTicketRepository);
  }

  protected getEntityName(): string {
    return 'KitchenTicket';
  }
}
