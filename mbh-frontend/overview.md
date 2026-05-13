# MBH Frontend Overview

Tài liệu này giúp đọc nhanh toàn bộ source frontend của hệ thống MBH POS.

## Tổng quan

Đây là ứng dụng POS frontend viết bằng Vite, React 18, TypeScript, React Router, Tailwind CSS, Zustand và Axios.

Chức năng chính:

- Đăng nhập bằng JWT.
- Bán hàng POS: chọn chi nhánh, thiết bị POS, sản phẩm, giỏ hàng, quét thẻ khách hàng, thanh toán tiền mặt hoặc ví.
- Quản lý đơn hàng: danh sách, lọc trạng thái, xem chi tiết item và payment.
- Quản lý khách hàng: tìm kiếm, xem ví, nạp tiền, xem lịch sử giao dịch.
- Báo cáo: doanh thu, doanh thu theo ngày, top sản phẩm, phương thức thanh toán, tồn kho.
- Có thêm màn hình kiosk tự phục vụ trong `src/pages/Kiosk.tsx`, nhưng hiện chưa được khai báo route trong `src/App.tsx`.

## Stack và lệnh chạy

File chính: `package.json`

- `npm run dev`: chạy Vite dev server.
- `npm run build`: TypeScript build rồi Vite build.
- `npm run preview`: preview bản build.

Thư viện đáng chú ý:

- `react`, `react-dom`: UI.
- `react-router-dom`: routing.
- `zustand`: state local cho auth và cart.
- `axios`: HTTP client.
- `lucide-react`: icon.
- `tailwindcss`: styling.

## Cấu trúc thư mục

```text
src/
  main.tsx                  Entry point React
  App.tsx                   Khai báo routes
  index.css                 Tailwind base + component classes
  types.ts                  TypeScript interfaces dùng chung

  components/
    Layout.tsx              Sidebar, navigation, logout, Outlet
    ProtectedRoute.tsx      Chặn route khi chưa có token

  lib/
    api.ts                  Axios instance, JWT interceptor, xử lý lỗi
    format.ts               Helper format tiền và ngày

  store/
    auth.ts                 Zustand store cho user/token
    cart.ts                 Zustand store cho giỏ hàng POS

  pages/
    Login.tsx               Màn hình đăng nhập
    POS.tsx                 Màn hình bán hàng chính
    Orders.tsx              Danh sách và chi tiết đơn hàng
    Customers.tsx           Khách hàng, ví, nạp tiền
    Reports.tsx             Báo cáo doanh thu/tồn kho
    Kiosk.tsx               Màn hình kiosk tự phục vụ
```

## Thứ tự đọc source khuyến nghị

1. `package.json`

   Nắm stack, script chạy và dependency.

2. `src/main.tsx`

   Entry point render React. App được bọc bởi `BrowserRouter`.

3. `src/App.tsx`

   Nắm routing:

   - `/login` render `Login`.
   - Các route bên trong `ProtectedRoute` và `Layout`:
     - `/` render `POS`.
     - `/orders` render `Orders`.
     - `/customers` render `Customers`.
     - `/reports` render `Reports`.
   - Route không khớp redirect về `/`.

4. `src/types.ts`

   Nắm các TypeScript interfaces dùng chung:

   - Tất cả interfaces đã được tách ra từ các file pages.
   - Bao gồm: `Product`, `Category`, `Branch`, `POSDevice`, `Customer`, `WalletInfo`, `WalletTx`, `Order`, `RevenueSummary`, `DailyRow`, `TopProduct`, `CardScanResult`, `CartItem`, `CheckoutResult`, `DashboardData`, `Stage`.
   - Các file pages import từ file này thay vì định nghĩa interface cục bộ.

5. `src/lib/api.ts`

   Nắm cách gọi backend:

   - `api` là Axios instance.
   - `baseURL` mặc định rỗng để request same-origin `/api/...`.
   - Có thể override bằng `VITE_API_BASE_URL`.
   - Request interceptor tự thêm `Authorization: Bearer <token>` từ `localStorage`.
   - Response interceptor tự logout và redirect `/login` khi backend trả `401`.
   - `extractError()` gom lỗi Axios thành chuỗi hiển thị.

