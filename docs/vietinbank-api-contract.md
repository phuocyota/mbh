# SMART CANTEEN – VIETINBANK API CONTRACT

**Version:** 1.0  
**Architecture:** Smart Canteen + VietinBank Collection / VietQR  
**Format:** REST / JSON  
**Encoding:** UTF-8  
**Currency mặc định:** VND

---

# 1. Tổng quan hệ thống

Hệ thống gồm các thành phần:

```text
Parent App
Student App
Canteen POS
Admin Portal
      │
      ▼
Smart Canteen Backend
      │
      ├── Wallet Service
      ├── Payment Service
      ├── Virtual Account Service
      ├── VietinBank Integration Service
      └── Reconciliation Service
               │
               ▼
           VietinBank
```

Các nhóm API:

```text
A. Smart Canteen → VietinBank
B. VietinBank → Smart Canteen
C. Smart Canteen Internal API
D. Reconciliation API
```

---

# 2. Quy ước chung

## 2.1 Base URL

Production:

```text
https://api.smartcanteen.vn
```

Integration:

```text
/api/v1
```

Ví dụ:

```text
https://api.smartcanteen.vn/api/v1/vietinbank/notify-bill
```

---

# 3. Response chuẩn của Smart Canteen

Các API nội bộ sử dụng:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Success",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "code": "INVALID_REQUEST",
  "message": "Invalid request",
  "data": null
}
```

> Lưu ý: Các API callback từ VietinBank phải response theo đúng schema VietinBank quy định, không dùng response wrapper này.

---

# 4. Generate VietQR

## Endpoint

```http
POST /api/v1/vietinbank/generate-qr
```

## Direction

```text
Smart Canteen
      ↓
VietinBank
```

## Mục đích

Tạo VietQR cho phụ huynh nạp tiền.

## Request

```json
{
  "parentId": "PARENT_001",
  "studentId": "STUDENT_001",
  "canteenId": "CANTEEN_001",
  "amount": 500000,
  "purpose": "NAP TIEN SMART CANTEEN"
}
```

### Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| parentId | string | Yes | ID phụ huynh |
| studentId | string | No | ID học sinh |
| canteenId | string | Yes | Canteen nhận tiền |
| amount | number | No | Số tiền |
| purpose | string | No | Nội dung giao dịch |

Nếu truyền `amount`, số tiền trên QR được cố định.

## Backend → VietinBank

```json
{
  "requestId": "REQ-20260922-000001",
  "merchantId": "XXXX",
  "providerId": "XXXX",
  "channel": "MOBILE",
  "version": "1.0.1",
  "clientIP": "10.0.0.1",
  "language": "vi",
  "clientDt": "2026-09-22T10:00:00.000Z",
  "signature": "BASE64_SIGNATURE",
  "data": {
    "accountNumber": "123456789",
    "amount": "500000",
    "purposeOfTrans": "NAP TIEN SMART CANTEEN"
  }
}
```

### Signature source

```text
requestId
+ providerId
+ merchantId
+ clientDt
+ data.accountNumber
```

Sau đó:

```text
Private Key Smart Canteen
        ↓
RSA Sign
        ↓
Base64
        ↓
signature
```

## Response

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "QR generated",
  "data": {
    "requestId": "REQ-20260922-000001",
    "qrContent": "000201010212...",
    "qrBase64": "MDAwMjAx...",
    "amount": 500000,
    "expiredAt": null
  }
}
```

---

# 5. VietinBank Inquiry API

## Endpoint

```http
POST /api/v1/vietinbank/inq-bill
```

## Direction

```text
VietinBank
      ↓
Smart Canteen
```

## VietinBank Message

```text
1100 = Request
1110 = Response
```

## Mục đích

VietinBank kiểm tra tài khoản định danh trước khi người dùng thực hiện chuyển tiền.

## 5.1 Request

```json
{
  "header": {
    "msgId": "a87d599f-3911-4b03-bd60-22a5cae2a45c",
    "msgType": "1100",
    "channelId": "211601",
    "gatewayId": "A101_IBR",
    "providerId": "9480",
    "merchantId": "8CAP",
    "productId": "900000",
    "timestamp": "09222026153000",
    "username": "SOA",
    "signature": "BASE64_SIGNATURE",
    "additionalProperties": {}
  },
  "data": {
    "transId": "a87d599f-3911-4b03-bd60-22a5cae2a45c",
    "transTime": "09222026153000",
    "custCode": "SC000000001",
    "additionalProperties": {}
  },
  "additionalProperties": {}
}
```

## 5.2 custCode

`custCode` được Smart Canteen sử dụng làm mã định danh tài khoản.

Ví dụ:

```text
SC000000001
```

Mapping:

```text
custCode
   ↓
Virtual Account
   ↓
Parent
   ↓
Student
   ↓
Canteen
```

## 5.3 Verify request

Smart Canteen verify:

```text
data.transId
+ data.transTime
+ data.custCode
```

bằng:

```text
VietinBank Public Key
```

Nếu signature không hợp lệ:

```text
errorCode = 01
```

## 5.4 Response

```json
{
  "header": {
    "msgId": "a87d599f-3911-4b03-bd60-22a5cae2a45c",
    "msgType": "1110",
    "channelId": "211601",
    "providerId": "9480",
    "merchantId": "8CAP",
    "productId": "900000",
    "timestamp": "09222026153000",
    "signature": "BASE64_SIGNATURE"
  },
  "data": {
    "errors": {
      "errorCode": "00",
      "errorDesc": "Xu ly thanh cong"
    },
    "details": {
      "transId": "a87d599f-3911-4b03-bd60-22a5cae2a45c",
      "transTime": "09222026153000",
      "custCode": "SC000000001",
      "custName": "NGUYEN VAN A_500000VND",
      "billId": null,
      "amount": "500000",
      "amountMin": null,
      "preseve1": null,
      "preseve2": null,
      "preseve3": null
    }
  }
}
```

### Response signature

```text
data.details.transId
+ data.details.transTime
+ data.details.custCode
+ data.details.custName
+ data.details.billId
+ data.details.amount
+ data.errors.errorCode
```

Các field không có giá trị bỏ qua khi ghép chuỗi ký.

---

# 6. VietinBank Notify API

## Endpoint

```http
POST /api/v1/vietinbank/notify-bill
```

## Direction

```text
VietinBank
      ↓
Smart Canteen
```

## Message

```text
1200 = Request
1210 = Response
```

## Mục đích

Thông báo giao dịch tiền vào đã được VietinBank xử lý.

## 6.1 Request

```json
{
  "msgId": "MSG001",
  "providerId": "9480",
  "transId": "VTB202609220001",
  "transTime": "20260922153000",
  "transType": "3",
  "custCode": "SC000000001",
  "sendBankId": "970403",
  "sendBranchId": "",
  "sendAcctId": "123456789",
  "sendAcctName": "NGUYEN VAN B",
  "recvAcctId": "999999999",
  "recvAcctName": "SMART CANTEEN",
  "recvVirtualAcctId": "SC000000001",
  "recvVirtualAcctName": "",
  "amount": "500000",
  "bankTransId": "BANK20260922001",
  "remark": "NAP TIEN SMART CANTEEN",
  "currencyCode": "VND",
  "signature": "BASE64_SIGNATURE"
}
```

## 6.2 Signature Verification

Chuỗi verify:

```text
transId
+ transTime
+ custCode
+ amount
+ bankTransId
+ remark
```

Các field rỗng bỏ qua.

Verify bằng:

```text
VietinBank Public Key
```

## 6.3 Processing

```text
Receive Notify
       ↓
Verify Signature
       ↓
Validate Request
       ↓
Check transId
       │
   ┌───┴────────┐
   │            │
 Exists      New transId
   │            │
Return 00       ▼
          Find Virtual Account
                ↓
          Find Parent Wallet
                ↓
          Create Bank Transaction
                ↓
          Create Wallet Ledger
                ↓
          Increase Wallet Balance
                ↓
             Commit
                ↓
           Return 00
```

## 6.4 Idempotency

Database bắt buộc:

```sql
UNIQUE(trans_id)
```

Ví dụ:

```text
VTB notify:
transId = ABC001
amount = 500000
```

Lần đầu:

```text
Wallet +500000
```

Retry:

```text
transId ABC001 đã tồn tại

→ KHÔNG +500000 lần nữa
→ response success
```

## 6.5 Response

```json
{
  "transId": "VTB202609220001",
  "providerId": "9480",
  "errorCode": "00",
  "errorDesc": "Thanh cong",
  "signature": "BASE64_SIGNATURE"
}
```

Response signature:

```text
transId
+ errorCode
+ errorDesc
```

---

# 7. VietinBank Error Codes

| Code | Meaning |
|---|---|
| 00 | Success |
| 01 | Không xác nhận được chữ ký số |
| 02 | Mã KH / hóa đơn không tồn tại |
| 03 | Lỗi gạch nợ / tăng sức mua |
| 05 | Trùng giao dịch |
| 99 | Lỗi không xác định |

---

# 8. Virtual Account API

## 8.1 Create Virtual Account

```http
POST /api/v1/virtual-accounts
```

Request:

```json
{
  "parentId": "P001",
  "studentId": "S001",
  "canteenId": "C001",
  "bankAccountId": "BA001"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "VA001",
    "virtualAccount": "SC000000001",
    "parentId": "P001",
    "studentId": "S001",
    "canteenId": "C001",
    "status": "ACTIVE"
  }
}
```

