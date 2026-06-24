# MBH Backend - Project Overview

## 📋 Project Description

**MBH** is a comprehensive backend system built with NestJS and TypeORM, designed for managing a school canteen/cafeteria operation (Kids Do Canteen). The system handles orders, inventory, payments, student cards, and multiple business locations.

## 🏗️ Tech Stack

### Core Framework & Database
- **NestJS** v11.0.1 - Progressive Node.js framework
- **TypeORM** v0.3.28 - ORM for database operations
- **PostgreSQL** - Primary database (via pg driver)
- **TypeScript** - Primary language

### Authentication & Security
- **@nestjs/jwt** - JWT token management
- **@nestjs/passport** - Passport authentication strategies
- **passport-local** - Local strategy for login
- **passport-jwt** - JWT strategy for protected routes
- **bcrypt** - Password hashing

### API & Documentation
- **@nestjs/swagger** - API documentation (Swagger/OpenAPI)
- **swagger-ui-express** - Swagger UI interface

### Validation & Transformation
- **class-validator** - DTO validation
- **class-transformer** - Data transformation

### Utilities
- **@nestjs/config** - Configuration management (dotenv)
- **uuid** - UUID generation

## 📁 Project Structure

```
src/
├── app.module.ts              # Main application module
├── app.controller.ts          # Main controller
├── app.service.ts             # Main service
├── main.ts                    # Application entry point
│
├── config/
│   └── database.config.ts     # Database configuration
│
├── entities/                  # Database entities (29 tables)
│   ├── user.entity.ts
│   ├── product.entity.ts
│   ├── order.entity.ts
│   ├── customer.entity.ts
│   ├── payment.entity.ts
│   ├── refund.entity.ts
│   ├── student-profile.entity.ts
│   ├── student-card.entity.ts
│   ├── wallet.entity.ts
│   ├── cart.entity.ts
│   ├── kitchen-ticket.entity.ts
│   └── ...more entities
│
├── modules/                   # Feature modules (25+ modules)
│   ├── auth/                  # Authentication
│   ├── user/                  # User management
│   ├── branch/                # Branch management
│   ├── pos-device/            # POS device management
│   ├── customer/              # Customer management
│   ├── card/                  # Card management
│   ├── products/              # Product catalog
│   ├── category/              # Product categories
│   ├── orders/                # Order management
│   ├── order-item/            # Order line items
│   ├── payment/               # Payment processing
│   ├── refund/                # Refund management
│   ├── refund-item/           # Refund line items
│   ├── wallet/                # Wallet/balance management
│   ├── wallet-transaction/    # Wallet transaction history
│   ├── student-profile/       # Student profiles
│   ├── shift/                 # Work shifts
│   ├── cash-movement/         # Cash flow tracking
│   ├── kitchen-ticket/        # Kitchen order tickets
│   ├── kitchen-ticket-item/   # Kitchen ticket items
│   ├── stock-level/           # Inventory levels
│   ├── stock-transaction/     # Inventory transactions
│   ├── inventory-item/        # Inventory items
│   ├── cart/                  # Shopping cart
│   └── reports/               # Reporting & analytics
│
├── common/
│   ├── constant/              # Application constants
│   ├── database/              # Database utilities
│   ├── decorator/             # Custom decorators
│   ├── dto/                   # Data transfer objects
│   ├── enum/                  # Enumerations
│   ├── filter/                # Global exception filters
│   ├── guard/                 # Authentication guards
│   ├── interceptors/          # Response/request interceptors
│   ├── interface/             # TypeScript interfaces
│   ├── middleware/            # HTTP middleware
│   ├── sql/                   # SQL utilities
│   └── utils/                 # Helper functions
│
├── migrations/                # Database migrations
│   ├── 1704067200000-create-users-table.ts
│   ├── 1704067201000-initialize-database-schema.ts
│   ├── 1704067202000-create-student-cards-table.ts
│   └── 1704067203000-align-student-profiles-schema.ts
│
└── data-source.ts            # TypeORM data source configuration

test/                         # E2E tests
└── app.e2e-spec.ts
```

## 🔑 Core Entities & Domain Model

### User & Access Management
- **User** - System users (staff, managers, admin)
- **Branch** - Different school canteen locations
- **POSDevice** - Point of sale devices at each branch

