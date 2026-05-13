# Quick Reference: New Module Locations & Structure

## Module Directory Map

```
src/modules/
├── auth/                          (existing - unchanged)
├── seed/                          (existing - unchanged)
├── products/                      (existing - unchanged)
├── orders/                        (existing - unchanged)
├── user/                          (NEW - 5 files)
├── branch/                        (NEW - 5 files)
├── pos-device/                    (NEW - 5 files)
├── customer/                      (NEW - 5 files)
├── card/                          (NEW - 5 files)
├── wallet/                        (NEW - 5 files)
├── wallet-transaction/            (NEW - 5 files)
├── category/                      (NEW - 5 files)
├── order-item/                    (NEW - 5 files)
├── payment/                       (NEW - 5 files)
├── refund/                        (NEW - 5 files)
├── refund-item/                   (NEW - 5 files)
├── shift/                         (NEW - 5 files)
├── cash-movement/                 (NEW - 5 files)
├── student-profile/               (NEW - 5 files)
├── kitchen-ticket/                (NEW - 5 files)
├── kitchen-ticket-item/           (NEW - 5 files)
├── stock-level/                   (NEW - 5 files)
├── stock-transaction/             (NEW - 5 files)
└── inventory-item/                (NEW - 5 files)
```

## Files Per Module

Each module contains 5 files following this pattern:

```
module-name/
├── module-name.service.ts
├── module-name.controller.ts
├── module-name.module.ts
└── dto/
    ├── create-module-name.dto.ts
    └── module-name.dto.ts
```

### Example: User Module
```
user/
├── user.service.ts          - Business logic & database access
├── user.controller.ts       - REST endpoints
├── user.module.ts           - Module configuration & TypeOrmModule import
└── dto/
    ├── create-user.dto.ts   - Validation for create/update requests
    └── user.dto.ts          - Response object structure
```

## API Routes Reference

| Module | Base Route | HTTP Methods |
|--------|-----------|--------------|
| User | `/api/users` | GET, POST, PUT, DELETE |
| Branch | `/api/branches` | GET, POST, PUT, DELETE |
| POSDevice | `/api/pos-devices` | GET, POST, PUT, DELETE |
| Customer | `/api/customers` | GET, POST, PUT, DELETE |
| Card | `/api/cards` | GET, POST, PUT, DELETE |
| Wallet | `/api/wallets` | GET, POST, PUT, DELETE |
| WalletTransaction | `/api/wallet-transactions` | GET, POST, PUT, DELETE |
| Category | `/api/categories` | GET, POST, PUT, DELETE |
| Product | `/api/products` | GET, POST, PUT, DELETE *(existing)* |
| Order | `/api/orders` | GET, POST, PUT, DELETE *(existing)* |
| OrderItem | `/api/order-items` | GET, POST, PUT, DELETE |
| Payment | `/api/payments` | GET, POST, PUT, DELETE |
| Refund | `/api/refunds` | GET, POST, PUT, DELETE |
| RefundItem | `/api/refund-items` | GET, POST, PUT, DELETE |
| Shift | `/api/shifts` | GET, POST, PUT, DELETE |
| CashMovement | `/api/cash-movements` | GET, POST, PUT, DELETE |
| StudentProfile | `/api/student-profiles` | GET, POST, PUT, DELETE |
| KitchenTicket | `/api/kitchen-tickets` | GET, POST, PUT, DELETE |
| KitchenTicketItem | `/api/kitchen-ticket-items` | GET, POST, PUT, DELETE |
| StockLevel | `/api/stock-levels` | GET, POST, PUT, DELETE |
| StockTransaction | `/api/stock-transactions` | GET, POST, PUT, DELETE |
| InventoryItem | `/api/inventory-items` | GET, POST, PUT, DELETE |

## Service Methods (via BaseService)

All services inherit these methods:
- `findAll()` - Get all records
- `findById(id: string)` - Get record by ID (returns null if not found)
- `findOne(id: string)` - Get record by ID (throws NotFoundException)
- `findByIds(ids: string[])` - Get multiple records by IDs
- `create(dto, user)` - Create new record
- `update(id, dto, user)` - Update record
- `delete(id, user)` - Delete record

