# BANK INTEGRATION CONFIG API CONTRACT

**Version:** 1.0  
**Module:** Smart Canteen – Bank Integration Configuration  
**Scope:** Quản lý cấu hình VietinBank theo từng canteen  
**Format:** REST / JSON  
**Base path:** `/api/v1`

---

## 1. Mục tiêu

Nhiều canteen dùng chung một Integration Backend. Mỗi canteen có cấu hình VietinBank riêng và BE phải tự resolve cấu hình theo `canteenId`.

FE chỉ gửi dữ liệu nghiệp vụ. FE **không được gửi**:

- `x-ibm-client-id`
- `x-ibm-client-secret`
- `privateKey`
- `providerId`
- `merchantId`

---

## 2. Table `bank_integration_configs`

```sql
CREATE TABLE bank_integration_configs (
    id UUID PRIMARY KEY,
    canteen_id UUID NOT NULL,
    bank_code VARCHAR(50) NOT NULL,
    environment VARCHAR(10) NOT NULL,

    provider_id VARCHAR(50),
    merchant_id VARCHAR(50),
    product_id VARCHAR(50),
    gateway_id VARCHAR(100),
    username VARCHAR(100),

    client_id VARCHAR(255),
    client_secret_ref VARCHAR(500),

    partner_private_key_ref VARCHAR(500),
    partner_public_key TEXT,
    bank_public_key TEXT,

    api_base_url VARCHAR(500),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_bank_config
        UNIQUE (canteen_id, bank_code, environment)
);
```

### Field Definition

| Field | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | ID cấu hình |
| canteenId | UUID | Yes | Canteen sở hữu config |
| bankCode | string | Yes | `VIETINBANK` |
| environment | string | Yes | `UAT`, `PROD` |
| providerId | string | Yes | Mã provider |
| merchantId | string | Yes | Mã merchant |
| productId | string | No | Mã sản phẩm |
| gatewayId | string | No | Gateway ID |
| username | string | No | Username |
| clientId | string | Yes | API client ID |
| clientSecretRef | string | Yes | Reference tới secret |
| partnerPrivateKeyRef | string | Yes | Reference private key |
| partnerPublicKey | string | No | Public key Smart Canteen |
| bankPublicKey | string | Yes | Public key VietinBank |
| apiBaseUrl | string | Yes | API URL |
| status | string | Yes | `ACTIVE`, `INACTIVE` |

---

## 3. Secret Storage

Không lưu plaintext:

```text
client_secret
private_key
```

Database chỉ lưu:

```text
client_secret_ref
partner_private_key_ref
```

Ví dụ:

```text
vietinbank/canteen/C001/prod/client-secret
vietinbank/canteen/C001/prod/private-key
```

Runtime:

```text
DB Config
   ↓
Secret Reference
   ↓
Secret Manager / Encrypted Storage
   ↓
Actual Secret
```

---

## 4. Table `bank_accounts`

Một canteen có thể có nhiều tài khoản ngân hàng.

```sql
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY,

    integration_config_id UUID NOT NULL,
    canteen_id UUID NOT NULL,

    account_number VARCHAR(100) NOT NULL,
    account_name VARCHAR(255),
    account_type VARCHAR(50),

    priority INT DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_bank_account_config
        FOREIGN KEY (integration_config_id)
        REFERENCES bank_integration_configs(id)
);
```

Quan hệ:

```text
canteens
   │ 1
   ▼ N
bank_integration_configs
   │ 1
   ▼ N
bank_accounts
```

---

## 5. Create Bank Integration Config

```http
POST /api/v1/bank-integrations
```

Request:

```json
{
  "canteenId": "C001",
  "bankCode": "VIETINBANK",
  "environment": "UAT",
  "providerId": "9480",
  "merchantId": "8CAP",
  "productId": "900000",
  "gatewayId": "A101_IBR",
  "username": "SOA",
  "clientId": "VTB_CLIENT_001",
  "clientSecretRef": "vietinbank/canteen/C001/uat/client-secret",
  "partnerPrivateKeyRef": "vietinbank/canteen/C001/uat/private-key",
  "partnerPublicKey": "-----BEGIN CERTIFICATE-----...",
  "bankPublicKey": "-----BEGIN CERTIFICATE-----...",
  "apiBaseUrl": "https://api-uat.vietinbank.vn",
  "status": "ACTIVE"
}
```