## 8.2 Get Virtual Account

```http
GET /api/v1/virtual-accounts/:virtualAccount
```

## 8.3 Change Virtual Account Status

```http
PATCH /api/v1/virtual-accounts/:id/status
```

Request:

```json
{
  "status": "INACTIVE"
}
```

Allowed:

```text
ACTIVE
INACTIVE
BLOCKED
```

---

# 9. Wallet API

## 9.1 Get Balance

```http
GET /api/v1/wallets/:parentId/balance
```

Response:

```json
{
  "success": true,
  "data": {
    "walletId": "W001",
    "parentId": "P001",
    "balance": 500000,
    "availableBalance": 500000,
    "currency": "VND"
  }
}
```

## 9.2 Wallet Transactions

```http
GET /api/v1/wallets/:parentId/transactions
```

Query:

```text
?page=1
&limit=20
&type=BANK_TOPUP
```

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "TX001",
        "type": "BANK_TOPUP",
        "amount": 500000,
        "balanceBefore": 0,
        "balanceAfter": 500000,
        "referenceId": "VTB202609220001",
        "createdAt": "2026-09-22T08:30:00Z"
      }
    ]
  }
}
```

---

# 10. Canteen Purchase API

## Endpoint

```http
POST /api/v1/wallets/debit
```

## Request

```json
{
  "studentId": "S001",
  "canteenId": "C001",
  "orderId": "ORDER001",
  "amount": 25000
}
```

## Processing

Phải sử dụng DB Transaction:

```text
BEGIN

lock wallet

check balance

if balance < amount
    rollback

create payment

create ledger

wallet.balance -= amount

COMMIT
```

## Success

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "transactionId": "TX002",
    "orderId": "ORDER001",
    "amount": 25000,
    "balanceBefore": 500000,
    "balanceAfter": 475000
  }
}
```

## Insufficient balance

```json
{
  "success": false,
  "code": "INSUFFICIENT_BALANCE",
  "message": "So du khong du"
}
```

---

# 11. Refund API

```http
POST /api/v1/wallets/refund
```

Request:

```json
{
  "orderId": "ORDER001",
  "amount": 25000,
  "reason": "ORDER_CANCELLED"
}
```

Processing:

```text
check original payment
        ↓
check refunded amount
        ↓
create refund transaction
        ↓
wallet balance +
```

Response:

```json
{
  "success": true,
  "data": {
    "refundId": "RF001",
    "amount": 25000,
    "balanceAfter": 500000
  }
}
```

---

# 12. Bank Transaction API

## List

```http
GET /api/v1/bank-transactions
```

Query:

```text
?from=2026-09-01
&to=2026-09-30
&status=SUCCESS
&page=1
&limit=50
```

## Detail

```http
GET /api/v1/bank-transactions/:transId
```

Response:

```json
{
  "success": true,
  "data": {
    "transId": "VTB202609220001",
    "bankTransId": "BANK20260922001",
    "custCode": "SC000000001",
    "amount": 500000,
    "currency": "VND",
    "status": "SUCCESS",
    "receivedAt": "2026-09-22T08:30:00Z"
  }
}
```

---

# 13. Canteen Bank Account API

## Create

```http
POST /api/v1/canteens/:canteenId/bank-accounts
```

Request:

```json
{
  "bankCode": "VIETINBANK",
  "accountNumber": "123456789",
  "accountName": "NGUYEN VAN A"
}
```

## List

```http
GET /api/v1/canteens/:canteenId/bank-accounts
```

## Update

```http
PATCH /api/v1/canteen-bank-accounts/:id
```

---

# 14. Reconciliation API

## Import

```http
POST /api/v1/reconciliation/import
```

Input:

```text
VietinBank reconciliation file
```

## Run Reconciliation

```http
POST /api/v1/reconciliation/:date/run
```

Ví dụ:

```text
POST /api/v1/reconciliation/2026-09-22/run
```

Matching Key:

```text
transId
+ amount
+ transTime
```

## 14.1 Reconciliation Result

```text
00 = MATCHED
01 = BANK_ONLY
02 = SYSTEM_ONLY
03 = MISMATCH
```

## Get result

```http
GET /api/v1/reconciliation/:date
```

Response:

```json
{
  "success": true,
  "data": {
    "date": "2026-09-22",
    "total": 1000,
    "matched": 995,
    "bankOnly": 2,
    "systemOnly": 1,
    "mismatch": 2
  }
}
```

---

# 15. Database tối thiểu

## virtual_accounts

```text
id
virtual_account
parent_id
student_id
canteen_id
bank_account_id
status
created_at
updated_at
```