6. `src/store/auth.ts`

   Nắm auth state:

   - Load `access_token` và `user` từ `localStorage`.
   - `setAuth(user, token)` lưu vào `localStorage` và Zustand.
   - `logout()` xóa localStorage và reset state.

7. `src/store/cart.ts`

   Nắm POS cart state:

   - Danh sách item.
   - Khách hàng đang gắn với giỏ.
   - Số dư ví.
   - Các action thêm, giảm, xóa, set quantity, clear, tính subtotal.

8. `src/components/Layout.tsx` và `src/components/ProtectedRoute.tsx`

   Nắm shell UI và route guard.

9. Đọc các màn hình trong `src/pages/` theo luồng nghiệp vụ:

   - `Login.tsx`
   - `POS.tsx`
   - `Orders.tsx`
   - `Customers.tsx`
   - `Reports.tsx`
   - `Kiosk.tsx`

10. `src/index.css` và `tailwind.config.js`

    Nắm style chung, class component như `btn-primary`, `input`, `card`, `label`, và palette `brand`.

## Luồng authentication

1. Người dùng vào `/login`.
2. `Login.tsx` gọi `POST /api/auth/login`.
3. Backend trả `access_token` và `user`.
4. `useAuth.setAuth()` lưu token/user vào `localStorage`.
5. User được navigate về `/`.
6. Các request sau đó được `api.ts` tự thêm Bearer token.
7. Nếu request trả `401`, interceptor xóa token/user và redirect về `/login`.

## Luồng routing và layout

`App.tsx` đặt `ProtectedRoute` bọc quanh `Layout`.

Điều này nghĩa là mọi route nghiệp vụ đều cần token. `Layout` cung cấp sidebar và render page con qua `<Outlet />`.

Navigation hiện có:

- Bán hàng: `/`
- Đơn hàng: `/orders`
- Khách hàng: `/customers`
- Báo cáo: `/reports`

Lưu ý: `Kiosk.tsx` tồn tại nhưng chưa có route trong `App.tsx`.

## Luồng POS bán hàng

File chính: `src/pages/POS.tsx`

Khi mount, màn hình POS load song song:

- `GET /api/products/categories`
- `GET /api/products`
- `GET /api/branches`
- `GET /api/pos-devices`

Người dùng thao tác:

1. Chọn chi nhánh và thiết bị POS.
2. Tìm/lọc sản phẩm.
3. Bấm sản phẩm để thêm vào `useCart`.
4. Có thể nhập/quét UID thẻ.
5. `handleScanCard()` gọi `GET /api/customers/by-card/:uid`.
6. Nếu tìm được khách, cart lưu `customerId`, `customerName`, `walletBalance`.
7. Bấm thanh toán.
8. `submitPayment()` thực hiện:
   - `POST /api/orders` để tạo đơn.
   - Lặp từng item, gọi `POST /api/orders/:orderId/items`.
   - `POST /api/orders/:orderId/payments`.
   - `PUT /api/orders/:orderId/complete`.
9. Thành công thì clear cart và hiển thị mã đơn.

## Luồng đơn hàng

File chính: `src/pages/Orders.tsx`

Danh sách đơn:

- `GET /api/orders`
- Có thể truyền `status` qua query params.

Chi tiết đơn:

- `GET /api/orders/:id`
- Hiển thị thông tin đơn, item, payment và tổng tiền.

## Luồng khách hàng và ví

File chính: `src/pages/Customers.tsx`

Tìm khách hàng:

- `GET /api/customers/search?keyword=...`

Mở chi tiết khách hàng sẽ load song song:

- `GET /api/wallets/customer/:customerId/balance`
- `GET /api/wallets/customer/:customerId/transactions?size=30`

Nạp tiền:

- `POST /api/wallets/topup`
- Body gồm `customerId`, `amount`, `note`.
- Sau khi nạp tiền thành công, màn hình refresh lại ví và giao dịch.

## Luồng báo cáo

File chính: `src/pages/Reports.tsx`

Mặc định lấy khoảng 7 ngày gần nhất. Khi tải báo cáo, gọi song song:

- `GET /api/reports/revenue?from=...&to=...`
- `GET /api/reports/revenue/daily?from=...&to=...`
- `GET /api/reports/top-products?from=...&to=...&limit=10`
- `GET /api/reports/stock`

UI hiển thị:

- Doanh thu thuần.
- Tổng đơn.
- Hoàn tiền.
- Tổng giảm giá.
- Doanh thu theo ngày.
- Breakdown phương thức thanh toán.
- Top sản phẩm bán chạy.
- Tồn kho hiện tại.

## Luồng kiosk

File chính: `src/pages/Kiosk.tsx`

Kiosk dùng state machine đơn giản qua `stage`:

- `IDLE`: chờ quét thẻ.
- `LOADING`: xác thực thẻ.
- `MENU`: chọn món.
- `PROCESSING`: gửi checkout.
- `SUCCESS`: hiển thị thành công rồi tự quay về idle.
- `ERROR`: hiển thị lỗi.

Cấu hình kiosk lấy từ query hoặc `localStorage`:

- `branch`: `branchId`
- `device`: `posDeviceId`

Ví dụ URL dự kiến:

```text
/kiosk?branch=<BRANCH_ID>&device=<POS_DEVICE_ID>
```

API kiosk:

- `GET /api/kiosk/card/:uid`
- `POST /api/kiosk/checkout`

Lưu ý quan trọng: route `/kiosk` chưa được đăng ký trong `src/App.tsx`, nên màn này chưa truy cập được qua router hiện tại nếu không thêm route.

## State management

Ứng dụng dùng Zustand cho hai nhóm state:

- `useAuth`: state đăng nhập, token, user.
- `useCart`: giỏ hàng và khách hàng được gắn với giỏ POS.

Các page còn lại chủ yếu dùng local state bằng `useState`, load dữ liệu bằng `useEffect`.

## API endpoints frontend đang gọi

Auth:

- `POST /api/auth/login`

Products:

- `GET /api/products`
- `GET /api/products/categories`

Branches và devices:

- `GET /api/branches`
- `GET /api/pos-devices`

Customers:

- `GET /api/customers/search`
- `GET /api/customers/by-card/:cardUid`

Wallets:

- `GET /api/wallets/customer/:customerId/balance`
- `GET /api/wallets/customer/:customerId/transactions`
- `POST /api/wallets/topup`

Orders:

- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `POST /api/orders/:orderId/items`
- `POST /api/orders/:orderId/payments`
- `PUT /api/orders/:orderId/complete`

Reports:

- `GET /api/reports/revenue`
- `GET /api/reports/revenue/daily`
- `GET /api/reports/top-products`
- `GET /api/reports/stock`

Kiosk:

- `GET /api/kiosk/card/:uid`
- `POST /api/kiosk/checkout`

## Styling

`src/index.css` định nghĩa các class component dùng lại:

- `.btn`
- `.btn-primary`
- `.btn-secondary`
- `.btn-danger`
- `.input`
- `.card`
- `.label`

Các component chủ yếu dùng Tailwind utility trực tiếp. Màu thương hiệu nằm trong `tailwind.config.js` dưới key `brand`.

## Ghi chú kỹ thuật

- Source hiện chưa có test.
- Một số file build/generated đang có trong workspace như `dist/`, `*.tsbuildinfo`, `vite.config.js`, `vite.config.d.ts`.
- `README.md` đang bị hiển thị lỗi encoding trong terminal PowerShell, nhưng source TypeScript có thể vẫn là UTF-8. Nếu sửa text tiếng Việt, nên dùng editor lưu UTF-8.
- `Kiosk.tsx` có nhiều logic hoàn chỉnh nhưng chưa nối route.
- `POS.tsx` đang tạo order theo nhiều request tuần tự: tạo order, thêm từng item, tạo payment, complete order. Nếu backend có endpoint checkout tổng hợp, có thể giảm rủi ro partial failure.

## Khi muốn sửa hoặc mở rộng

- Thêm page mới: tạo file trong `src/pages/`, thêm route trong `src/App.tsx`, thêm nav item trong `src/components/Layout.tsx` nếu cần hiện trên sidebar.
- Thêm API call: dùng `api` từ `src/lib/api.ts` để tự có token và xử lý `401`.
- Thêm state dùng chung: tạo store mới trong `src/store/` nếu state được dùng bởi nhiều page/component.
- Thêm style dùng lại: cân nhắc thêm class trong `@layer components` của `src/index.css`.
- Thêm route kiosk: import `Kiosk` trong `src/App.tsx` và khai báo route phù hợp, thường nên cân nhắc kiosk có cần `ProtectedRoute` hay không.