### Customer & Student Management
- **Customer** - Customer profiles
- **StudentProfile** - Student information
- **StudentCard** - Student ID cards
- **StudentClass** - Class assignments
- **School** - School information
- **Class** - Academic classes

### Financial & Payment
- **Order** - Customer orders
- **OrderItem** - Individual items in an order
- **Payment** - Payment records
- **Refund** - Refund transactions
- **RefundItem** - Items in a refund
- **Wallet** - Customer wallet/balance
- **WalletTransaction** - Wallet transaction history
- **CashMovement** - Cash flow tracking

### Products & Inventory
- **Product** - Menu items/products
- **Category** - Product categories
- **Cart** - Shopping cart
- **CartItem** - Items in shopping cart
- **InventoryItem** - Inventory management
- **StockLevel** - Current stock levels
- **StockTransaction** - Stock movement history

### Operations
- **Shift** - Work shift management
- **KitchenTicket** - Kitchen order tickets
- **KitchenTicketItem** - Items in kitchen tickets
- **Card** - Card management (possibly payment cards)

## 🔐 Authentication & Authorization

### Overview
The application implements a **multi-strategy authentication system** with **4 different login methods**:

1. **Local Strategy (Email/Password)** - Traditional staff/admin login
2. **Card-Based Login** - Quick access via RFID card (StudentCard table)
3. **Student Login** - Flexible (Card OR Email/Password)
4. **Registration** - Create new user accounts

**Comparison Table:**

| Method | Endpoint | Auth Required | Use Case | Database Lookup |
|--------|----------|---------------|----------|-----------------|
| Email/Password | `POST /auth/login` | LocalAuthGuard | Staff/Admin login | User table |
| Card-Based | `POST /auth/login-card` | Public | Quick POS login | StudentCard → Card → User |
| Student | `POST /auth/login/student` | Public | Kiosk (card or email) | StudentCard OR User table |
| Register | `POST /auth/register` | Public | New user signup | User table (create) |

### Authentication Methods Comparison

**Comparison Table:**

| Method | Endpoint | Auth Required | Use Case | Database Lookup |
|--------|----------|---------------|----------|-----------------|
| Email/Password | `POST /auth/login` | LocalAuthGuard | Staff/Admin login | User table |
| Card-Based | `POST /auth/login-card` | Public | Quick POS login | StudentCard → Card → User |
| Student | `POST /auth/login/student` | Public | Kiosk (card or email) | StudentCard OR User table |
| Register | `POST /auth/register` | Public | New user signup | User table (create) |

### Card-Based Authentication Table Relationships

**Entity Diagram:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ RFID Card Data from Reader                                           │
│ Example: cardId = "0089280076"                                       │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ CARDS Table (cards)                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ ├─ id: UUID (PK)                                                     │
│ ├─ customer_id: UUID (FK)                                            │
│ ├─ cardUid: VARCHAR UNIQUE  ◄──┐ Search by cardId                    │
│ ├─ cardNumber: VARCHAR      ◄──┤ (cardUid OR cardNumber)             │
│ ├─ status: 'ACTIVE'|'LOST'|'BLOCKED' ◄──┐ Validation                │
│ ├─ issued_at: TIMESTAMP                 │                           │
│ └─ (Standard timestamp fields)          │                           │
└──────────────────────┬──────────────────┴───────────────────────────┘
                       │
     [VALIDATE: Card.status = 'ACTIVE']
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STUDENT_CARDS Table (student_cards)                                  │
├──────────────────────────────────────────────────────────────────────┤
│ ├─ id: UUID (PK)                                                     │
│ ├─ card_id: UUID (FK) ◄──────────────┘ [From CARDS table above]      │
│ ├─ student_profile_id: UUID (FK) ──┐                                 │
│ ├─ status: 'ACTIVE' ◄─── Validation                                  │
│ ├─ issued_at: TIMESTAMP                                              │
│ ├─ expired_at: TIMESTAMP ◄────── Validate expiration                 │
│ └─ (Standard timestamp fields)                                       │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
     [VALIDATE: StudentCard.status = 'ACTIVE']
     [VALIDATE: expired_at is not past today]
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STUDENT_PROFILES Table (student_profiles)                            │
├──────────────────────────────────────────────────────────────────────┤
│ ├─ id: UUID (PK)                                                     │
│ ├─ customer_id: UUID UNIQUE (FK) ──┐                                 │
│ ├─ class_id: UUID (FK) ────────────┤ Get Student Info                │
│ ├─ student_code: VARCHAR            │                                │
│ ├─ full_name: VARCHAR               │                                │
│ └─ (Standard timestamp fields)      │                                │
└──────────────────────┬───────────────┘                               │
                       │                                                │
                       ▼                                                │
