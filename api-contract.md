# API Contract

## Parent Home

Endpoint gom data cho man Home phu huynh/hoc sinh.

```http
GET /parent/home
Authorization: Bearer <accessToken>
```

### Response 200

```json
{
  "user": {
    "id": "student_5000",
    "fullName": "Test Student 5000",
    "avatarUrl": "https://be.kidocanteen.kidoedu.vn/uploads/avatar.jpg"
  },
  "wallet": {
    "balance": 45000
  },
  "notifications": [
    {
      "id": "noti_001",
      "message": "Con đã đặt món Cơm gà",
      "type": "ORDER_CREATED",
      "amount": null,
      "isRead": false,
      "createdAt": "2026-05-29T09:45:00+07:00"
    },
    {
      "id": "noti_002",
      "message": "Đã trừ 30.000đ từ ví",
      "type": "PAYMENT_DEDUCTED",
      "amount": -30000,
      "isRead": false,
      "createdAt": "2026-05-29T09:46:00+07:00"
    },
    {
      "id": "noti_003",
      "message": "Con đã nhận món",
      "type": "ORDER_RECEIVED",
      "amount": null,
      "isRead": true,
      "createdAt": "2026-05-29T10:20:00+07:00"
    }
  ],
  "todayOrder": {
    "id": "order_001",
    "status": "PREPARING",
    "statusText": "Đang chuẩn bị",
    "orderedAt": "2026-05-29T09:45:00+07:00",
    "items": [
      {
        "id": "item_001",
        "name": "Cơm gà",
        "quantity": 2,
        "unitPrice": 15000,
        "totalPrice": 30000
      }
    ],
    "addons": [
      {
        "id": "addon_001",
        "name": "Sữa",
        "quantity": 1,
        "price": 0
      }
    ],
    "totalAmount": 30000
  },
  "recentHistory": [
    {
      "id": "order_001",
      "type": "ORDER_PAYMENT",
      "title": "Cơm gà",
      "amount": -30000,
      "status": "PREPARING",
      "statusText": "Đang chuẩn bị",
      "createdAt": "2026-05-27T10:30:00+07:00",
      "orderId": "order_001"
    },
    {
      "id": "order_002",
      "type": "ORDER_PAYMENT",
      "title": "Bún bò",
      "amount": -25000,
      "status": "RECEIVED",
      "statusText": "Đã nhận",
      "createdAt": "2026-05-27T11:15:00+07:00",
      "orderId": "order_002"
    }
  ],
  "statistics": {
    "week": {
      "spent": 150000,
      "limit": 50000
    },
    "month": {
      "spent": 600000,
      "limit": 50000
    }
  }
}
```

### Field Notes

- `wallet.balance`: so du hien tai cua vi, kieu number. FE tu xu ly don vi tien.
- `notifications`: chi can tra 2-5 thong bao gan nhat cho man Home.
- `todayOrder`: tra `null` neu hom nay chua co order.
- `todayOrder.items`: cac mon chinh trong don hang moi nhat hom nay.
- `todayOrder.addons`: cac mon/addon di kem trong don hang moi nhat hom nay, hien duoc map tu order item co `unitPrice = 0`.
- `recentHistory`: tra 3 don hang gan nhat cua customer dang dang nhap.
- `statistics.week.limit` va `statistics.month.limit`: lay tu `customer.spendingLimit`, dung de tinh thanh progress.
- `customer.spendingLimit`: gioi han chi tieu do nguoi dung set cho tung customer.
- `createdAt` va `orderedAt`: tra ISO datetime kem timezone.
- Frontend se format tien, ngay, gio va text hien thi.

### Enums

```ts
type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'RECEIVED' | 'CANCELLED';

type NotificationType =
  | 'ORDER_CREATED'
  | 'ORDER_RECEIVED'
  | 'PAYMENT_DEDUCTED'
  | 'TOPUP_SUCCESS'
  | 'SYSTEM';

type TransactionType = 'ORDER_PAYMENT' | 'TOPUP' | 'REFUND';
```

### Error Response

```json
{
  "message": "Unauthorized",
  "error": "UNAUTHORIZED",
  "statusCode": 401
}
```
