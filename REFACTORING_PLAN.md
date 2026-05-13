# NestJS Module Pattern Refactoring Plan

## Overview
This document outlines the comprehensive plan to refactor the project by creating a dedicated module for each of the 23 entities.

## Current State
- **Location**: `src/modules/`
- **Existing Modules**: auth, products, orders, seed
- **Entities Location**: `src/entities/` (23 entities)
- **Total Entities**: 23

## 23 Entities to Modularize

1. User
2. Branch
3. POSDevice
4. Customer
5. Card
6. Wallet
7. WalletTransaction
8. Category
9. Product (existing - to be completed)
10. Order (existing - to be completed)
11. OrderItem
12. Payment
13. Refund
14. RefundItem
15. Shift
16. CashMovement
17. StudentProfile
18. KitchenTicket
19. KitchenTicketItem
20. StockLevel
21. StockTransaction
22. InventoryItem

## Module Structure for Each Entity

For each entity `{EntityName}`, the following structure will be created:

```
src/modules/{entity-name-kebab-case}/
├── {entity-name}.controller.ts
├── {entity-name}.service.ts
├── {entity-name}.module.ts
└── dto/
    ├── create-{entity-name}.dto.ts
    └── {entity-name}.dto.ts
```

### Kebab-case Mapping

| Entity | Kebab-case |
|--------|-----------|
| User | user |
| Branch | branch |
| POSDevice | pos-device |
| Customer | customer |
| Card | card |
| Wallet | wallet |
| WalletTransaction | wallet-transaction |
| Category | category |
| Product | product |
| Order | order |
| OrderItem | order-item |
| Payment | payment |
| Refund | refund |
| RefundItem | refund-item |
| Shift | shift |
| CashMovement | cash-movement |
| StudentProfile | student-profile |
| KitchenTicket | kitchen-ticket |
| KitchenTicketItem | kitchen-ticket-item |
| StockLevel | stock-level |
| StockTransaction | stock-transaction |
| InventoryItem | inventory-item |

## File Templates

### Service Pattern
```typescript
@Injectable()
export class {EntityName}Service extends BaseService<{EntityName}> {
  constructor(
    @InjectRepository({EntityName})
    private {entityName}Repository: Repository<{EntityName}>,
  ) {
    super({entityName}Repository);
  }

  protected getEntityName(): string {
    return '{EntityName}';
  }
}
```

### Controller Pattern
```typescript
@ApiTags('{EntityNames}')
@ApiBearerAuth()
@Controller('api/{entity-names}')
@UseGuards(JwtAuthGuard)
export class {EntityName}Controller {
  constructor(private {entityName}Service: {EntityName}Service) {}

  @Get()
  async findAll() {
    return this.{entityName}Service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.{entityName}Service.findOne(id);
  }

  @Post()
  async create(@Body() dto: Create{EntityName}Dto) {
    // Implementation
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Create{EntityName}Dto) {
    // Implementation
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    // Implementation
  }
}
```

### Module Pattern
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([{EntityName}])],
  providers: [{EntityName}Service],
  controllers: [{EntityName}Controller],
  exports: [{EntityName}Service],
})
export class {EntityName}Module {}
```

### DTO Pattern
```typescript
export class {EntityName}Dto extends BaseDto {
  // Properties matching entity columns
}

export class Create{EntityName}Dto {
  // Create-specific fields with validation decorators
}
```

## Implementation Steps

### Phase 1: Setup
1. Create module directory structure for all 23 entities
2. Create service files extending BaseService<T>
3. Create controller files with REST endpoints
4. Create module files with TypeOrmModule imports
5. Create DTO files for each entity

### Phase 2: Integration
1. Update `app.module.ts` to import all new modules
2. Update `src/entities/index.ts` if needed
3. Test all modules for proper initialization
4. Verify dependency injection

### Phase 3: Refinement
1. Customize each service with entity-specific business logic
2. Add custom queries where needed
3. Update controllers with proper route guards and validation
4. Add comprehensive Swagger documentation

## Key Guidelines

1. **Services**: All extend `BaseService<T>` which provides CRUD operations
2. **Controllers**: Standard REST pattern with GET, POST, PUT, DELETE methods
3. **DTOs**: Use validation decorators from `class-validator`
4. **Modules**: Import TypeOrmModule.forFeature with the entity class
5. **Exports**: Each module exports its service for dependency injection
6. **Entities**: Keep in `src/entities/` - do not move
7. **Imports**: Reference entities from `src/entities` barrel export

## Validation Decorators (class-validator)

Common decorators to use in DTOs:
- `@IsNotEmpty()` - Field is required
- `@IsString()` - Must be string
- `@IsUUID()` - Must be valid UUID
- `@IsNumber()` - Must be number
- `@IsEmail()` - Must be valid email
- `@IsOptional()` - Field is optional
- `@MinLength(n)` - Minimum length
- `@MaxLength(n)` - Maximum length
- `@IsEnum()` - Must be enum value
- `@IsBoolean()` - Must be boolean
- `@IsDateString()` - Must be date string
- `@Min(n)` / `@Max(n)` - Numeric bounds

## Files to Update After Creation

1. **src/app.module.ts**
   - Import all 23 new modules
   - Remove TypeOrmModule.forFeature entries that are now in individual modules

2. **src/main.ts**
   - No changes needed if app.module.ts imports are correct

## Testing Strategy

1. Verify module initialization
2. Test CRUD operations for each entity
3. Validate DTO validation
4. Test authorization guards
5. Verify Swagger documentation generation

## Dependencies

Already in the project:
- NestJS core framework
- TypeORM for database access
- class-validator for DTO validation
- @nestjs/swagger for API documentation

## Estimated Timeline

- Phase 1 (Setup): File creation
- Phase 2 (Integration): Module import and testing
- Phase 3 (Refinement): Custom business logic and testing

---

**Status**: Ready for implementation
**Created**: 2024
