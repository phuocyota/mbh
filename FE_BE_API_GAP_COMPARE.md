# Đối chiếu API giữa FE_Kido_MBH và MBH Backend

> Thời điểm rà soát: 29/07/2026  
> FE: `../FE_Kido_MBH`  
> BE: repo hiện tại `mbh`  
> Phạm vi: các màn hình quản trị đang được khai báo trong `FE_Kido_MBH/src/App.jsx`.

## 1. Kết luận nhanh

Đối chiếu tĩnh toàn bộ lời gọi `axiosInstance` của FE với các decorator
`@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` của BE cho kết quả:

| Hạng mục | Số lượng |
|---|---:|
| Cặp `HTTP method + path` duy nhất FE đã khai báo | 105 |
| Có route tương ứng chính xác ở BE | 104 |
| Không có route tương ứng chính xác ở BE | 1 |

Route còn thiếu:

1. `PUT /stock-takes/:id/items`: đã khai báo trong API layer FE, nhưng BE chưa
   có route; hiện tại chưa có component nào gọi method này.

`POST /wallet/customer-debt/clearance` đã được sửa ở FE thành
`POST /wallets/customer-debt/clearance`.

Ngoài route trên, một số luồng vẫn chưa thể chạy end-to-end dù BE đã có
route, do request body, response shape hoặc vòng đời nghiệp vụ không khớp.
Đây là phần cần ưu tiên hơn việc chỉ bổ sung route.

## 2. API FE gọi nhưng BE không có route tương ứng

| Ưu tiên | FE cần | Nơi dùng ở FE | Hiện trạng BE | Đề xuất |
|---|---|---|---|---|
| P2 | `PUT /stock-takes/:id/items` | Chỉ khai báo tại `src/api/stockTakeApi.js`; chưa được UI gọi | `StockTakeController` chỉ có list, detail, tạo draft và complete | Nếu cần cho phép sửa phiếu `DRAFT`, bổ sung route và service update items. Nếu không có nghiệp vụ sửa draft, xóa method thừa khỏi FE |

### Contract đề xuất cho cập nhật phiếu kiểm kho

```http
PUT /stock-takes/:id/items
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "items": [
    {
      "productId": "uuid",
      "actualQuantity": 12
    }
  ]
}
```

Quy tắc đề xuất:

- Chỉ cho sửa phiếu có `status = DRAFT`.
- Tính lại `systemQuantity`, `differenceQuantity`, `differenceAmount`,
  `increaseQuantity`, `decreaseQuantity` và `totalDifferenceAmount` trong cùng
  transaction.
- Trả về đầy đủ phiếu cùng `items.product`, giống `GET /stock-takes/:id`.

## 3. Route đã có nhưng contract hiện tại chưa chạy đúng

### 3.1. Gạch nợ khách hàng — Đã xử lý ngày 29/07/2026

FE trước đây gửi:

```json
{
  "paymentMethod": "CASH",
  "fundId": "uuid",
  "voucherNumber": "PT000003",
  "voucherDate": "2026-07-29T...",
  "reference": "...",
  "note": "...",
  "items": [
    {
      "amount": 50000,
      "description": "Thu hồi công nợ"
    }
  ],
  "attachments": [],
  "customerId": "uuid"
}
```

Contract hiện tại của màn hình:

```json
{
  "customerId": "uuid",
  "amount": 50000,
  "note": "Thu hồi công nợ",
  "paymentMethod": "CASH"
}
```

Đã triển khai:

- FE gọi đúng `POST /wallets/customer-debt/clearance`.
- FE tính `amount = sum(items[].amount)`, chặn số tiền vượt công nợ và gửi DTO
  tối thiểu.
- Lõi cập nhật số dư của `topup()` vẫn độc lập. Phần phát sinh chứng từ quỹ của
  top-up/MoMo đã chuyển sang lý do kế toán; `clearCustomerDebt()` vẫn bao bọc
  `repayDebtByCash()` cho nhánh tiền mặt và dùng chung lõi `repayCustomerDebt()`
  cho nhánh tiền gửi.