┌──────────────────────────────────────────────────────────────────────┐
│ CUSTOMERS Table (customers)                                          │
├──────────────────────────────────────────────────────────────────────┤
│ ├─ id: UUID (PK)                                                     │
│ ├─ user_id: UUID (FK) ◄──────── Find User entity                    │
│ ├─ full_name: VARCHAR                                                │
│ ├─ email: VARCHAR                                                    │
│ ├─ phone: VARCHAR                                                    │
│ └─ (Other customer fields)                                           │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
     [VALIDATE: customer.userId exists]
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ USERS Table (users)                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ ├─ id: UUID (PK)                                                     │
│ ├─ email: VARCHAR UNIQUE                                             │
│ ├─ passwordHash: VARCHAR (bcrypt)                                    │
│ ├─ full_name: VARCHAR                                                │
│ ├─ role: 'ADMIN'|'STAFF'|'STUDENT'|'CUSTOMER'                       │
│ ├─ status: 'ACTIVE' ◄──── Final validation                           │
│ ├─ avatar: VARCHAR (nullable)                                        │
│ └─ (Standard timestamp fields)                                       │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
     [VALIDATE: User.status = 'ACTIVE']
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Generate JWT Token                                                   │
├──────────────────────────────────────────────────────────────────────┤
│ Payload:                                                             │
│ {                                                                    │
│   email: user.email,                                                 │
│   userId: user.id,                                                   │
│   userType: user.role,                                               │
│   deviceId: deviceId || 'default-device',                            │
│   iat: timestamp,                                                    │
│   exp: timestamp + 24h                                               │
│ }                                                                    │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Return Response with Student Info                                    │
├──────────────────────────────────────────────────────────────────────┤
│ {                                                                    │
│   accessToken: "eyJhbGc...",                                         │
│   userId: UUID,                                                      │
│   userType: "STUDENT",                                               │
│   deviceId: string,                                                  │
│   fullName: string,                                                  │
│   avatar: string | null,                                             │
│   school: string,        ◄─────── From Class.school_id              │
│   class: string,         ◄─────── From StudentProfile.class_id      │
│   studentCode: string,   ◄─────── From StudentProfile               │
│   studentFullName: string, ◄────── From StudentProfile or Customer  │
│   walletBalance: number  ◄─────── From Wallet.balance               │
│ }                                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

#### 1. **Local Authentication (Email/Password)**
```
POST /auth/login
└─ LocalAuthGuard → LocalStrategy
   └─ AuthService.validateUser()
      └─ Compare password with bcrypt hash
         └─ Return JWT Token
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "deviceId": "device-001"  // optional
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "userId": "uuid",
  "userType": "ADMIN|STAFF|STUDENT|CUSTOMER",
  "deviceId": "device-001",
  "fullName": "John Doe",
  "avatar": "url_or_null",
  "school": "School Name",      // if STUDENT
  "class": "Class A",            // if STUDENT
  "walletBalance": 500000        // if STUDENT
}
```

#### 2. **Card-Based Login**

**Endpoint:** `POST /auth/login-card`

**Request Flow:**
```
POST /auth/login-card
└─ CardLoginDto (cardId, deviceId)
   └─ AuthService.loginByCard()
      ├─ Query StudentCard table:
      │  ├─ Join with Card entity
      │  ├─ Join with StudentProfile
      │  └─ Join with Customer
      └─ Validate:
         ├─ Card exists (cardUid OR cardNumber match)
         ├─ StudentCard.status === 'ACTIVE'
         ├─ Card.status === 'ACTIVE'
         ├─ Card not expired (expiredAt check)
         ├─ Customer linked to User
         └─ User.status === 'ACTIVE'
      └─ Return JWT Token + Student Info
```

