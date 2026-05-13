# Module Implementation Details & Import Structure

## Complete Module List with Import Statements

### app.module.ts Imports

```typescript
import { UserModule } from './modules/user/user.module';
import { BranchModule } from './modules/branch/branch.module';
import { POSDeviceModule } from './modules/pos-device/pos-device.module';
import { CustomerModule } from './modules/customer/customer.module';
import { CardModule } from './modules/card/card.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { WalletTransactionModule } from './modules/wallet-transaction/wallet-transaction.module';
import { CategoryModule } from './modules/category/category.module';
import { OrderItemModule } from './modules/order-item/order-item.module';
import { PaymentModule } from './modules/payment/payment.module';
import { RefundModule } from './modules/refund/refund.module';
import { RefundItemModule } from './modules/refund-item/refund-item.module';
import { ShiftModule } from './modules/shift/shift.module';
import { CashMovementModule } from './modules/cash-movement/cash-movement.module';
import { StudentProfileModule } from './modules/student-profile/student-profile.module';
import { KitchenTicketModule } from './modules/kitchen-ticket/kitchen-ticket.module';
import { KitchenTicketItemModule } from './modules/kitchen-ticket-item/kitchen-ticket-item.module';
import { StockLevelModule } from './modules/stock-level/stock-level.module';
import { StockTransactionModule } from './modules/stock-transaction/stock-transaction.module';
import { InventoryItemModule } from './modules/inventory-item/inventory-item.module';
```

### Module Declarations in app.module.ts

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(databaseConfig),
    AuthModule,
    SeedModule,
    UserModule,
    BranchModule,
    POSDeviceModule,
    CustomerModule,
    CardModule,
    WalletModule,
    WalletTransactionModule,
    CategoryModule,
    ProductModule,
    OrderModule,
    OrderItemModule,
    PaymentModule,
    RefundModule,
    RefundItemModule,
    ShiftModule,
    CashMovementModule,
    StudentProfileModule,
    KitchenTicketModule,
    KitchenTicketItemModule,
    StockLevelModule,
    StockTransactionModule,
    InventoryItemModule,
  ],
  // ...
})
export class AppModule {}
```

---

## Service Implementation Pattern

All services follow this pattern:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityName } from '../../entities/entity-name.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class EntityNameService extends BaseService<EntityName> {
  constructor(
    @InjectRepository(EntityName)
    private entityRepository: Repository<EntityName>,
  ) {
    super(entityRepository);
  }

  protected getEntityName(): string {
    return 'EntityName';
  }
  
  // Add custom methods here
}
```

---

## Controller Implementation Pattern

All controllers follow this pattern:

```typescript
import { Controller, Get, Post, Body, Param, Put, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { EntityNameService } from './entity-name.service';
import { CreateEntityNameDto } from './dto/create-entity-name.dto';
import { EntityNameDto } from './dto/entity-name.dto';

@ApiTags('Entity Names')
@ApiBearerAuth()
@Controller('api/entity-names')
export class EntityNameController {
  constructor(private entityNameService: EntityNameService) {}

  @Get()
  @ApiOperation({ summary: 'Get all entity names' })
  @ApiResponse({ status: 200, description: 'List of entity names', type: [EntityNameDto] })
  async findAll(): Promise<EntityNameDto[]> {
    return this.entityNameService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get entity name by ID' })
  @ApiParam({ name: 'id', description: 'Entity Name ID' })
  @ApiResponse({ status: 200, description: 'Entity name details', type: EntityNameDto })
  @ApiResponse({ status: 404, description: 'Entity name not found' })
  async findOne(@Param('id') id: string): Promise<EntityNameDto> {
    return this.entityNameService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new entity name' })
  @ApiResponse({ status: 201, description: 'Entity name created', type: EntityNameDto })
  async create(@Body() createEntityNameDto: CreateEntityNameDto): Promise<EntityNameDto> {
    return this.entityNameService.create(createEntityNameDto, { userId: 'system' } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update entity name' })
  @ApiParam({ name: 'id', description: 'Entity Name ID' })
  @ApiResponse({ status: 200, description: 'Entity name updated', type: EntityNameDto })
  @ApiResponse({ status: 404, description: 'Entity name not found' })
  async update(@Param('id') id: string, @Body() createEntityNameDto: CreateEntityNameDto): Promise<EntityNameDto> {
    return this.entityNameService.update(id, createEntityNameDto, { userId: 'system' } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete entity name' })
  @ApiParam({ name: 'id', description: 'Entity Name ID' })
  @ApiResponse({ status: 204, description: 'Entity name deleted' })
  @ApiResponse({ status: 404, description: 'Entity name not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.entityNameService.delete(id, { userId: 'system' } as any);
  }
}
```

---

## Module Implementation Pattern

All modules follow this pattern:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityNameService } from './entity-name.service';
import { EntityNameController } from './entity-name.controller';
import { EntityName } from '../../entities/entity-name.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EntityName])],
  providers: [EntityNameService],
  controllers: [EntityNameController],
  exports: [EntityNameService],
})
export class EntityNameModule {}
```

---

## DTO Implementation Pattern

### Create DTO (with validation)

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';

export class CreateEntityNameDto {
  @ApiProperty({ description: 'Field description', example: 'example value' })
  @IsNotEmpty()
  @IsString()
  fieldName: string;

  @ApiProperty({ description: 'Optional field', example: 'value', required: false })
  @IsOptional()
  @IsString()
  optionalField?: string;

  @ApiProperty({ description: 'Status field', enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: string;
}
```

