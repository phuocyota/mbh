import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../entities/category.entity';
import { BaseService } from '../../common/sql/base.service';
import { JwtPayload } from '../../common/interface/jwt-payload.interface';

@Injectable()
export class CategoryService extends BaseService<Category> {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {
    super(categoryRepository);
  }

  protected getEntityName(): string {
    return 'Category';
  }

  async delete(id: string, user: JwtPayload): Promise<Category> {
    const item = await this.findOne(id);
    item.updatedBy = user.userId;
    await this.categoryRepository.remove(item);
    return item;
  }
}
