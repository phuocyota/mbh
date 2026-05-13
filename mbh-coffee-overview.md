# MBH Coffee / MBH POS - Project Overview

> Ghi chú: trong workspace `c:\Users\Admin\code\work\mbh` hiện không có thư mục tên `mbh-coffee`. Overview này được tạo dựa trên cấu trúc project hiện có: backend NestJS ở root và frontend React trong `mbh-frontend`.

## 1. Tổng quan

Project là hệ thống POS cho mô hình canteen/cafe/trường học, gồm:

- Backend API: NestJS + TypeScript + TypeORM + PostgreSQL.
- Frontend web app: React 18 + Vite + TypeScript + Tailwind CSS.
- Domain chính: POS bán hàng, đơn hàng, sản phẩm, khách hàng, ví điện tử, thẻ, thanh toán, ca làm việc, hoàn tiền, bếp, tồn kho và báo cáo.

## 2. Cấu trúc cấp cao

```text
mbh/
├── src/                    # Backend NestJS
├── mbh-frontend/           # Frontend React/Vite
├── test/                   # Test e2e/backend
├── dist/                   # Build output backend
├── node_modules/           # Dependencies backend
├── package.json            # Scripts/dependencies backend
├── ormconfig.js            # TypeORM config
├── nest-cli.json           # Nest CLI config
├── tsconfig*.json          # TypeScript config backend
├── *.md                    # Tài liệu, guide, summary
└── Tong_hop_DB_design_he_thong_POS.pdf
```

## 3. Backend

Backend nằm trực tiếp trong thư mục root `src/`.

```text
src/
├── app.module.ts           # Root module, import toàn bộ feature modules
├── main.ts                 # Bootstrap app, CORS, ValidationPipe, Swagger
├── data-source.ts          # TypeORM data source
├── config/                 # Cấu hình database
├── common/                 # Shared DTO, guards, filters, interceptors, utils
├── entities/               # TypeORM entities tập trung
├── migrations/             # Database migrations
└── modules/                # Feature modules
```

### Backend stack

- NestJS 11
- TypeORM 0.3
- PostgreSQL driver `pg`
- JWT auth với Passport
- Swagger tại `/api/docs`
- Validation bằng `class-validator` và `ValidationPipe`
- Global exception filter: `AllExceptionsFilter`

### Backend modules chính

```text
modules/
├── auth/                   # Login, JWT, local strategy, guards
├── seed/                   # Seed dữ liệu test
├── user/                   # Người dùng hệ thống
├── branch/                 # Chi nhánh
├── pos-device/             # Thiết bị POS
├── customer/               # Khách hàng
├── student-profile/        # Hồ sơ học sinh/khách theo trường học
├── card/                   # Thẻ/NFC
├── wallet/                 # Ví
├── wallet-transaction/     # Giao dịch ví
├── category/               # Danh mục sản phẩm
├── products/               # Sản phẩm
├── orders/                 # Đơn hàng, kiosk checkout
├── order-item/             # Dòng sản phẩm trong đơn
├── payment/                # Thanh toán
├── refund/                 # Hoàn tiền
├── refund-item/            # Chi tiết hoàn tiền
├── shift/                  # Ca bán hàng
├── cash-movement/          # Thu/chi tiền mặt
├── kitchen-ticket/         # Phiếu bếp
├── kitchen-ticket-item/    # Chi tiết phiếu bếp
├── stock-level/            # Tồn kho
├── stock-transaction/      # Giao dịch kho
├── inventory-item/         # Vật tư/hàng tồn
└── reports/                # Báo cáo doanh thu, tồn kho
```

### Entities chính

Các entity được gom trong `src/entities/`, ví dụ:

- `user`, `branch`, `pos-device`
- `customer`, `student-profile`, `card`
- `wallet`, `wallet-transaction`
- `category`, `product`
- `order`, `order-item`, `payment`
- `refund`, `refund-item`
- `shift`, `cash-movement`
- `kitchen-ticket`, `kitchen-ticket-item`
- `inventory-item`, `stock-level`, `stock-transaction`

## 4. Frontend

Frontend nằm trong `mbh-frontend/`.

```text
mbh-frontend/
├── src/
│   ├── App.tsx             # React Router routes
│   ├── main.tsx            # Entry point
│   ├── index.css           # Tailwind/global styles
│   ├── components/         # Layout, ProtectedRoute
│   ├── pages/              # Login, POS, Orders, Customers, Reports, Kiosk
│   ├── store/              # Zustand stores: auth, cart
│   └── lib/                # Axios API client, format helpers
├── package.json            # Scripts/dependencies frontend
├── vite.config.ts          # Vite config/proxy
├── tailwind.config.js      # Tailwind config
└── README.md               # Hướng dẫn frontend
```

### Frontend stack

- React 18
- Vite 5
- TypeScript
- Tailwind CSS
- React Router v6
- Zustand
- Axios
- Lucide React

### Frontend routes

Trong `mbh-frontend/src/App.tsx`:

- `/login`: màn hình đăng nhập
- `/`: POS chính
- `/orders`: danh sách và chi tiết đơn hàng
- `/customers`: khách hàng, ví, nạp tiền, lịch sử giao dịch
- `/reports`: báo cáo
- `*`: redirect về `/`

Các route trừ `/login` được bọc bởi `ProtectedRoute` và dùng layout chung.

## 5. Luồng chức năng chính

1. Người dùng đăng nhập qua backend auth, frontend lưu JWT trong `localStorage`.
2. Frontend gọi API qua Axios client trong `src/lib/api.ts`.
3. Token được tự động gắn vào header `Authorization: Bearer ...`.
4. Nếu backend trả `401`, frontend tự xóa token/user và chuyển về `/login`.
5. POS hỗ trợ chọn chi nhánh/thiết bị, chọn sản phẩm, giỏ hàng và thanh toán.
6. Hệ thống có các module phụ trợ cho ví, thẻ, khách hàng, tồn kho, phiếu bếp và báo cáo.

## 6. Lệnh chạy

Backend:

```bash
npm install
npm run start:dev
```

Mặc định backend chạy ở port `3002`. Swagger ở:

```text
http://localhost:3002/api/docs
```

Frontend:

```bash
cd mbh-frontend
npm install
npm run dev
```

Mặc định frontend Vite chạy ở:

```text
http://localhost:5173
```

## 7. Nhận xét nhanh

- Kiến trúc backend đang theo pattern module/controller/service/dto của NestJS.
- Entity được centralize trong `src/entities`, giúp dễ nhìn domain model tổng thể.
- Frontend nhỏ gọn, chia theo page-level feature thay vì chia quá sâu.
- Repo có nhiều tài liệu hỗ trợ như `DEVELOPER_GUIDE.md`, `QUICK_REFERENCE.md`, `IMPLEMENTATION_GUIDE.md`, `MODULE_PATTERN_CENTRALIZED_ENTITIES.md`.
- Một số file README/log có dấu tiếng Việt bị lỗi encoding khi đọc từ terminal, nên nên kiểm tra lại encoding nếu cần polish tài liệu.
