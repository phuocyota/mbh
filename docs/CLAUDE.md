# CLAUDE.md

MBH POS System - Multi-Branch Hospitality backend API for Kido Canteen.

## Project Overview

- **Framework**: NestJS 11 with TypeORM + PostgreSQL
- **Port**: 3002 (dev), Swagger docs at `/docs`
- **Package manager**: npm (no workspaces in use currently)

## Key Commands

```bash
npm run start:dev       # Start with hot reload
npm test               # Run unit tests
npm run test:kitchen:integration  # Kitchen integration tests
npm run migration:run  # Run migrations
npm run lint           # Lint code
npm run build          # Build for production
```

## Architecture

### Modules (in `src/modules/`)
| Module | Purpose |
|--------|---------|
| `auth/` | JWT + Passport authentication |
| `orders/` | Order processing |
| `cart/` | Shopping cart |
| `products/` | Product catalog |
| `kitchen/` | Kitchen operations & real-time portal |
| `stock/` | Stock management |
| `inventory-item/` | Inventory item tracking |
| `stock-take/` | Periodic inventory reconciliation |
| `stock-transfer/` | Inter-branch stock transfers |
| `stock-voucher/` | Stock adjustments |
| `finance/` | Financial operations |
| `vietinbank/` | VietinBank QR payments |
| `wallet/` | Wallet balance & transactions |
| `customer/` | Customer & student card lookup |
| `branch/` | Multi-branch management |
| `employee/` | Staff management |
| `reports/` | Revenue & inventory reports |
| `dashboard/` | Dashboard analytics |
| `socket/` | WebSocket events |

### Entities (in `src/entities/`)
TypeORM entities stored in `src/entities/index.ts`. Recent additions:
- `stock-lot.entity.ts` - Lot tracking with expiration
- `kitchen-operation.entity.ts` - Kitchen operations

### Common Utilities
- `src/common/utils/request-fingerprint.ts` - Request fingerprinting
- `src/common/sql/ledger-base.entity.ts` - Ledger base entity

## Testing

Tests are located alongside source files with `.spec.ts` suffix.
Jest config in `package.json` - rootDir is `src`, `*.spec.ts` pattern.

## API Conventions

- Prefix: `/api/v1/`
- DTOs use `class-validator` decorators
- Swagger documentation via `@nestjs/swagger`
- Global exception filter: `AllExceptionsFilter`
- Global read-only guard: `ReadOnlyRoleGuard`

## Recent Changes (phuoc_main branch)

- Kitchen portal improvements
- Stock lot tracking
- VietinBank integration
- Inventory management enhancements

## Working Directory

`c:\Users\Admin\code\work\mbh`
