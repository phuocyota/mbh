import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from '../../entities/card.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class CardService extends BaseService<Card> {
  constructor(
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
  ) {
    super(cardRepository);
  }

  protected getEntityName(): string {
    return 'Card';
  }
}