**StudentCard Table Structure:**
```sql
Table: student_cards

Columns:
├─ id (UUID, Primary Key)
├─ student_profile_id (UUID, FK → student_profiles)
├─ card_id (UUID, FK → cards)
├─ status (VARCHAR, default='ACTIVE') 
│  └─ Possible values: ACTIVE | INACTIVE
├─ issued_at (TIMESTAMP, nullable)
├─ expired_at (TIMESTAMP, nullable)
├─ created_at (TIMESTAMP)
└─ updated_at (TIMESTAMP)

Foreign Key Relations:
├─ student_profile_id → StudentProfile
│  └─ StudentProfile.customer_id → Customer
│     └─ Customer.userId → User
└─ card_id → Card
```

**Card Table Structure:**
```sql
Table: cards

Columns:
├─ id (UUID, Primary Key)
├─ customer_id (UUID, FK → customers)
├─ card_uid (VARCHAR, UNIQUE)        ← RFID identifier
├─ card_number (VARCHAR)             ← Card number
├─ status (VARCHAR, default='ACTIVE')
│  └─ Possible values: ACTIVE | LOST | BLOCKED
├─ issued_at (TIMESTAMP, nullable)
├─ created_at (TIMESTAMP)
└─ updated_at (TIMESTAMP)
```

**StudentProfile Table Structure:**
```sql
Table: student_profiles

Columns:
├─ id (UUID, Primary Key)
├─ customer_id (UUID, UNIQUE, FK → customers)
├─ class_id (UUID, nullable, FK → classes)
├─ student_code (VARCHAR, nullable)
├─ full_name (VARCHAR, nullable)
├─ created_at (TIMESTAMP)
└─ updated_at (TIMESTAMP)
```

**CardLoginDto:**
```typescript
{
  cardId: string;        // RFID card number or card UID (e.g., "0089280076")
                         // Matches Card.cardUid OR Card.cardNumber
  deviceId?: string;     // Optional device identifier (e.g., "device-12345")
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "userId": "uuid",
  "userType": "STUDENT",
  "deviceId": "device-12345",
  "fullName": "Student Name",
  "avatar": "url_or_null",
  "school": "School Name",
  "class": "Class A",
  "studentCode": "STU001",
  "studentFullName": "Full Name",
  "walletBalance": 500000
}
```

**Validation Checks:**

1. **Card Lookup**
   - Query: `Card.cardUid = :cardId OR Card.cardNumber = :cardId`
   - Throws: `UnauthorizedException('Card not found or not registered')` if no match

2. **StudentCard Status**
   - Must be: `'ACTIVE'`
   - Throws: `UnauthorizedException('Student card is ' + status)` if not ACTIVE

3. **Card Status**
   - Must be: `'ACTIVE'` (not LOST or BLOCKED)
   - Throws: `UnauthorizedException('Card is ' + status)` if not ACTIVE

4. **Expiration Check**
   - If `expiredAt` is set and past current date: EXPIRED
   - Throws: `UnauthorizedException('Student card is expired')`

5. **User Link Validation**
   - Customer must have valid `userId` (linked to User table)
   - Throws: `UnauthorizedException('Card is not linked to a user account')`

6. **User Record Existence**
   - User must exist in database
   - Throws: `UnauthorizedException('User not found')`

7. **User Status**
   - User.status must be: `'ACTIVE'`
   - Throws: `UnauthorizedException('User account is inactive')`

**Example Query (TypeORM):**
```typescript
const studentCard = await this.studentCardRepository
  .createQueryBuilder('studentCard')
  .innerJoinAndSelect('studentCard.card', 'card')
  .innerJoinAndSelect('studentCard.studentProfile', 'studentProfile')
  .innerJoinAndSelect('studentProfile.customer', 'customer')
  .where('(card.cardUid = :cardId OR card.cardNumber = :cardId)', { cardId })
  .getOne();
```

**Use case:** 
- POS terminal RFID card reader → Quick student identification
- No password needed
- Fast checkout at school canteen

#### 3. **Student Login** (Flexible - Card OR Email/Password)

**Endpoint:** `POST /auth/login/student`