### Response DTO

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class EntityNameDto extends BaseDto {
  @ApiProperty({ description: 'Field description', example: 'example value' })
  fieldName: string;

  @ApiProperty({ description: 'Optional field', example: 'value' })
  optionalField?: string;

  @ApiProperty({ description: 'Status field', example: 'ACTIVE' })
  status?: string;
}
```

---

## Validation Decorators Reference

### Common Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@IsNotEmpty()` | Field is required | `@IsNotEmpty()` |
| `@IsOptional()` | Field is optional | `@IsOptional()` |
| `@IsString()` | Must be string | `@IsString()` |
| `@IsNumber()` | Must be number | `@IsNumber()` |
| `@IsUUID()` | Must be valid UUID | `@IsUUID()` |
| `@IsEmail()` | Must be valid email | `@IsEmail()` |
| `@IsEnum([...])` | Must match enum | `@IsEnum(['A', 'B'])` |
| `@IsBoolean()` | Must be boolean | `@IsBoolean()` |
| `@IsDateString()` | Must be date string | `@IsDateString()` |
| `@MinLength(n)` | Min string length | `@MinLength(3)` |
| `@MaxLength(n)` | Max string length | `@MaxLength(50)` |
| `@Min(n)` | Min numeric value | `@Min(0)` |
| `@Max(n)` | Max numeric value | `@Max(100)` |

---

## Entity Import Pattern

All modules import entities directly:

```typescript
import { User } from '../../entities/user.entity';
import { Branch } from '../../entities/branch.entity';
import { POSDevice } from '../../entities/pos-device.entity';
// ... etc
```

**Important**: Entities remain in `src/entities/` folder and are NOT moved.

---

## TypeOrmModule Configuration

Each module configures TypeOrmModule for its entity:

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([EntityName])],
  // ...
})
```

This allows NestJS to:
1. Create a Repository for the entity
2. Inject it into the service via `@InjectRepository()`
3. Keep data access isolated per module

---

## Service Injection in Controllers

```typescript
@Injectable()
export class EntityNameController {
  constructor(private entityNameService: EntityNameService) {}
  
  // Use this.entityNameService to call service methods
}
```

---

## Common Service Methods

Inherited from BaseService<T>:

```typescript
// Read operations
await this.userService.findAll();
await this.userService.findById(id);
await this.userService.findOne(id);
await this.userService.findByIds([id1, id2]);

// Create operation
await this.userService.create(createDto, jwtPayload);

// Update operation
await this.userService.update(id, updateDto, jwtPayload);

// Delete operation
await this.userService.delete(id, jwtPayload);

// Transaction
await this.userService.runInTransaction(async () => {
  // database operations
});
```

---

## Error Handling

BaseService automatically throws:
- `NotFoundException` - When entity not found (used in `findOne()`)
- Standard NestJS exceptions for validation errors

---

## Swagger/OpenAPI Documentation

All endpoints are documented automatically via decorators:

- `@ApiTags()` - Groups endpoints in Swagger UI
- `@ApiBearerAuth()` - Indicates JWT auth requirement
- `@ApiOperation()` - Describes endpoint purpose
- `@ApiResponse()` - Describes possible responses
- `@ApiParam()` - Describes route parameters
- `@ApiProperty()` - Describes DTO properties

Access documentation at: `http://localhost:3000/api/docs`

---

## Adding Custom Methods Example

### Service Extension

```typescript
// user.service.ts
@Injectable()
export class UserService extends BaseService<User> {
  // ... existing code ...

  async findByRole(role: string): Promise<User[]> {
    return this.userRepository.find({
      where: { role },
    });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: { status: 'ACTIVE' },
    });
  }
}
```

### Controller Extension

```typescript
// user.controller.ts
@Get('by-role/:role')
@ApiOperation({ summary: 'Get users by role' })
@ApiParam({ name: 'role', description: 'User role' })
async findByRole(@Param('role') role: string): Promise<UserDto[]> {
  return this.userService.findByRole(role);
}

@Get('active')
@ApiOperation({ summary: 'Get all active users' })
async findActive(): Promise<UserDto[]> {
  return this.userService.findActiveUsers();
}
```

---

## Database Transaction Example

```typescript
async createOrderWithItems(createOrderDto: CreateOrderDto): Promise<OrderDto> {
  return this.orderService.runInTransaction(async () => {
    // Create order
    const order = await this.orderService.create(createOrderDto, user);
    
    // Create items
    for (const item of createOrderDto.items) {
      await this.orderItemService.create({
        ...item,
        orderId: order.id,
      }, user);
    }
    
    return order;
  });
}
```

---

## Testing Endpoints (curl)

```bash
# Create
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"John Doe","email":"john@example.com",...}'

# Read all
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/users

# Read one
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/users/f47ac10b-58cc-4372-a567-0e02b2c3d479

# Update
curl -X PUT http://localhost:3000/api/users/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Jane Doe",...}'

# Delete
curl -X DELETE http://localhost:3000/api/users/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## File Locations Summary

| File Type | Location Pattern | Count |
|-----------|-----------------|-------|
| Service | `src/modules/{entity}/{entity}.service.ts` | 21 |
| Controller | `src/modules/{entity}/{entity}.controller.ts` | 21 |
| Module | `src/modules/{entity}/{entity}.module.ts` | 21 |
| Create DTO | `src/modules/{entity}/dto/create-{entity}.dto.ts` | 21 |
| Response DTO | `src/modules/{entity}/dto/{entity}.dto.ts` | 21 |

**Total: 105 files**

---

## Next Actions for Developers

1. **Review each module** for entity-specific requirements
2. **Add custom methods** to services as needed
3. **Extend DTOs** with additional validation rules
4. **Add guards/decorators** for role-based access control
5. **Implement relationships** loading in controllers
6. **Create unit tests** for services
7. **Create e2e tests** for controllers

---

*Last Updated: May 5, 2024*