Unique:

```text
virtual_account
```

## wallets

```text
id
parent_id
balance
currency
created_at
updated_at
```

## wallet_transactions

```text
id
wallet_id
type

BANK_TOPUP
CANTEEN_PURCHASE
REFUND
ADJUSTMENT

amount
balance_before
balance_after

reference_id
metadata

created_at
```

## bank_transactions

```text
id

trans_id
bank_trans_id

cust_code

virtual_account

recv_account_id
send_account_id

amount
currency

remark

trans_time

status

raw_request

created_at
```

Unique:

```text
trans_id
```

## canteen_bank_accounts

```text
id
canteen_id

bank_code
account_number
account_name

status
```

## reconciliation_transactions

```text
id
reconciliation_date

trans_id
amount
trans_time

bank_status
system_status

reconcile_status
```

---

# 16. Security

Private key:

```text
Smart Canteen Private Key
```

Không được:

```text
commit git
expose FE
return client
```

Public key VietinBank:

```text
Smart Canteen Backend
        ↓
Verify VietinBank Request
```

Public key Smart Canteen:

```text
VietinBank
        ↓
Verify Smart Canteen Response
```

---

# 17. Quan hệ API

```text
              PARENT NAP TIEN

Parent
   │
   ▼
POST generate-qr
   │
   ▼
VietinBank
   │
   ├──────────────► inq-bill
   │                    │
   │              Find Virtual Account
   │                    │
   │                    ▼
   │               Parent/Student
   │
   ▼
Thanh toán
   │
   ▼
VietinBank
   │
   └──────────────► notify-bill
                         │
                         ▼
                 bank_transactions
                         │
                         ▼
                      wallet
                         │
                         ▼
                wallet_transactions
```

---

# 18. Thanh toán tại Canteen

```text
Student
   │
   ▼
Canteen POS
   │
   ▼
POST /wallets/debit
   │
   ▼
Find Student
   │
   ▼
Parent Wallet
   │
   ├── đủ tiền
   │       ↓
   │   Deduct
   │       ↓
   │   Create Ledger
   │       ↓
   │   Payment Success
   │
   └── không đủ tiền
           ↓
      INSUFFICIENT_BALANCE
```

---

# 19. API Summary

| Method | Endpoint | Owner |
|---|---|---|
| POST | `/vietinbank/generate-qr` | Smart Canteen |
| POST | `/vietinbank/inq-bill` | VietinBank → Smart Canteen |
| POST | `/vietinbank/notify-bill` | VietinBank → Smart Canteen |
| POST | `/virtual-accounts` | Smart Canteen |
| GET | `/virtual-accounts/:id` | Smart Canteen |
| PATCH | `/virtual-accounts/:id/status` | Smart Canteen |
| GET | `/wallets/:parentId/balance` | Smart Canteen |
| GET | `/wallets/:parentId/transactions` | Smart Canteen |
| POST | `/wallets/debit` | Smart Canteen |
| POST | `/wallets/refund` | Smart Canteen |
| GET | `/bank-transactions` | Smart Canteen |
| GET | `/bank-transactions/:transId` | Smart Canteen |
| POST | `/canteens/:canteenId/bank-accounts` | Smart Canteen |
| GET | `/canteens/:canteenId/bank-accounts` | Smart Canteen |
| POST | `/reconciliation/import` | Smart Canteen |
| POST | `/reconciliation/:date/run` | Smart Canteen |
| GET | `/reconciliation/:date` | Smart Canteen |

---

# 20. Ba API tích hợp VietinBank quan trọng nhất

## 20.1 Generate QR

```text
POST /vietinbank/generate-qr

Smart Canteen
      ↓
VietinBank
      ↓
Generate QR
```

## 20.2 Inquiry Bill

```text
POST /vietinbank/inq-bill

VietinBank
      ↓
Smart Canteen
      ↓
Lookup Virtual Account
```

## 20.3 Notify Bill

```text
POST /vietinbank/notify-bill

VietinBank
      ↓
Smart Canteen
      ↓
Bank Transaction
      ↓
Wallet +
```

Ba API này tạo thành lõi của integration VietinBank cho luồng nạp tiền Smart Canteen.

---

# 21. Ghi chú triển khai

Các phần sau bám theo tài liệu VietinBank:

- `qr/vietqr/gen`
- `inq-bill`
- `notify-bill`
- message type `1100`, `1110`, `1200`, `1210`
- `custCode`
- chữ ký số
- retry notify
- đối soát theo `transId + amount + transTime`

Các phần sau là kiến trúc nội bộ Smart Canteen đề xuất thêm:

- wallet
- debit
- refund
- virtual account management
- canteen bank account management
- bank transaction history
- reconciliation service nội bộ

