# Module Pattern Template - Centralized Entities

Tài liệu mô tả pattern CRUD khi entity được tập trung trong folder `entities` chung, thay vì nằm cùng folder với service.

---

## 📋 So sánh: Tác động của việc tách Entity

| Khía cạnh                    | Module Chung (Original) | Entity Tập Trung  | Ảnh hưởng                                             |
| ---------------------------- | ----------------------- | ----------------- | ----------------------------------------------------- |
| Import paths                 | `./` hoặc `../`         | `src/common/sql/` | Nhẹ - chỉ là đường dẫn                                |
| `TypeOrmModule.forFeature()` | Bình thường             | Bình thường       | **KHÔNG có**                                          |
| Service constructor          | Bình thường             | Bình thường       | **KHÔNG có**                                          |
| Module imports               | Bình thường             | Bình thường       | **KHÔNG có**                                          |
| DTO references               | Bình thường             | Bình thường       | **KHÔNG có**                                          |
| **Kết luận**                 | -                       | -                 | **KHÔNG ảnh hưởng logic**, chỉ ảnh hưởng import paths |

---

## 📁 Cấu trúc thư mục (Entities Tập Trung)

```
src/
├── common/
│   ├── sql/
│   │   ├── base.entity.ts
│   │   └── entities/
│   │       ├── question-bank.entity.ts
│   │       ├── question.entity.ts
│   │       ├── exam-set.entity.ts
│   │       ├── course.entity.ts
│   │       └── ... (tất cả entities)
│   ├── dto/
│   ├── constant/
│   └── ...
│
└── {module-name}/
    ├── {module-name}.controller.ts
    ├── {module-name}.service.ts
    ├── {module-name}.module.ts
    └── dto/
        ├── create-{module-name}.dto.ts
        └── {module-name}.dto.ts
```

---

## 1. Entity (`src/common/sql/entities/{module-name}.entity.ts`)

```typescript
import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity('{table_name}')
export class {ModuleName}Entity extends BaseEntity {
  @Column({ name: 'column_name', type: 'varchar', nullable: false })
  fieldName: string;

  // Foreign key - lưu ID
  @Column({ name: 'related_id', type: 'uuid' })
  relatedId: string;

  // Relation với entity khác
  @ManyToOne(() => RelatedEntity, (related) => related.items)
  @JoinColumn({ name: 'related_id' })
  related: RelatedEntity;
}
```

**Thay đổi so với Original:**

- Import từ `../base.entity` thay vì `src/common/sql/base.entity`
- Nếu có relation với entity khác, cần import from `./other-entity.entity`

---

## 2. DTOs

### 2.1. Create & Update DTO (`{module-name}/dto/create-{module-name}.dto.ts`)

```typescript
import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class Create{ModuleName}Dto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Mô tả field bằng tiếng Việt',
    example: 'Giá trị mẫu',
  })
  fieldName!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID của entity liên quan',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
  })
  relatedId!: string;
}

export class Update{ModuleName}Dto extends PartialType(Create{ModuleName}Dto) {}
```

**Thay đổi:** ❌ KHÔNG CÓ THAY ĐỔI

### 2.2. Response DTO (`{module-name}/dto/{module-name}.dto.ts`)

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/common/dto/base.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

export class {ModuleName}ResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Mô tả field',
    example: 'Giá trị mẫu',
  })
  fieldName!: string;

  @ApiProperty({
    description: 'ID của entity liên quan',
    example: '2233abe3-1961-4af5-a482-542f1227d844',
    required: false,
  })
  relatedId?: string;
}

