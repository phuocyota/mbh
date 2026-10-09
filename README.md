# MBH POS System

Multi-Branch Hospitality POS backend API for Kido Canteen. Built with NestJS, TypeORM, and PostgreSQL.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | NestJS 11 |
| Database | PostgreSQL + TypeORM |
| Authentication | JWT + Passport |
| Real-time | Socket.IO |
| API Docs | Swagger/OpenAPI |
| Finance | VietinBank QR Payments, MoMo |

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env  # if you have one, otherwise create manually
# Edit .env with your database credentials and secrets

# Run database migrations
npm run migration:run

# Start development server
npm run start:dev

# Run tests
npm test
```

The API runs on **port 3002** with Swagger docs at `/docs`.

## Project Structure

```
src/
├── modules/              # Feature modules
│   ├── auth/             # JWT authentication
│   ├── branch/           # Multi-branch management
│   ├── cart/             # Shopping cart
│   ├── cash-movement/    # Cash drawer operations
│   ├── customer/         # Customer & student card lookup
│   ├── dashboard/        # Dashboard analytics
│   ├── employee/         # Staff management
│   ├── finance/          # Financial operations
│   ├── inventory-item/   # Stock inventory tracking
│   ├── kitchen/          # Kitchen operations & portal
│   ├── meal-item/        # Meal item catalog
│   ├── orders/           # Order processing
│   ├── parent/           # Parent app integration
│   ├── payment/          # Payment processing
│   ├── payroll/          # Employee payroll
│   ├── products/         # Product catalog
│   ├── reports/          # Revenue & inventory reports
│   ├── shift/            # Shift management
│   ├── socket/           # WebSocket events
│   ├── stock/            # Stock management
│   ├── stock-take/       # Inventory stocktakes
│   ├── stock-transfer/   # Stock transfers between branches
│   ├── stock-voucher/    # Stock vouchers
│   ├── supplier/          # Supplier management
│   ├── upload/           # File uploads
│   ├── vietinbank/       # VietinBank QR payments
│   ├── wallet/           # Wallet balance & transactions
│   └── ...
├── entities/             # TypeORM entity definitions
├── common/
│   ├── decorators/       # Custom decorators
│   ├── filters/          # Exception filters
│   ├── guard/            # Route guards
│   ├── interceptors/    # Response/logging interceptors
│   └── middleware/       # Request logging
└── config/               # Configuration files
```

## Key Features

### Kitchen Operations
The kitchen module provides a real-time portal for kitchen staff to view and manage orders:
- Real-time order updates via WebSocket
- Kitchen display system integration
- Production tracking per branch

### Stock & Inventory
Multi-layer inventory management across branches:
- Stock items with lot tracking and expiration dates
- Stock vouchers for adjustments
- Stock takes for periodic reconciliation
- Stock transfers between branches

### Finance
- VietinBank QR code generation for wallet topups
- Cash movement tracking
- Fund management per branch
- MoMo integration support

### Multi-Branch Support
- Branch-specific configuration
- POS device registration
- Cross-branch stock transfers
- Branch-level reporting

## API Endpoints

API documentation is available via Swagger at `/docs` when the server is running.

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

### Core Operations
- `/api/v1/orders` - Order management
- `/api/v1/products` - Product catalog
- `/api/v1/customers` - Customer lookup
- `/api/v1/wallet` - Wallet operations

### Inventory
- `/api/v1/stock` - Stock management
- `/api/v1/inventory-items` - Inventory item tracking
- `/api/v1/stock-takes` - Stocktake operations
- `/api/v1/stock-transfers` - Inter-branch transfers
- `/api/v1/stock-vouchers` - Stock adjustments

### Kitchen
- `/api/v1/kitchen` - Kitchen operations and portal

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=mbh

# Application
NODE_ENV=development
PORT=3002

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=7d

# VietinBank (production)
VIETINBANK_ENVIRONMENT=UAT
VIETINBANK_SECRET_MASTER_KEY=
VIETINBANK_QR_PATH=/vtb-api-uat/development/qr/vietqr/gen
VIETINBANK_RSA_ALGORITHM=
VIETINBANK_RSA_PADDING=
VIETINBANK_CHANNEL=MOBILE
VIETINBANK_VERSION=1.0.1
VIETINBANK_CLIENT_IP=
VIETINBANK_TIMEOUT_MS=10000
VIETINBANK_TARGET_BALANCE=50000
VIETINBANK_TOPUP_TTL_MINUTES=15

# MoMo
MOMO_ENDPOINT=
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=

# Frontend Origins (for CORS)
KITCHEN_FRONTEND_ORIGIN=
```

## Scripts

```bash
npm run start           # Start production server
npm run start:dev       # Start with hot reload
npm run start:debug      # Start in debug mode
npm run build            # Build for production
npm run lint             # Lint code
npm run format           # Format with Prettier
npm test                # Run unit tests
npm run test:cov        # Test coverage report
npm run reset:branch    # Reset branch test data
```

## CORS

The API allows requests from configured frontend origins:
- `https://be.kidocanteen.kidoedu.vn`
- `https://fe.kidocanteen.kidoedu.vn`
- `https://fe.parent.kidocanteen.kidoedu.vn`
- `https://fe.admin.kidocanteen.kidoedu.vn`
- `localhost:5173` and `localhost:5171` (development)

## VietinBank Integration

The wallet topup flow:
1. Generate QR code: `POST /api/v1/vietinbank/generate-qr`
2. Poll status: `GET /api/v1/vietinbank/topups/:requestId/status`
3. VietinBank confirms via: `POST /api/v1/vietinbank/notify-bill`

For local testing, enable mock mode: `VIETINBANK_MOCK_ENABLED=true`

> **Note**: Do not enable production VietinBank integration until confirmed with VietinBank on the algorithm, padding, signature source, endpoint, and credentials.

## License

Private - Kido Canteen