**Request Flow:**
```
POST /auth/login/student
└─ StudentLoginDto (cardId OR email+password, deviceId)
   └─ AuthService.loginStudent()
      ├─ IF cardId provided:
      │  ├─ Query StudentCard + Card + StudentProfile + Customer
      │  ├─ Validate card (same as Card-Based Login)
      │  └─ Return JWT Token
      │
      └─ ELSE IF email+password provided:
         ├─ Find User by email
         ├─ Validate password (bcrypt compare)
         ├─ Check user.role === 'STUDENT'
         ├─ Check user.status === 'ACTIVE'
         └─ Return JWT Token
```

**StudentLoginDto:**
```typescript
{
  cardId?: string;       // RFID card number (e.g., "0089280076")
  email?: string;        // Student email (e.g., "student1@pos.local")
  password?: string;     // Student password (required if using email)
  deviceId?: string;     // Optional device identifier
}
```

**Flexible Login Options:**

**Option 1 - Login with Card:**
```json
{
  "cardId": "0089280076",
  "deviceId": "device-12345"
}
```

**Option 2 - Login with Email & Password:**
```json
{
  "email": "student1@pos.local",
  "password": "student123",
  "deviceId": "device-12345"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "userId": "uuid",
  "userType": "STUDENT",
  "deviceId": "device-12345",
  "fullName": "Student Name",
  "avatar": "url_or_null",
  "school": "School Name",
  "class": "Class A",
  "studentCode": "STU001",
  "studentFullName": "Full Name",
  "walletBalance": 500000
}
```

**Validation Rules:**

1. **Input Validation**
   - Either `cardId` OR (`email` AND `password`) must be provided
   - Throws: `UnauthorizedException` if neither provided

2. **Card-Based Login Validation** (if cardId)
   - Same validation as Card-Based Login (see section 2)

3. **Email/Password Login Validation** (if email+password)
   - User must exist with provided email
   - Password must match bcrypt hash
   - User.role must be exactly `'STUDENT'`
   - User.status must be `'ACTIVE'`
   - Throws: `UnauthorizedException` if role is not STUDENT

4. **User Status Check**
   - User.status must be `'ACTIVE'`
   - Throws: `UnauthorizedException` if inactive

**Use case:** Flexible student login at kiosk terminals (card scanner or fallback email/password)

#### 4. **User Registration**
```
POST /auth/register
└─ RegisterDto (email, password, fullName)
   └─ AuthService.register()
      └─ Hash password with bcrypt (salt rounds: 10)
         └─ Create User entity
            └─ Return JWT Token
```

### JWT Token Structure

**Payload:**
```typescript
{
  email: string;
  userId: string;
  userType: 'ADMIN' | 'STAFF' | 'STUDENT' | 'CUSTOMER';
  deviceId: string;
  iat: number;        // issued at
  exp: number;        // expires at
}
```

**Configuration:**
- **Secret Key:** Stored in `JWT_SECRET` environment variable
- **Expiration:** Configurable via `JWT_EXPIRATION` (default: 24h)
- **Algorithm:** HS256 (HMAC with SHA-256)

### Authentication Guards

#### AuthGuard (Global)
Location: [src/common/guard/auth.guard.ts](src/common/guard/auth.guard.ts)

Features:
- Validates JWT tokens from `Authorization: Bearer <token>` header
- Supports public routes via `@Public()` decorator
- Extracts and validates JWT payload
- Throws `UnauthorizedException` on invalid/expired tokens

**Usage:**
```typescript
// Protected route (default)
@Get('protected-resource')
getResource() { }

// Public route
@Public()
@Get('public-resource')
getPublicResource() { }
```

#### RolesGuard
Location: [src/common/guard/roles.guard.ts](src/common/guard/roles.guard.ts)

Features:
- Role-based access control
- Validates user roles against route requirements
- Works with `@Roles()` decorator

**Usage:**
```typescript
@Roles('ADMIN', 'STAFF')
@Get('admin-only')
getAdminResource() { }
```

#### LocalAuthGuard
Location: [src/modules/auth/guards/local-auth.guard.ts](src/modules/auth/guards/local-auth.guard.ts)

- Used only on `/auth/login` endpoint
- Invokes LocalStrategy for credential validation

### Passport Strategies

#### LocalStrategy
Location: [src/modules/auth/strategies/local.strategy.ts](src/modules/auth/strategies/local.strategy.ts)

- **Field:** Uses `email` as username field (not standard `username`)
- **Validation:** Calls `AuthService.validateUser(email, password)`
- **Returns:** User object without password hash