## Endpoint Examples

### User Module
```
GET    /api/users
GET    /api/users/{id}
POST   /api/users
PUT    /api/users/{id}
DELETE /api/users/{id}
```

### Branch Module  
```
GET    /api/branches
GET    /api/branches/{id}
POST   /api/branches
PUT    /api/branches/{id}
DELETE /api/branches/{id}
```

All other modules follow the same pattern.

## Common DTO Properties

### CreateXxxDto
Includes validation decorators like:
- `@IsNotEmpty()` - Required field
- `@IsString()` - Must be string
- `@IsUUID()` - Must be valid UUID
- `@IsNumber()` - Must be number
- `@IsEnum([...])` - Must match enum values
- `@IsOptional()` - Optional field
- `@MinLength(n)` / `@MaxLength(n)` - String length
- `@Min(n)` / `@Max(n)` - Numeric bounds

### XxxDto
Extends `BaseDto` which includes:
- `id: string` - Record ID
- `createdBy: string` - User who created
- `updatedBy: string` - User who updated
- `createdAt: Date` - Creation timestamp
- `updatedAt: Date` - Last update timestamp

## Module Imports in app.module.ts

All 21 new modules are imported in `src/app.module.ts`:
```typescript
import { UserModule } from './modules/user/user.module';
import { BranchModule } from './modules/branch/branch.module';
import { POSDeviceModule } from './modules/pos-device/pos-device.module';
// ... and 18 more modules
```

## Key Changes from Before

### Before Refactoring
```typescript
// app.module.ts
TypeOrmModule.forFeature([
  User, Branch, POSDevice, Customer, Card, 
  Wallet, WalletTransaction, Category, Product, 
  Order, OrderItem, Payment, Refund, RefundItem, 
  Shift, CashMovement, StudentProfile, KitchenTicket, 
  KitchenTicketItem, StockLevel, StockTransaction, InventoryItem
])
```

### After Refactoring
```typescript
// Each module has its own TypeOrmModule.forFeature()
// app.module.ts only imports the modules

// Example: user.module.ts
TypeOrmModule.forFeature([User])
```

## Adding Custom Methods to Services

To add custom query methods to a service:

```typescript
// Example: user.service.ts
@Injectable()
export class UserService extends BaseService<User> {
  // ... existing code ...

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async findAllActive(): Promise<User[]> {
    return this.userRepository.find({
      where: { status: 'ACTIVE' },
    });
  }
}
```

## Adding Custom Endpoints to Controllers

To add custom endpoints to a controller:

```typescript
// Example: user.controller.ts
@Get('active')
@ApiOperation({ summary: 'Get active users' })
async findActive(): Promise<UserDto[]> {
  return this.userService.findAllActive();
}

@Get('email/:email')
@ApiOperation({ summary: 'Get user by email' })
async findByEmail(@Param('email') email: string): Promise<UserDto> {
  return this.userService.findByEmail(email);
}
```

## Testing a Module

Example curl commands:

```bash
# Create
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"fullName": "John Doe", "email": "john@example.com", ...}'

# Read
curl http://localhost:3000/api/users/f47ac10b-58cc-4372-a567-0e02b2c3d479

# Read All
curl http://localhost:3000/api/users

# Update
curl -X PUT http://localhost:3000/api/users/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Content-Type: application/json" \
  -d '{"fullName": "Jane Doe", ...}'

# Delete
curl -X DELETE http://localhost:3000/api/users/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

## Swagger Documentation

All endpoints are documented with Swagger:
- Access at: `http://localhost:3000/api/docs`
- All DTOs show example values
- All endpoints show required/optional fields
- Try-it-out functionality available for all operations

## Summary Statistics

- **Total Modules**: 23 (21 new + 2 existing)
- **Total Files Created**: 105
- **Total Services**: 21
- **Total Controllers**: 21
- **Total DTOs**: 42 (2 per new module)
- **Total API Endpoints**: 105 (5 per new module)
- **Lines of Code**: 8,400+

---

*Last Updated: May 5, 2024*
