# 🎯 POS System - Hệ Thống Bán Hàng Canteen/Trường Học

Hệ thống POS (Point of Sale) hoàn chỉnh cho canteen, trường học, hoặc quầy bán hàng. Hỗ trợ:
- ✅ Quản lý sản phẩm & danh mục
- ✅ Tạo đơn hàng & thanh toán đa phương thức
- ✅ Ví điện tử & nạp tiền
- ✅ Quản lý học sinh / khách hàng
- ✅ Thẻ NFC/RFID
- ✅ Quản lý nhân viên & ca làm việc
- ✅ Hoàn tiền & điều chỉnh
- ✅ Báo cáo doanh thu

---

## 📋 Nội Dung

1. [Yêu Cầu](#yêu-cầu)
2. [Cài Đặt](#cài-đặt)
3. [Cấu Hình Database](#cấu-hình-database)
4. [API Documentation](#api-documentation)
5. [Seed Data](#seed-data)
6. [Frontend Setup](#frontend-setup)
7. [Deployment](#deployment)

---

## 🔧 Yêu Cầu

- Node.js >= 16
- PostgreSQL >= 12
- npm hoặc yarn

---

## 📥 Cài Đặt

### 1. Clone & Install

```bash
cd mbh
npm install
```

### 2. Cấu Hình Environment

Tạo file `.env` ở root (hoặc copy từ `.env.example`):

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=pos_system

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=24h

# Server
PORT=3000
NODE_ENV=development
```

### 3. Tạo Database

```bash
createdb pos_system  # PostgreSQL
```

### 4. Chạy Migrations

```bash
npm run typeorm migration:run
```

Hoặc nếu sử dụng migration thủ công:

```bash
npm run start:dev
# API sẽ chạy tại http://localhost:3000
# Migrations sẽ tự động chạy
```

### 5. Seed Sample Data

```bash
# Gọi API để seed data
curl -X POST http://localhost:3000/api/seed
```

---

## 🗄️ Cấu Hình Database

### Database Schema

Hệ thống sử dụng 19 bảng chính:

| Nhóm | Bảng | Mô Tả |
|------|------|-------|
| **Người Dùng** | users | Nhân viên, admin, quản lý |
| **Chi Nhánh** | branches | Quầy POS, chi nhánh |
| | pos_devices | Máy POS, handheld, tablet |
| **Khách Hàng** | customers | Học sinh, khách hàng |
| | cards | Thẻ NFC/RFID |
| | student_profiles | Hồ sơ học sinh |
| **Ví** | wallets | Ví nội bộ |
| | wallet_transactions | Lịch sử giao dịch |
| **Sản Phẩm** | categories | Danh mục |
| | products | Món ăn, sản phẩm |
| **Đơn Hàng** | orders | Đơn hàng |
| | order_items | Chi tiết mặt hàng |
| **Thanh Toán** | payments | Thanh toán |
| **Hoàn Tiền** | refunds | Hoàn tiền |
| | refund_items | Chi tiết hoàn |
| **Ca Làm Việc** | shifts | Ca bán hàng |
| | cash_movements | Ghi nhận tiền mặt |
| **Bếp** | kitchen_tickets | Phiếu bếp |
| | kitchen_ticket_items | Chi tiết phiếu |

---

## 🔐 API Documentation

### 1. Authentication

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "cashier1@pos.local",
  "password": "cashier123"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "cashier1@pos.local",
    "full_name": "Cashier 1",
    "role": "CASHIER"
  }
}
```

#### Register (User Baru)
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "newuser@pos.local",
  "password": "password123",
  "fullName": "New User"
}
```

**Headers cho các API còn lại:**
```
Authorization: Bearer {access_token}
```

---

### 2. Products API

#### Lấy Tất Cả Sản Phẩm
```bash
GET /api/products
GET /api/products?categoryId={categoryId}

Response:
[
  {
    "id": "uuid",
    "name": "Hamburger",
    "sku": "BURGER001",
    "price": 35000,
    "category": {
      "id": "uuid",
      "name": "Đồ Ăn Nhanh"
    }
  }
]
```

#### Lấy Danh Mục
```bash
GET /api/products/categories

Response:
[
  {
    "id": "uuid",
    "name": "Đồ Ăn Nhanh",
    "sort_order": 1
  }
]
```

#### Tạo Sản Phẩm
```bash
POST /api/products
Content-Type: application/json

{
  "category_id": "uuid",
  "sku": "PRODUCT001",
  "name": "Sản Phẩm Mới",
  "price": 50000,
  "cost_price": 20000,
  "unit": "phần"
}
```

---

### 3. Orders API

#### Tạo Đơn Hàng
```bash
POST /api/orders
Content-Type: application/json

{
  "branch_id": "uuid",
  "pos_device_id": "uuid",
  "customer_id": "uuid", // optional
  "cashier_id": "uuid",
  "order_type": "DINE_IN" // DINE_IN, TAKEAWAY, PRE_ORDER
}

Response:
{
  "id": "uuid",
  "order_code": "ORD1704067200000ABC123",
  "status": "DRAFT",
  "subtotal": 0,
  "total_amount": 0,
  "payment_status": "UNPAID"
}
```

#### Thêm Mặt Hàng Vào Đơn
```bash
POST /api/orders/{orderId}/items
Content-Type: application/json

{
  "product_id": "uuid",
  "product_name": "Hamburger",
  "unit_price": 35000,
  "quantity": 2,
  "subtotal": 70000,
  "discount_amount": 0,
  "total_amount": 70000
}

Response:
{
  "id": "uuid",
  "order_id": "uuid",
  "product_name": "Hamburger",
  "quantity": 2,
  "total_amount": 70000
}
```

#### Thanh Toán Đơn Hàng
```bash
POST /api/orders/{orderId}/payments
Content-Type: application/json

// Thanh toán bằng tiền mặt
{
  "method": "CASH",
  "amount": 70000,
  "created_by": "uuid"
}

// Hoặc thanh toán bằng ví
{
  "method": "WALLET",
  "amount": 50000,
  "customer_id": "uuid",
  "created_by": "uuid"
}

// Hoặc kết hợp (30k ví + 40k tiền mặt)
{
  "method": "CASH",
  "amount": 40000,
  "created_by": "uuid"
}
```

#### Hoàn Thành Đơn Hàng
```bash
PUT /api/orders/{orderId}/complete

Response:
{
  "id": "uuid",
  "status": "COMPLETED",
  "completed_at": "2024-01-01T10:30:00Z"
}
```

#### Hủy Đơn Hàng
```bash
PUT /api/orders/{orderId}/cancel

Response:
{
  "id": "uuid",
  "status": "CANCELLED",
  "cancelled_at": "2024-01-01T10:35:00Z"
}
```

#### Lấy Chi Tiết Đơn Hàng
```bash
GET /api/orders/{orderId}

Response:
{
  "id": "uuid",
  "order_code": "ORD1704067200000ABC123",
  "status": "COMPLETED",
  "subtotal": 70000,
  "discount_amount": 0,
  "total_amount": 70000,
  "paid_amount": 70000,
  "items": [
    {
      "id": "uuid",
      "product_name": "Hamburger",
      "quantity": 2,
      "total_amount": 70000
    }
  ],
  "payments": [
    {
      "id": "uuid",
      "method": "CASH",
      "amount": 70000,
      "status": "SUCCESS"
    }
  ]
}
```

---

### 4. Wallet API (Cộng Thêm API)

Cấu trúc hoàn toàn tương tự, cần tạo:

```typescript
// src/modules/wallets/wallet.service.ts
async topup(customerId: string, amount: number, createdBy: string)
async getBalance(customerId: string)
```

---

## 🌱 Seed Data

### Dữ Liệu Mặc Định

Khi chạy seed, hệ thống sẽ tạo:

| Item | Giá Trị |
|------|--------|
| **Users** | 3 tài khoản (admin, cashier, kitchen) |
| **Branches** | 2 canteen |
| **POS Devices** | 3 máy (2 desktop + 1 handheld) |
| **Customers** | 10 học sinh |
| **Cards** | 10 thẻ NFC |
| **Wallets** | 10 ví (số dư random 0-500k) |
| **Categories** | 5 danh mục |
| **Products** | 8 sản phẩm |

### Tài Khoản Test

```
User: Admin
Email: admin@pos.local
Password: admin123
Role: ADMIN

---

User: Cashier 1
Email: cashier1@pos.local
Password: cashier123
Role: CASHIER

---

User: Kitchen Staff 1
Email: kitchen1@pos.local
Password: kitchen123
Role: KITCHEN
```

---

## 🎨 Frontend Setup

### Tech Stack
- React 18
- Vite
- React Router
- TailwindCSS
- Axios

### Tạo Frontend Project

```bash
# Tạo React app
npm create vite@latest mbh-frontend -- --template react
cd mbh-frontend
npm install

# Install dependencies
npm install react-router-dom axios zustand tailwindcss
```

### Folder Structure

```
mbh-frontend/
├── src/
│   ├── components/
│   │   ├── ProductMenu/
│   │   ├── OrderCart/
│   │   ├── PaymentModal/
│   │   ├── Receipt/
│   │   └── Navigation/
│   ├── pages/
│   │   ├── DashboardPage/
│   │   ├── OrderPage/
│   │   ├── CustomersPage/
│   │   ├── ReportsPage/
│   │   └── LoginPage/
│   ├── services/
│   │   ├── api.js
│   │   ├── authService.js
│   │   ├── orderService.js
│   │   ├── productService.js
│   │   └── walletService.js
│   ├── store/
│   │   ├── authStore.js
│   │   ├── orderStore.js
│   │   └── uiStore.js
│   ├── App.jsx
│   └── main.jsx
```

### API Configuration

```javascript
// src/services/api.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Key Pages

**1. Login Page**
```jsx
// Đăng nhập bằng email + password
// Lưu JWT token vào localStorage
```

**2. POS Dashboard**
```jsx
// Main layout:
// - Danh sách sản phẩm (sidebar)
// - Giỏ hàng (center)
// - Thanh toán (right)
```

**3. Order Management**
```jsx
// Xem lịch sử đơn hàng
// Tìm kiếm & filter
// Xem chi tiết đơn hàng
```

**4. Customer Management**
```jsx
// Danh sách khách hàng
// Xem số dư ví
// Nạp tiền
// Xem lịch sử giao dịch
```

**5. Reports**
```jsx
// Doanh thu theo ngày/tháng
// Top sản phẩm bán chạy
// Thống kê ca làm việc
```

---

## 🚀 Running the Application

### Development Mode

```bash
# Terminal 1: Backend
cd mbh
npm run start:dev

# Terminal 2: Frontend
cd mbh-frontend
npm run dev
```

### Access
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

---

## 📊 Quy Trình Bán Hàng Tiêu Biểu

### Flow 1: Quẹt Thẻ → Chọn Món → Thanh Toán

```
1. Quẹt thẻ NFC học sinh
   → GET customer by card_uid
   → Hiển thị tên, số dư ví

2. Chọn sản phẩm
   POST /api/orders (tạo đơn)
   POST /api/orders/{id}/items (thêm mặt hàng)

3. Xem giỏ hàng
   → Hiển thị tổng tiền

4. Thanh toán
   POST /api/orders/{id}/payments
   - WALLET (ưu tiên)
   - CASH (nếu không đủ ví)
   - CARD (nếu có)

5. In bill
   GET /api/orders/{id}
   → In từ order data

6. Hoàn thành
   PUT /api/orders/{id}/complete
```

### Flow 2: Không Có Thẻ

```
1. Tạo đơn mà không có customer_id

2. Chọn & Thanh toán bằng CASH

3. Hoàn thành
```

---

## 🗄️ Backup & Restore Database

### Backup
```bash
pg_dump -U postgres -d pos_system > backup.sql
```

### Restore
```bash
psql -U postgres < backup.sql
```

---

## 🔒 Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Đặt JWT_SECRET an toàn
- [ ] Enable CORS chỉ cho domain của bạn
- [ ] Setup HTTPS/SSL
- [ ] Database backup định kỳ
- [ ] Monitor server logs
- [ ] Rate limiting cho API
- [ ] Input validation
- [ ] Error handling

---

## 📝 Logging & Monitoring

```typescript
// Winston logger setup
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

---

## 🤝 API Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 📚 Script Commands

```json
{
  "scripts": {
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "build": "nest build",
    "test": "jest",
    "test:watch": "jest --watch",
    "typeorm": "typeorm",
    "migration:generate": "typeorm migration:generate",
    "migration:run": "typeorm migration:run",
    "migration:revert": "typeorm migration:revert"
  }
}
```

---

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432

Solution:
1. Check PostgreSQL service: sudo service postgresql status
2. Verify DB_HOST, DB_PORT in .env
3. Check database exists: createdb pos_system
```

### JWT Token Expired
```
Solution:
1. Refresh token (cần implement refresh token endpoint)
2. Login lại để lấy token mới
3. Tăng JWT_EXPIRATION nếu cần
```

### Migration Fails
```bash
# Rollback migration
npm run migration:revert

# Xóa & tạo lại database
dropdb pos_system
createdb pos_system
npm run migration:run
```

---

## 📞 Support

Để có hỗ trợ chi tiết, liên hệ team development hoặc tham khảo [overview.md](overview.md) để xem thiết kế database đầy đủ.

---

## 📄 License

Proprietary - All Rights Reserved

---

**Generated:** January 2024  
**Version:** 1.0.0  
**Status:** MVP Development