```typescript
constructor(private authService: AuthService) {
  super({ usernameField: 'email' });
}
```

#### JwtStrategy
Location: [src/modules/auth/strategies/jwt.strategy.ts](src/modules/auth/strategies/jwt.strategy.ts)

- **Token Extraction:** From Bearer token in Authorization header
- **Validation:** Verifies signature using JWT_SECRET
- **Returns:** Decoded payload: `{ userId, email, role }`

```typescript
{
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: configService.get('JWT_SECRET')
}
```

### Custom Decorators

#### @Public()
Location: [src/common/decorator/public.decorator.ts](src/common/decorator/public.decorator.ts)

Marks a route as publicly accessible (no auth required)

```typescript
@Public()
@Post('auth/register')
register() { }
```

#### @Roles(...roles)
Location: [src/common/decorator/roles.decorator.ts](src/common/decorator/roles.decorator.ts)

Restricts access to specific user roles

```typescript
@Roles('ADMIN', 'MANAGER')
@Delete('users/:id')
deleteUser(@Param('id') id: string) { }
```

#### @GetUser()
Location: [src/common/decorator/user.decorator.ts](src/common/decorator/user.decorator.ts)

Injects the current authenticated user into the request

```typescript
@Get('profile')
getProfile(@GetUser() user: User) {
  return user;
}
```

### AuthService Methods

Location: [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts)

#### validateUser(email, password)
- Finds user by email
- Compares password with bcrypt hash
- Returns user object (without password) or null

#### login(user, deviceId?)
- Creates JWT payload
- Signs token with JwtService
- Returns token + user info
- Adds student-specific info if role is STUDENT

#### register(email, password, fullName)
- Validates email uniqueness
- Hashes password with bcrypt
- Creates User entity
- Returns JWT token + user info

#### loginByCard(cardId, deviceId)
- Finds StudentCard by cardId
- Validates card status (must be active)
- Returns JWT token with student info

#### loginStudent(dto)
- Accepts email/password OR cardId
- Validates student credentials
- Returns student-specific data

#### getStudentInfo(userId)
- Fetches student profile data
- Gets class and school information
- Returns wallet balance
- Returns combined student info

### AuthModule Configuration

Location: [src/modules/auth/auth.module.ts](src/modules/auth/auth.module.ts)

**Imports:**
- TypeOrmModule: User, Customer, Wallet, StudentProfile, StudentCard, School, Class
- PassportModule: For Passport integration
- JwtModule: Async configuration with ConfigService

**Providers:**
- AuthService
- LocalStrategy
- JwtStrategy

**Exports:**
- AuthService (for other modules)

### Security Features

1. **Password Hashing**
   - Algorithm: bcrypt
   - Salt rounds: 10
   - Passwords never stored in plain text

2. **JWT Security**
   - Signed tokens with secret key
   - Configurable expiration
   - Bearer token in Authorization header

3. **CORS Protection**
   - Configured for specific origins
   - Credentials enabled
   - Production: `https://fe.kidocanteen.kidoedu.vn`
   - Development: `http://localhost:5173`

4. **Token Validation**
   - Expiration checking
   - Signature verification
   - Device ID tracking

### Protected Routes Pattern

```typescript
// Example: Protected route with ADMIN role requirement
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Delete('users/:id')
@ApiOperation({ summary: 'Delete user (Admin only)' })
deleteUser(@Param('id') id: string) {
  // Only ADMIN users can access this
}

// Example: Public route
@Public()
@Post('auth/register')
@ApiOperation({ summary: 'Register new user (Public)' })
register(@Body() dto: RegisterDto) {
  // No auth required
}

// Example: Protected route with student info
@Get('profile')
@ApiOperation({ summary: 'Get current user profile' })
getProfile(@GetUser() user: any) {
  // Requires valid JWT token
  // user object injected from token payload
}
```

### Error Handling

**AuthGuard throws:**
- `UnauthorizedException` - Missing/invalid token
- `ForbiddenException` - Insufficient permissions

**Auth endpoints return:**
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Invalid credentials
- `409 Conflict` - Email already exists (register)

### Environment Variables Required

```bash
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRATION=24h
BCRYPT_ROUNDS=10
```

### User Types/Roles

From [src/common/enum/user-type.enum.ts](src/common/enum/user-type.enum.ts):

