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
    },
    {
      "id": "txn_002",
      "type": "ORDER_PAYMENT",
      "title": "Bun bo",
      "amount": -25000,
      "status": "COMPLETED",
      "statusText": "Hoan thanh",
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
- `recentHistory`: chi can tra 3-5 giao dich gan nhat cho man Home.
- `statistics.week.limit` va `statistics.month.limit`: lay tu `customer.spendingLimit`, dung de tinh thanh progress.
- `customer.spendingLimit`: gioi han chi tieu do nguoi dung set cho tung customer.
- `createdAt` va `orderedAt`: tra ISO datetime kem timezone.
- Frontend se format tien, ngay, gio va text hien thi.

### Enums

```ts
type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'RECEIVED' | 'CANCELLED';

type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

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