export class {ModuleName}ListResponseDto extends PaginationResponseDto<{ModuleName}ResponseDto> {
  @ApiProperty({
    description: 'Danh sách {module-name}',
    type: [{ModuleName}ResponseDto],
  })
  declare data: {ModuleName}ResponseDto[];
}
```

**Thay đổi:** ❌ KHÔNG CÓ THAY ĐỔI

---

## 3. Service (`{module-name}/{module-name}.service.ts`)

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { {ModuleName}Entity } from 'src/common/sql/entities/{module-name}.entity';  // 👈 Import từ entities folder
import { Create{ModuleName}Dto, Update{ModuleName}Dto } from './dto/create-{module-name}.dto';
import { RelatedService } from 'src/related/related.service';
import { ERROR_MESSAGES, ENTITY_NAMES } from 'src/common/constant/error-messages.constant';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';
import { {ModuleName}ResponseDto } from './dto/{module-name}.dto';
import { autoMapListToDto } from 'src/common/utils/auto-map.util';

@Injectable()
export class {ModuleName}Service {
  constructor(
    @InjectRepository({ModuleName}Entity)
    private readonly {moduleName}Repo: Repository<{ModuleName}Entity>,
    private readonly relatedService: RelatedService,
  ) {}

  // CREATE
  async create(dto: Create{ModuleName}Dto): Promise<{ModuleName}Entity> {
    const related = await this.relatedService.findOne(dto.relatedId);

    const record = this.{moduleName}Repo.create({
      fieldName: dto.fieldName,
      related: related,
    });
    return this.{moduleName}Repo.save(record);
  }

  // READ ALL (with pagination & filters)
  async findAll(
    page = 1,
    size = 10,
    filter1?: string,
    filter2?: string,
  ): Promise<PaginationResponseDto<{ModuleName}ResponseDto>> {
    const skip = (page - 1) * size;

    const qb = this.{moduleName}Repo
      .createQueryBuilder('alias')
      .leftJoinAndSelect('alias.related', 'related');

    if (filter1) {
      qb.andWhere('alias.column_name = :filter1', { filter1 });
    }

    if (filter2) {
      qb.andWhere('alias.field ILIKE :filter2', { filter2: `%${filter2}%` });
    }

    qb.orderBy('alias.createdAt', 'DESC');
    qb.skip(skip).take(size);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: autoMapListToDto({ModuleName}ResponseDto, data),
      page,
      size,
      total,
    };
  }

  // READ ONE
  async findOne(id: string): Promise<{ModuleName}Entity> {
    const record = await this.{moduleName}Repo.findOne({
      where: { id },
      relations: ['related'],
    });
    if (!record) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID(
          ENTITY_NAMES.{MODULE_NAME} ?? '{ModuleName}',
          id,
        ),
      );
    }
    return record;
  }

  // UPDATE
  async update(id: string, dto: Update{ModuleName}Dto): Promise<{ModuleName}Entity> {
    const record = await this.findOne(id);

    if (dto.relatedId) {
      const related = await this.relatedService.findOne(dto.relatedId);
      record.related = related;
    }

    if (dto.fieldName !== undefined) {
      record.fieldName = dto.fieldName;
    }

    return this.{moduleName}Repo.save(record);
  }

  // DELETE
  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.{moduleName}Repo.remove(record);
  }
}
```

**Thay đổi chính:**

```typescript
// ❌ OLD (Module chung)
import { {ModuleName}Entity } from './{module-name}.entity';

// ✅ NEW (Entity tập trung)
import { {ModuleName}Entity } from 'src/common/sql/entities/{module-name}.entity';
```

---

## 4. Controller (`{module-name}/{module-name}.controller.ts`)

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { {ModuleName}Service } from './{module-name}.service';
import { Create{ModuleName}Dto, Update{ModuleName}Dto } from './dto/create-{module-name}.dto';
import { {ModuleName}ResponseDto, {ModuleName}ListResponseDto } from './dto/{module-name}.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination.dto';