- `ADMIN` - Full system access
- `STAFF` - Canteen staff
- `STUDENT` - Student user with card
- `CUSTOMER` - Regular customer
- `MANAGER` - Branch/location manager

### Authentication Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | LocalAuthGuard | Login with email/password |
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login-card` | Public | Login with student card ID |
| POST | `/auth/login/student` | Public | Student login (card or email) |

- **CORS enabled** for:
  - Production: `https://fe.kidocanteen.kidoedu.vn`
  - Development: `http://localhost:5173`

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- npm or yarn
- PostgreSQL database

### Installation
```bash
npm install
```

### Environment Configuration
Create a `.env` file with database connection details:
```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password
DATABASE_NAME=mbh_db
JWT_SECRET=your_jwt_secret
```

### Running the Application

**Development Mode (with watch)**
```bash
npm run start:dev
```

**Production Mode**
```bash
npm run build
npm run start:prod
```

**Debug Mode**
```bash
npm run start:debug
```

### API Documentation
Once the server is running, Swagger documentation is available at:
```
http://localhost:3002/api
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# Test in watch mode
npm run test:watch

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## 🔧 Development Commands

```bash
# Format code with Prettier
npm run format

# Lint code with ESLint
npm run lint

# Build the project
npm run build

# Deploy (runs deploy.sh)
npm run deploy
```

## 📊 Key Features

### 1. Order Management
- Create and manage orders
- Track order status
- Process kitchen tickets
- Order item management

### 2. Financial System
- Payment processing
- Refund management
- Wallet/balance tracking
- Cash movement tracking

Debt limit logic:
- `branches.max_customer_debt` is the branch-level setting for customer debt allowance in that branch.
- `customers.debt_limit` is the remaining debt allowance for one customer.
- Actual customer debt is derived from wallet balance: negative `wallets.balance` means the customer is in debt.
- When a wallet order creates new debt, the new debt amount is deducted from `customers.debt_limit`.
- If the new debt would exceed `customers.debt_limit`, the order is rejected with `Vượt quá số nợ cho phép`.
- When topup or refund reduces a negative wallet balance, that recovered amount is restored to `customers.debt_limit`.

### 3. Inventory Management
- Product catalog
- Stock level tracking
- Inventory transactions
- Category management

### 4. Student & Customer Management
- Student profiles and cards
- Customer wallet system
- Class management
- School organization

### 5. Multi-location Support
- Branch management
- POS device tracking
- Shift management

### 6. Reporting
- Reports module for analytics
- Historical data tracking

## 📝 Module Architecture

Each module typically follows this pattern:

```
module/
├── {feature}.module.ts        # Module definition
├── {feature}.controller.ts    # HTTP endpoints
├── {feature}.service.ts       # Business logic
├── dto/
│   ├── create-{feature}.dto.ts
│   └── update-{feature}.dto.ts
└── {feature}.entity.ts        # Database entity (in entities/)
```

## 🛡️ Global Features

- **Response Interceptor** - Standardized API responses
- **Exception Filter** - Global error handling
- **Validation Pipe** - Input validation using DTOs
- **CORS** - Cross-Origin Resource Sharing enabled
- **JWT Authentication** - Secure token-based auth

## 🗄️ Database

- **ORM**: TypeORM
- **Database**: PostgreSQL
- **Migrations**: 4 migration files for schema initialization
- **Entities**: 29 table entities

## 📦 Dependencies Highlights

- `@nestjs/core` ^11.0.1 - Core NestJS
- `@nestjs/typeorm` ^11.0.1 - TypeORM integration
- `@nestjs/jwt` ^11.0.2 - JWT handling
- `@nestjs/swagger` ^11.4.2 - API documentation
- `typeorm` ^0.3.28 - ORM
- `class-validator` ^0.15.1 - DTO validation
- `bcrypt` ^6.0.0 - Password hashing

## 🎯 Frontend Integration

The backend serves a React + TypeScript frontend located in `mbh-frontend/`:
- Built with Vite
- Uses Tailwind CSS
- Frontend runs on port 5173 (development)
- Backend API port: 3002

## 📞 API Port

The application runs on **port 3002** by default.

---

**Version**: 0.0.1  
**License**: UNLICENSED  
**Last Updated**: 2026