- FE không tự chọn và không gửi `fundId` trong luồng thu công nợ.
- Migration `1763200000000-SeedCustomerDebtClearancePaymentReasons.ts` tạo/cập
  nhật hai lý do: `TNBHTS` có công thức `{111:-,131:+}` cho tiền mặt và
  `TNBHTS_BANK` có công thức `{112:-,131:+}` cho tiền gửi.
- BE chọn lý do theo `paymentMethod`; `FinanceService` chỉ xét vế ghi Nợ (`-`)
  của `accounting_formula` đối với phiếu thu rồi resolve đúng một quỹ active
  thuộc chi nhánh. Vì vậy bảng lý do quyết định tài khoản quỹ; service không
  hard-code `111/112`.
- Wallet, hạn mức nợ và chứng từ tài chính được ghi trong cùng transaction.

Phần chưa làm trong luồng này: lưu file đính kèm, tham chiếu và các dòng chi
tiết riêng biệt. Nếu các dữ liệu này bắt buộc phải xem lại sau khi lưu, BE cần
bổ sung entity/DTO tương ứng.

### 3.2. Tạo phiếu thu khác/thu hoàn ứng — Đã nối lõi resolve quỹ

FE gọi `POST /finance/receipts` với tổng tiền và `paymentMethod`. FE không gửi
`reasonCode`, không tải danh sách quỹ và không tự dò tài khoản `111/112`. BE
map `CASH → THU_KHAC_CASH`, các phương thức ngân hàng/QR/MoMo/thẻ →
`THU_KHAC_BANK`.

Contract tối thiểu:

```json
{
  "amount": 50000,
  "paymentMethod": "CASH",
  "purpose": "OTHER_RECEIPT",
  "refType": "EMPLOYEE",
  "refId": "uuid",
  "note": "..."
}
```

Các field FE đang gửi như `sourceId`, `sourceType`, `items`, `attachments`,
`voucherNumber`, `voucherDate`, `reference` hiện không được
`FinanceService.createMoneyVoucher()` sử dụng. `fundId` chỉ còn là legacy hint:
nếu client cũ vẫn gửi thì BE bắt buộc kiểm tra quỹ đó khớp `accounting_formula`;
nếu không gửi, BE resolve theo `reasonCode + branchId`.

### 3.3. Quy tắc chung cho mọi nghiệp vụ quỹ — Đã chuẩn hóa

- `FinanceService.createMoneyVoucher()` bắt buộc có `reasonCode`, chỉ nhận lý
  do `active` và `is_debt = false`.
- Các API nghiệp vụ được phép hard-code mapping từ field nghiệp vụ sang lý do,
  ví dụ `paymentMethod`, `paymentStatus`, có nợ/không nợ → `reasonCode`. FE
  không cần biết mã lý do trong các trường hợp BE đã có đủ dữ kiện để quyết định.
- Phiếu thu resolve quỹ từ các tài khoản dấu `-`; phiếu chi resolve từ các tài
  khoản dấu `+` trong `accounting_formula`.
- Ví và kho không còn resolver quỹ riêng; chỉ truyền lý do, chi nhánh và legacy
  hint nếu cần tương thích.
- MoMo không còn phụ thuộc `MOMO_FUND_ID`; thanh toán đơn dùng `BH_BANK`, còn
  thu hồi nợ khi top-up dùng `TNBHTS_BANK`.
- Migration `1763300000000-EnforceAccountingFormulaFundReasons.ts` thêm các lý
  do `THU_KHAC_CASH`, `THU_KHAC_BANK`, `CHI_KHAC_CASH`, `CHI_KHAC_BANK`,
  đồng thời lưu `reason_code` trên chứng từ thu/chi.
- Không còn nghiệp vụ tạo chuyển quỹ: `POST /finance/transfers` đã được comment
  khỏi controller. Các API đọc chỉ giữ lại để xem dữ liệu lịch sử.

Quyết định cần chốt:

- Phương án đơn giản: FE gộp các dòng thành `amount`, map đối tượng sang
  `refType/refId` và chỉ gửi contract hiện có.
- Phương án chứng từ chi tiết: BE bổ sung bảng detail/attachment và trả về
  contract phiếu thu đầy đủ. Chọn phương án này nếu màn chi tiết phải hiển thị
  lại từng dòng và file sau khi lưu.

