# FE Handoff - Student Ordering APIs

Base URL khi chạy qua Vite proxy: `/api`

Các API cần JWT gửi header:

```http
Authorization: Bearer <accessToken>
```

## 1. Student Login

Chỉ dùng endpoint này cho học sinh. Không dùng `/auth/login` hoặc `/auth/login-card`.

```http
POST /api/auth/login/student
```

Login bằng thẻ:

```json
{
  "cardId": "0089280076",
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

## 2. Category + Products Full

Lấy toàn bộ category đang active kèm products đang active.

```http
GET /api/products/full
```

Auth: cần JWT.

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

## 3. Cart APIs

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

## 4. Orders For Cashier / Counter

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

## 5. Confirm Customer Received Order

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

## 6. Cancel Order

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

## 7. Status FE Can Use

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