Validation:

```text
canteen tồn tại
bankCode hợp lệ
environment hợp lệ
canteen + bankCode + environment không được duplicate
```

Response:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Bank integration config created",
  "data": {
    "id": "CFG001",
    "canteenId": "C001",
    "bankCode": "VIETINBANK",
    "environment": "UAT",
    "status": "ACTIVE"
  }
}
```

---

## 6. Get Bank Integration Config

```http
GET /api/v1/bank-integrations/:id
```

Không trả actual `clientSecret` hoặc actual `privateKey`.

---

## 7. Get Config By Canteen

```http
GET /api/v1/canteens/:canteenId/bank-integrations
```

Query:

```text
?bankCode=VIETINBANK&environment=PROD
```

---

## 8. Update Integration Config

```http
PATCH /api/v1/bank-integrations/:id
```

Request:

```json
{
  "providerId": "9481",
  "merchantId": "8CAP_NEW",
  "productId": "900001",
  "gatewayId": "A102_IBR",
  "apiBaseUrl": "https://api.vietinbank.vn",
  "status": "ACTIVE"
}
```

---

## 9. Update Secret Reference

```http
PATCH /api/v1/bank-integrations/:id/secrets
```

Request:

```json
{
  "clientSecretRef": "vietinbank/canteen/C001/prod/client-secret-v2",
  "partnerPrivateKeyRef": "vietinbank/canteen/C001/prod/private-key-v2"
}
```

Không cho phép gửi plaintext secret qua API.

---

## 10. Change Status

```http
PATCH /api/v1/bank-integrations/:id/status
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
```

---

## 11. Disable Integration Config

```http
DELETE /api/v1/bank-integrations/:id
```

Khuyến nghị soft delete:

```text
status = INACTIVE
```

---

## 12. Add Bank Account

```http
POST /api/v1/bank-integrations/:integrationId/accounts
```

Request:

```json
{
  "accountNumber": "123456789",
  "accountName": "SMART CANTEEN A",
  "accountType": "COLLECTION",
  "priority": 1,
  "isDefault": true
}
```

---

## 13. List Bank Accounts

```http
GET /api/v1/bank-integrations/:integrationId/accounts
```

---

## 14. Update Bank Account

```http
PATCH /api/v1/bank-accounts/:id
```

Request:

```json
{
  "accountName": "SMART CANTEEN A",
  "priority": 1,
  "isDefault": true,
  "status": "ACTIVE"
}
```

---

## 15. Runtime Config Resolution

Khi FE gọi nghiệp vụ:

```json
{
  "canteenId": "C001",
  "amount": 500000
}
```

BE xử lý:

```text
canteenId
   ↓
resolve BankIntegrationConfig
   ↓
bankCode = VIETINBANK
environment = current environment
status = ACTIVE
   ↓
resolve secret
   ↓
resolve bank account
   ↓
build VietinBank request
```

Pseudo code:

```ts
const config =
  await bankIntegrationConfigService.resolve({
    canteenId,
    bankCode: 'VIETINBANK',
    environment: currentEnv,
  });

const clientSecret =
  await secretService.get(config.clientSecretRef);

const privateKey =
  await secretService.get(config.partnerPrivateKeyRef);
```

---

## 16. Generate QR Runtime

FE gọi:

```http
POST /api/v1/vietinbank/generate-qr
```

```json
{
  "canteenId": "C001",
  "parentId": "P001",
  "studentId": "S001",
  "amount": 500000
}
```

BE:

```text
Validate access to canteen
   ↓
Resolve bank config
   ↓
Resolve default bank account
   ↓
Resolve client secret
   ↓
Resolve private key
   ↓
Generate signature
   ↓
Build VietinBank headers
   ↓
Call VietinBank
```

Generated header:

```http
x-ibm-client-id: <config.clientId>
x-ibm-client-secret: <resolved secret>
Content-Type: application/json
```

Generated body lấy config tương ứng:

```json
{
  "providerId": "<config.providerId>",
  "merchantId": "<config.merchantId>",
  "data": {
    "accountNumber": "<resolved accountNumber>"
  }
}
```

---

## 17. Canteen Authorization

Không tin trực tiếp `canteenId` từ FE.

BE phải kiểm tra:

```text
authenticated user
      ↓