### 3.4. Chuyển kho: FE đang trộn hai workflow khác nhau

Luồng FE hiện tại:

1. Tạo bằng `POST /stock-vouchers` với `type = TRANSFER`.
2. Nếu người dùng chọn hoàn thành, gọi tiếp
   `POST /stock-transfers/:id/complete`.

Các vấn đề:

- `POST /stock-vouchers` trả về **mảng chi tiết phiếu**, không trả một
  `StockReceiptTransfer`; vì vậy `transfer.id` ở FE có thể là ID của detail.
- Nhánh `TRANSFER` trong `StockVoucherService.createVoucher()` tạo phiếu với
  trạng thái `COMPLETED` và đã thay đổi tồn kho ngay.
- Entity `StockReceiptTransfer` bắt buộc cột `transferId`, nhưng nhánh
  `TRANSFER` của `StockVoucherService.createVoucher()` không gán field này; tùy
  schema database hiện tại, lệnh tạo có thể lỗi trước khi trả response.
- `POST /stock-transfers/:id/complete` chỉ chấp nhận phiếu `DRAFT`.
- `POST /stock-transfers` cũng đang được mô tả là tạo draft nhưng service hiện
  lưu `COMPLETED`, đồng thời phát sinh thêm phiếu import/export.

BE cần chốt một workflow duy nhất:

```text
POST /stock-transfers
        |
        v
      DRAFT
        |
        v
POST /stock-transfers/:id/complete
        |
        v
COMPLETED + cập nhật tồn kho đúng một lần
```

Đề xuất:

- FE tạo bằng `POST /stock-transfers`, không dùng generic
  `POST /stock-vouchers` cho màn chuyển kho.
- BE để `POST /stock-transfers` thực sự tạo `DRAFT`.
- Chỉ `complete` mới trừ kho nguồn, cộng kho đích và tạo chứng từ liên quan
  trong một transaction.
- Bảo đảm gọi `complete` lặp lại không làm thay đổi tồn kho lần hai.

### 3.5. Danh sách nhập/xuất kho đang phân trang theo detail, không theo phiếu

FE cần danh sách **phiếu** và chi tiết từng phiếu. Hiện FE gọi
`GET /stock-vouchers`, nhận danh sách `StockReceiptDetail`, sau đó tự group theo
`importReceipt`/`exportReceipt`.

BE mặc định trả 10 detail mỗi trang. Hệ quả:

- Một phiếu nhiều mặt hàng có thể bị chia qua hai trang.
- FE có thể hiển thị phiếu thiếu dòng hoặc thiếu tổng tiền.
- `stockInApi.getById()` và `stockOutApi.getById()` không gọi API detail; chúng
  tải lại danh sách rồi tìm trong dữ liệu đang có.
- FE hiện có fallback dữ liệu local khi API list trả `404`, làm lỗi tích hợp dễ
  bị che khuất.

BE nên bổ sung contract theo header:

```http
GET /stock-vouchers?type=IMPORT&page=1&size=20&search=...
GET /stock-vouchers?type=EXPORT&page=1&size=20&search=...
GET /stock-vouchers/:id
```