@ApiTags('{Module Name}')
@ApiBearerAuth('access-token')
@Controller('{module-name}')
export class {ModuleName}Controller {
  constructor(private readonly {moduleName}Service: {ModuleName}Service) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới {tên entity}' })
  @ApiCreatedResponse({ type: {ModuleName}ResponseDto })
  create(@Body() dto: Create{ModuleName}Dto) {
    return this.{moduleName}Service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách {tên entity}' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'filterId',
    required: false,
    type: String,
    description: 'Lọc theo ID liên quan',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tìm kiếm theo tên',
  })
  @ApiOkResponse({ type: {ModuleName}ListResponseDto })
  findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('filterId') filterId?: string,
    @Query('search') search?: string,
  ): Promise<PaginationResponseDto<{ModuleName}ResponseDto>> {
    return this.{moduleName}Service.findAll(page, size, filterId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin {tên entity} theo ID' })
  @ApiOkResponse({ type: {ModuleName}ResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.{moduleName}Service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin {tên entity}' })
  @ApiOkResponse({ type: {ModuleName}ResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Update{ModuleName}Dto,
  ) {
    return this.{moduleName}Service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa {tên entity}' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.{moduleName}Service.remove(id);
  }
}
```

**Thay đổi:** ❌ KHÔNG CÓ THAY ĐỔI

---

## 5. Module (`{module-name}/{module-name}.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { {ModuleName}Service } from './{module-name}.service';
import { {ModuleName}Controller } from './{module-name}.controller';
import { {ModuleName}Entity } from 'src/common/sql/entities/{module-name}.entity';  // 👈 Import từ entities folder
import { RelatedModule } from 'src/related/related.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([{ModuleName}Entity]),
    RelatedModule,
  ],
  providers: [{ModuleName}Service],
  controllers: [{ModuleName}Controller],
  exports: [{ModuleName}Service],
})
export class {ModuleName}Module {}
```

**Thay đổi chính:**

```typescript
// ❌ OLD (Module chung)
import { {ModuleName}Entity } from './{module-name}.entity';

// ✅ NEW (Entity tập trung)
import { {ModuleName}Entity } from 'src/common/sql/entities/{module-name}.entity';
```

---

## 6. Entity Relations - Khi Entity khác ở folder entities

Nếu entity có relation, cần import từ entities folder:

```typescript
// ❌ OLD - KHÔNG DÙNG
import { RelatedEntity } from 'src/related/related.entity';

// ✅ NEW - DÙNG NÀY
import { RelatedEntity } from 'src/common/sql/entities/related.entity';
```

**Ví dụ:**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { CourseEntity } from './course.entity'; // 👈 Import từ entities folder

@Entity('exam_set')
export class ExamSetEntity extends BaseEntity {
  @Column({ name: 'name', type: 'varchar', nullable: false })
  name: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @ManyToOne(() => CourseEntity)
  @JoinColumn({ name: 'course_id' })
  course: CourseEntity;
}
```

---

## 7. Tạo Barrel Export (Optional nhưng khuyên dùng)

**File:** `src/common/sql/entities/index.ts`

```typescript
export { BaseEntity } from '../base.entity';
export { {ModuleName}Entity } from './{module-name}.entity';
export { OtherEntity } from './other.entity';
// ... export tất cả entities
```

**Lợi ích:**

```typescript
// ❌ OLD - Path dài
import { {ModuleName}Entity } from 'src/common/sql/entities/{module-name}.entity';

// ✅ NEW - Gọn hơn
import { {ModuleName}Entity } from 'src/common/sql/entities';
```

---

## 📋 Checklist tạo module mới (Entities Tập Trung)

- [ ] Tạo entity tại `src/common/sql/entities/{module-name}.entity.ts`
- [ ] Entity extends `BaseEntity` từ `../base.entity`
- [ ] Nếu có relation, import entity khác từ `./other-entity.entity`
- [ ] Tạo `dto/create-{module-name}.dto.ts` với `CreateDto` và `UpdateDto`
- [ ] Tạo `dto/{module-name}.dto.ts` với `ResponseDto` và `ListResponseDto`
- [ ] Tạo service, **import entity từ** `src/common/sql/entities/{module-name}.entity`
- [ ] Tạo controller (không cần thay đổi import)
- [ ] Tạo module, **import entity từ** `src/common/sql/entities/{module-name}.entity`
- [ ] Thêm entity name vào `ENTITY_NAMES`
- [ ] Import module vào `AppModule`
- [ ] (Optional) Update barrel export `src/common/sql/entities/index.ts`

---

## 🔍 So sánh Import Paths

| File             | Original                     | Centralized                                    |
| ---------------- | ---------------------------- | ---------------------------------------------- |
| Service          | `./{module-name}.entity`     | `src/common/sql/entities/{module-name}.entity` |
| Module           | `./{module-name}.entity`     | `src/common/sql/entities/{module-name}.entity` |
| Entity Relations | `src/related/related.entity` | `src/common/sql/entities/related.entity`       |

---

## ✅ Ưu điểm của Entities Tập Trung

1. **Dễ tìm:** Tất cả entities ở một chỗ
2. **Quản lý quan hệ:** Dễ xem quan hệ giữa các entities
3. **Không lặp lại:** Không cần duplicate entity definitions
4. **Migration:** Dễ generate migrations từ một folder entities duy nhất
5. **Reusability:** Các module khác có thể dễ dàng import entity

---

## ❌ Nhược điểm

1. **Import paths dài hơn** - nhưng có thể dùng barrel exports
2. **Coupling nhẹ với folder `common`** - nhưng không ảnh hưởng business logic

---

## 🎯 Kết luận

**Tác động:** ⚠️ **NHẸ** - Chỉ ảnh hưởng đường dẫn import, KHÔNG ảnh hưởng logic service/controller/DTO

**Khuyến cáo:**

- Nếu dự án có 10+ modules → **Dùng cấu trúc entities tập trung**
- Nếu dự án nhỏ → **Module chung cũng được**
