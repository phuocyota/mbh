# FE Handoff - Student Ordering APIs

Base URL khi chạy qua Vite proxy: `/api`

Các API cần JWT gửi header:

```http
Authorization: Bearer <accessToken>
```

## 1. Parent/Student Home

API lấy thông tin tổng quan cho màn hình Home của phụ huynh/học sinh. Phụ huynh đăng nhập bằng tài khoản học sinh.

```http
GET /api/parent/home
```

**Auth:** Cần JWT của học sinh.

```http
Authorization: Bearer <accessToken>
```

**Response 200:**

```json
{
  "user": {
    "id": "student_5000",
    "fullName": "Test Student 5000",
    "avatarUrl": "https://be.kidocanteen.kidoedu.vn/uploads/avatar.jpg"
  },
  "wallet": {
    "balance": 45000,
    "currency": "VND"
  },
  "notifications": [
    {
      "id": "noti_001",
      "message": "Con da nhan mon",
      "type": "ORDER_RECEIVED",
      "amount": null,
      "isRead": false,
      "createdAt": "2026-05-27T10:30:00+07:00"
    },
    {
      "id": "noti_002",
      "message": "Da tru 30,000d",
      "type": "PAYMENT_DEDUCTED",
      "amount": -30000,
      "isRead": false,
      "createdAt": "2026-05-27T10:31:00+07:00"
    }
  ],
  "todayOrder": {
    "id": "order_001",
    "status": "PREPARING",
    "statusText": "Dang chuan bi",
    "orderedAt": "2026-05-27T09:45:00+07:00",
    "items": [
      {
        "id": "item_001",
        "name": "Com ga",
        "quantity": 2,
        "unitPrice": 15000,
        "totalPrice": 30000
      }
    ],
    "addons": [
      {
        "id": "addon_001",
        "name": "Sua",
        "quantity": 1,
        "price": 0
      }
    ],
    "totalAmount": 30000
  },
  "recentHistory": [
    {
      "id": "txn_001",
      "type": "ORDER_PAYMENT",
      "title": "Com ga",
      "amount": -30000,
      "status": "COMPLETED",
      "statusText": "Hoan thanh",
      "createdAt": "2026-05-27T10:30:00+07:00",
      "orderId": "order_001"
    }
  ],
  "statistics": {
    "week": {
      "spent": 150000,
      "limit": 200000,
      "currency": "VND"
    },
    "month": {
      "spent": 600000,
      "limit": 700000,
      "currency": "VND"
    }
  }
}
```

### Field Notes

| Field | Mô tả |
|-------|-------|
| `user` | Thông tin học sinh (id, fullName, avatarUrl) |
| `wallet.balance` | Số dư hiện tại (number) |
| `notifications` | 5 thông báo gần nhất |
| `todayOrder` | Đơn hàng hôm nay, `null` nếu chưa có |
| `recentHistory` | 5 giao dịch gần nhất |
| `statistics.week/month` | Chi tiêu và giới hạn để hiển thị progress bar |
| `createdAt`, `orderedAt` | ISO datetime có timezone |

### Enums

```ts
type OrderStatus = "PENDING" | "PREPARING" | "READY" | "RECEIVED" | "CANCELLED";

type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

type NotificationType =
  | "ORDER_CREATED"
  | "ORDER_RECEIVED"
  | "PAYMENT_DEDUCTED"
  | "TOPUP_SUCCESS"
  | "SYSTEM";

type TransactionType = "ORDER_PAYMENT" | "TOPUP" | "REFUND";
```

### Error Response

```json
{
  "message": "Unauthorized",
  "error": "UNAUTHORIZED",
  "statusCode": 401
}
```

---

## 2. Student Login

Chỉ dùng endpoint này cho học sinh. Không dùng `/auth/login` hoặc `/auth/login-card`.

```http
POST /api/auth/login/student
```

Login bằng thẻ:

```json
{
  "cardId": "0089615227",
  "deviceId": "student-app"
}
```

Login bằng email/password:

```json
{
  "email": "student1@pos.local",
  "password": "student123",
  "deviceId": "student-app"
}
```

Response chính:

```json
{
  "accessToken": "jwt-token",
  "userId": "uuid",
  "userType": "STUDENT",
  "deviceId": "student-app",
  "fullName": "Nguyen Van A",
  "avatar": null,
  "school": "Ten truong",
  "class": "6A1",
  "studentCode": "STU001",
  "studentFullName": "Nguyen Van A",
  "walletBalance": 100000
}
```

## 3. Category + Products Full

Lấy toàn bộ category đang active kèm products đang active.

```http
GET /api/products/full
GET /api/products/full?minPrice=10000&maxPrice=20000
```

Auth: cần JWT.

Query filter:

- `minPrice`: gia nho nhat, optional.
- `maxPrice`: gia lon nhat, optional.

Response:

```json
[
  {
    "id": "category-id",
    "name": "Do an",
    "sortOrder": 1,
    "status": "ACTIVE",
    "products": [
      {
        "id": "product-id",
        "categoryId": "category-id",
        "sku": "SKU001",
        "name": "Banh mi",
        "description": null,
        "imageUrl": null,
        "price": "15000.00",
        "unit": "cai",
        "isActive": true
      }
    ]
  }
]
```

## 4. Cart APIs

Các API cart dùng JWT của học sinh. Flow FE chính dùng giỏ hàng theo token, từ lấy giỏ hàng, thêm món, xác nhận, đến xử lý thanh toán.

### Lấy giỏ hàng hiện tại

```http
GET /api/cart/me
```

### Thêm sản phẩm vào giỏ

```http
POST /api/cart/me/items
```

Body:

```json
{
  "productId": "product-id",
  "quantity": 2,
  "note": "Less sugar"
}
```

### Cập nhật số lượng

```http
PUT /api/cart/me/items/:itemId
```

Body:

```json
{
  "quantity": 3
}
```

Nếu `quantity <= 0`, BE sẽ xóa item khỏi cart.

### Xóa item

```http
DELETE /api/cart/me/items/:itemId
```

### Xác nhận giỏ hàng

```http
POST /api/cart/me/complete
```

Auth: JWT của học sinh.

BE sẽ tự xử lý theo token:

1. Lấy `userId` từ JWT.
2. Tìm `customer` gắn với `userId`.
3. Lấy cart hiện tại của customer.
4. Tạo order từ cart items.
5. Lưu `paymentMethod` vào order.
6. Nếu `paymentMethod = WALLET`, kiểm tra ví, trừ ví, tạo payment, ghi wallet transaction.
7. Nếu `paymentMethod = CASH`, chuyển order sang `PENDING_PAYMENT`.
8. Clear cart sau khi xử lý thành công.

Body thanh toán ví:

```json
{
  "branchId": "branch-id",
  "posDeviceId": "device-id",
  "paymentMethod": "WALLET",
  "orderType": "TAKEAWAY",
  "note": "Ghi chu"
}
```

Body chọn trả tiền mặt:

```json
{
  "branchId": "branch-id",
  "posDeviceId": "device-id",
  "paymentMethod": "CASH",
  "orderType": "TAKEAWAY"
}
```

Với `paymentMethod = CASH`, order sẽ có:

```json
{
  "order": {
    "status": "PENDING_PAYMENT",
    "paymentMethod": "CASH"
  },
  "payment": null,
  "nextAction": "WAITING_FOR_CASHIER_PAYMENT"
}
```

## 5. Orders For Cashier / Counter

Các API order dùng JWT của staff/cashier.

### Danh sách đơn đợi thu tiền mặt

```http
GET /api/orders/pending-cash
GET /api/orders/pending-cash?branchId=branch-id
```

BE lọc theo `orders.status = PENDING_PAYMENT`.

Order vẫn lưu thêm `paymentMethod = CASH` trong bảng `orders` để FE hiển thị/audit.

### Danh sách đơn đang chuẩn bị

```http
GET /api/orders/preparing
GET /api/orders/preparing?branchId=branch-id
```

BE lọc theo `orders.status = PREPARING`.

### Danh sách đơn hoàn thành

Dùng endpoint chung:

```http
GET /api/orders?status=DONE
GET /api/orders?status=DONE&branchId=branch-id
```

### Xem chi tiết order

```http
GET /api/orders/:orderId
```

Response có `items`, `payments`, `customer`.

Order response có field `paymentMethod`:

```json
{
  "id": "order-id",
  "status": "PENDING_PAYMENT",
  "paymentStatus": "UNPAID",
  "paymentMethod": "CASH"
}
```

## 6. Confirm Customer Received Order

Có 2 hướng xác nhận.

### Học sinh tự xác nhận

```http
PUT /api/orders/me/:orderId/received
```

Auth: JWT của học sinh.

BE sẽ check order thuộc customer của học sinh trong token. Nếu hợp lệ, order chuyển `status = DONE`.

### Thu ngân xác nhận giúp khách

```http
PUT /api/orders/:orderId/received
```

Auth: JWT của thu ngân/staff.

Không lấy order từ token, chỉ dùng `orderId`. Nếu order đã thanh toán đủ, order chuyển `status = DONE`.

## 7. Cancel Order

Thu ngân hủy đơn qua `orderId`.

```http
PUT /api/orders/:orderId/cancel
```

Body:

```json
{
  "reason": "Khach doi mon",
  "isRefunded": true
}
```

Lưu ý hiện BE set status hủy là `cancelled`.

## 8. Status FE Can Use

Các status quan trọng hiện tại:

```ts
type OrderStatus =
  | 'Pending'
  | 'PENDING_PAYMENT'
  | 'PREPARING'
  | 'DONE'
  | 'cancelled';
```

Mapping gợi ý:

```ts
const orderStatusLabel = {
  Pending: 'Moi tao',
  PENDING_PAYMENT: 'Doi thu tien mat',
  PREPARING: 'Dang chuan bi',
  DONE: 'Hoan thanh',
  cancelled: 'Da huy',
};
```