Response list đề xuất:

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "IMPORT",
      "code": "NK...",
      "status": "COMPLETED",
      "branch": {},
      "party": {},
      "totalAmount": 100000,
      "note": "...",
      "createdAt": "..."
    }
  ],
  "page": 1,
  "size": 20,
  "total": 1
}
```

`GET /stock-vouchers/:id` cần trả header cùng toàn bộ `items`, product và chứng
từ tiền liên quan. Không phân trang trên bảng detail cho endpoint danh sách
phiếu.

### 3.6. FE đang phân trang local trên dữ liệu BE mặc định chỉ trả 10 bản ghi

`normalizePagination()` của BE mặc định `size = 10`. Nhiều API FE gọi không
truyền `page/size`, sau đó coi response là toàn bộ dữ liệu và tự tìm kiếm/phân
trang ở client.

Các nhóm bị ảnh hưởng:

- `GET /branches`
- `GET /customers`
- `GET /suppliers`
- `GET /inventory-items`
- `GET /finance/funds`
- `GET /stock-vouchers`
- `GET /stock-transfers`
- `GET /stock-takes`

Đề xuất:

- Ưu tiên server-side pagination: FE luôn truyền `page`, `size`, `search`, các
  filter và dùng `total` từ BE.
- Riêng API option/select có thể tạo endpoint nhẹ như
  `GET /inventory-items/options?search=...&limit=50`.
- Không dùng `size=100000` như contract lâu dài.

## 4. Màn hình FE đang dùng dữ liệu giả và BE chưa có contract đầy đủ

Các mục dưới đây không xuất hiện trong thống kê 105 route vì FE chưa gọi API,
nhưng là nhu cầu thực tế nếu muốn bỏ mock.

### 4.1. Bảng chấm công điện tử

FE: `src/pages/Employee/TimeKeeping.jsx`

Hiện trạng:

- Dùng hằng `MOCK_CHECKINS`.
- Cần check-in, check-out và trạng thái `ontime`, `late`, `missing`,
  `unmarked`, `absent`.
- `work_schedules` của BE chỉ lưu lịch dự kiến (`workDate`, `shift`,
  `startTime`, `endTime`), không có dữ liệu chấm vào/chấm ra.

API đọc tối thiểu đề xuất:

```http
GET /attendances?from=2026-07-01&to=2026-07-31&employeeId=&branchId=
```

Response cần đủ:

```json
[
  {
    "employeeId": "uuid",
    "name": "Nguyễn Văn A",
    "role": "Nhân viên",
    "shifts": {
      "2026-07-29": {
        "morning": {
          "status": "ontime",
          "checkin": "07:55",
          "checkout": "12:00"
        }
      }
    }
  }
]
```

Nếu có thao tác quản trị, bổ sung API chỉnh công riêng và lưu audit:

```http
POST  /attendances/check-in
POST  /attendances/check-out
PATCH /attendances/:id
```

### 4.2. Thông báo quản trị, xác nhận và phản hồi phụ huynh

FE: `src/components/layout/Header.jsx` và
`src/datas/systemNotificationsData.js`

Hiện trạng:

- Danh sách và số chưa đọc lấy từ file local.
- Nút “Gửi phản hồi phụ huynh” chỉ hiện toast thành công.
- Nút “Xác nhận thông báo” chỉ đóng modal.
- BE có entity `notifications` phục vụ customer/parent, nhưng không có
  notification controller/service cho màn quản trị và entity hiện tại không có
  đủ các field chi tiết mà FE hiển thị.

Contract tối thiểu cần thiết:

```http
GET   /notifications?page=1&size=20&isRead=false&type=
PATCH /notifications/:id/read
POST  /notifications/:id/acknowledge
POST  /notifications/:id/replies
```

BE cần chốt thêm:

- Người nhận là customer hay user/employee/branch.
- Quan hệ với order, meal selection, wallet transaction.
- Trạng thái xử lý nghiệp vụ khác với trạng thái đã đọc.
- Nội dung phản hồi, người phản hồi, thời gian phản hồi và audit.
- Socket event để cập nhật badge/list mà không cần reload.

### 4.3. Thông tin gian hàng

FE: `src/pages/StoreInfo.jsx`

Hiện tại tên, hotline, địa chỉ và website đều hard-code. BE có
`GET /branches/:id`, nhưng entity `Branch` mới có `name`, `address`, `status`,
`maxCustomerDebt`; chưa có `phone`, `website`, logo hoặc cấu hình gian hàng.

Không nhất thiết tạo resource mới. Có thể mở rộng `Branch` và dùng:

```http
GET /branches/:id
PUT /branches/:id
```

Chỉ cần làm khi màn này được xác định là màn quản trị/cập nhật thật.

## 5. Những phần không phải BE thiếu API

Các mục sau đang dùng mock hoặc chưa gắn nút lưu, nhưng BE đã có route tương
ứng; đây chủ yếu là việc FE và mapping contract:

| Màn hình | FE hiện tại | BE đã có |
|---|---|---|
| Phiếu chi | Form chưa gom state và nút Lưu chưa gọi API | `POST /finance/payments` |
| Chuyển tiền nội bộ | Bảng dùng `internalTransferData`, nút Lưu chưa gọi API | `GET /finance/transfers`, `POST /finance/transfers` |
| Nguồn thu khác | Một số loại vẫn lấy `receiptSourceData` | Có customers, employees, suppliers; cần chốt mapping đối tượng |
| Đổi mật khẩu tài khoản | FE có input nhưng không gửi `currentPassword/newPassword` | `PUT /users/me` đã nhận hai field trong DTO, nhưng service chưa hash/validate mật khẩu nên contract vẫn chưa hoàn chỉnh |

Lưu ý: `UserService.updateProfile()` hiện chỉ `Object.assign()` dữ liệu vào user.
Nếu bật đổi mật khẩu ở FE, BE phải kiểm tra mật khẩu hiện tại và hash mật khẩu
mới; tuyệt đối không lưu `newPassword` trực tiếp.

## 6. Kế hoạch triển khai đề xuất

### Giai đoạn 1 — Gỡ các lỗi chặn luồng đang dùng

1. Sửa FE path/body gạch nợ khách hàng.
2. Chuẩn hóa body `POST /finance/receipts`.
3. Chốt và sửa một workflow chuyển kho duy nhất.
4. Bỏ việc phân trang local trên tập dữ liệu chỉ có 10 bản ghi.

### Giai đoạn 2 — Chuẩn hóa nghiệp vụ kho

1. Tạo list phiếu nhập/xuất theo header.
2. Tạo API detail phiếu kho.
3. Quyết định có hỗ trợ sửa draft kiểm kho hay xóa API FE chưa dùng.
4. Thêm test transaction/idempotency cho complete chuyển kho và kiểm kho.

### Giai đoạn 3 — Thay dữ liệu giả

1. Thiết kế entity và API attendance.
2. Thiết kế notification quản trị, acknowledge, reply và socket.
3. Nối FE phiếu chi/chuyển quỹ vào các API finance đã có.
4. Mở rộng branch/store config nếu màn thông tin gian hàng cần chỉnh sửa.

## 7. Tiêu chí nghiệm thu

- Mỗi API có Swagger DTO đúng với payload FE thực gửi.
- FE không còn fallback mock cho lỗi `404` ở luồng production.
- List API dùng server-side pagination và giữ được `page`, `size`, `total`.
- API detail trả đủ quan hệ cần hiển thị, không bắt FE tải toàn bộ list.
- Các thao tác tiền và kho chạy trong transaction.
- `complete`/`acknowledge` có cơ chế chống xử lý lặp.
- Có test tối thiểu cho happy path, validation, sai branch/quyền, bản ghi không
  tồn tại và gọi lặp.

## 8. File nguồn đã đối chiếu chính

FE:

- `../FE_Kido_MBH/src/api/*Api.js`
- `../FE_Kido_MBH/src/pages/CashManagement/ReceiptVoucher.jsx`
- `../FE_Kido_MBH/src/pages/Stock/StockInList.jsx`
- `../FE_Kido_MBH/src/pages/Stock/StockOutList.jsx`
- `../FE_Kido_MBH/src/pages/Stock/StockTransfer.jsx`
- `../FE_Kido_MBH/src/pages/Employee/TimeKeeping.jsx`
- `../FE_Kido_MBH/src/components/layout/Header.jsx`

BE:

- `src/modules/wallet/wallet.controller.ts`
- `src/modules/wallet/dto/topup-wallet.dto.ts`
- `src/modules/finance/finance.controller.ts`
- `src/modules/finance/dto/create-money-voucher.dto.ts`
- `src/modules/stock-voucher/stock-voucher.controller.ts`
- `src/modules/stock-voucher/stock-voucher.service.ts`
- `src/modules/stock-transfer/stock-transfer.controller.ts`
- `src/modules/stock-transfer/stock-transfer.service.ts`
- `src/modules/stock-take/stock-take.controller.ts`
- `src/modules/work-schedule/work-schedule.service.ts`
- `src/entities/notification.entity.ts`
