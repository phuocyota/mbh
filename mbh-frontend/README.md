# MBH POS Frontend

Frontend React cho hệ thống POS canteen/trường học.

## Stack

- Vite + React 18 + TypeScript
- React Router v6
- Tailwind CSS v3
- Zustand (state)
- Axios (HTTP)
- Lucide React (icons)

## Cài đặt

```bash
npm install
```

## Cấu hình

Tạo `.env` từ `.env.example`:

```bash
copy .env.example .env
```

Mặc định backend ở `http://localhost:3001`. Vite proxy `/api` → backend nên không cần đổi gì khi dev local.

## Chạy

```bash
# Dev (port 5173)
npm run dev

# Build production
npm run build

# Preview build
npm run preview
```

## Cấu trúc

```
src/
├── components/      Layout, ProtectedRoute
├── pages/          Login, POS, Orders, Customers, Reports
├── store/          auth, cart (Zustand)
├── lib/            api (axios), format helpers
├── App.tsx         Routes
└── main.tsx        Entry
```

## Tính năng

- **Login**: JWT auth, lưu token vào localStorage, auto-logout khi 401
- **POS Dashboard**: chọn chi nhánh/thiết bị, danh mục → sản phẩm, giỏ hàng, quẹt thẻ NFC, thanh toán CASH/WALLET
- **Orders**: danh sách + filter trạng thái, xem chi tiết items + payments
- **Customers**: tìm kiếm, xem ví, nạp tiền, lịch sử giao dịch
- **Reports**: doanh thu tổng + theo ngày, top sản phẩm, breakdown phương thức TT, tồn kho

## Tài khoản test

Sau khi seed (`POST /api/seed` ở backend):

| Email | Password | Role |
|-------|----------|------|
| admin@pos.local | admin123 | ADMIN |
| cashier1@pos.local | cashier123 | CASHIER |
| kitchen1@pos.local | kitchen123 | KITCHEN |