user has access C001?
      │
   ┌──┴──┐
   │     │
  yes    no
   │     │
continue 403
```

Nếu token đã chứa tenant/canteen thì ưu tiên resolve từ token.

---

## 18. Config Cache

Có thể cache:

```text
bank-config:{canteenId}:{bankCode}:{environment}
```

Ví dụ:

```text
bank-config:C001:VIETINBANK:PROD
```

TTL đề xuất:

```text
5 - 15 phút
```

Khi update config:

```text
UPDATE DB
   ↓
invalidate cache
```

---

## 19. Concurrency

Nhiều canteen có thể gọi cùng lúc:

```text
Canteen A ─┐
Canteen B ─┼──► Integration BE
Canteen C ─┘
```

Mỗi request resolve config độc lập.

Không dùng mutable global variable:

```ts
currentMerchantId
currentClientSecret
```

Config phải nằm trong scope của request/local variable.

---

## 20. Environment Handling

UAT:

```text
canteen_id = C001
bank_code = VIETINBANK
environment = UAT
```

PROD:

```text
canteen_id = C001
bank_code = VIETINBANK
environment = PROD
```

UAT và PROD là hai config độc lập.

---

## 21. Error Codes

### BANK_CONFIG_NOT_FOUND

```json
{
  "success": false,
  "code": "BANK_CONFIG_NOT_FOUND",
  "message": "Bank integration configuration not found"
}
```

### BANK_CONFIG_INACTIVE

```json
{
  "success": false,
  "code": "BANK_CONFIG_INACTIVE",
  "message": "Bank integration is inactive"
}
```

### BANK_SECRET_NOT_FOUND

```json
{
  "success": false,
  "code": "BANK_SECRET_NOT_FOUND",
  "message": "Bank integration secret not found"
}
```

### BANK_ACCOUNT_NOT_FOUND

```json
{
  "success": false,
  "code": "BANK_ACCOUNT_NOT_FOUND",
  "message": "No active bank account found"
}
```

### CANTEEN_FORBIDDEN

```json
{
  "success": false,
  "code": "CANTEEN_FORBIDDEN",
  "message": "User does not have access to this canteen"
}
```

---

## 22. API Summary

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/bank-integrations` | Tạo bank config |
| GET | `/bank-integrations/:id` | Chi tiết config |
| GET | `/canteens/:canteenId/bank-integrations` | Config theo canteen |
| PATCH | `/bank-integrations/:id` | Update config |
| PATCH | `/bank-integrations/:id/secrets` | Update secret refs |
| PATCH | `/bank-integrations/:id/status` | Active / inactive |
| DELETE | `/bank-integrations/:id` | Disable config |
| POST | `/bank-integrations/:id/accounts` | Add bank account |
| GET | `/bank-integrations/:id/accounts` | List accounts |
| PATCH | `/bank-accounts/:id` | Update account |

---

## 23. Integration với VietinBank Contract

Các API:

```text
POST /vietinbank/generate-qr
POST /vietinbank/inq-bill
POST /vietinbank/notify-bill
```

không hard-code:

```text
providerId
merchantId
productId
gatewayId
clientId
clientSecret
keys
accountNumber
```

Mà lấy từ:

```text
BankIntegrationConfigService
```

Flow:

```text
FE
 │
 ▼
Controller
 │
 ▼
Auth / Canteen Permission
 │
 ▼
BankIntegrationConfigService
 │
 ├── Config DB
 ├── Secrets
 └── Bank Account
 │
 ▼
VietinBankIntegrationService
 │
 ├── Headers
 ├── Signature
 ├── Request Body
 └── Bank API
 │
 ▼
VietinBank
```

---

## 24. Nguyên tắc bắt buộc cho BE

1. Không nhận `clientSecret` từ FE.
2. Không nhận `privateKey` từ FE.
3. Không hard-code merchant config.
4. Config phải resolve theo `canteenId`.
5. Mỗi request dùng config riêng.
6. Không sử dụng mutable global config.
7. Secret không lưu plaintext.
8. Phân biệt UAT và PROD.
9. Validate quyền truy cập canteen.
10. Config update phải invalidate cache.
