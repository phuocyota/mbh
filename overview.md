# Tài liệu Tổng quan Hệ thống MBH (MBH POS System Overview)

## 📋 Giới thiệu dự án
**MBH** (Kids Do Canteen Backend) là một hệ thống backend quản lý canteen trường học toàn diện, được xây dựng dựa trên kiến trúc Modular Monolith sử dụng NestJS, TypeORM và cơ sở dữ liệu PostgreSQL. Hệ thống hỗ trợ mô hình chuỗi nhiều chi nhánh (Multi-Branch), thiết bị bán hàng (POS Device), đồng bộ thực đơn học sinh/phụ huynh theo ngày học (Meal Planning), quản lý ví điện tử nội bộ và công nợ khách hàng linh hoạt, tích hợp quản lý kho bãi kế toán sâu sắc.

## 🏗️ Kiến trúc & Công nghệ (Tech Stack)
- **Framework chính**: NestJS v11.0.1 (TypeScript)
- **ORM & Cơ sở dữ liệu**: TypeORM v0.3.28 & PostgreSQL (pg driver v8.20.0)
- **Realtime**: Socket.io (@nestjs/platform-socket.io & socket.io v4.8.1)
- **Bảo mật & Phân quyền**: Passport.js (@nestjs/passport, passport-jwt, passport-local, bcrypt v6.0.0)
- **Tài liệu hóa API**: Swagger/OpenAPI (@nestjs/swagger & swagger-ui-express)
- **Xác thực dữ liệu**: class-validator & class-transformer
- **Quản lý Monorepo**: npm workspaces với các packages nội bộ (`packages/accounting`, `packages/inventory`, `packages/order`) để tái sử dụng logic tính toán kế toán, kho và đơn hàng.

---

## 📁 Cấu trúc thư mục dự án
Tóm tắt cấu trúc thư mục chính của dự án:
- `src/`: Mã nguồn chính của NestJS application.
  - `config/`: Cấu hình hệ thống (như Database Config).
  - `entities/`: Định nghĩa các thực thể dữ liệu (50 bảng cơ sở dữ liệu).
  - `modules/`: Các module nghiệp vụ (38 module khác nhau).
  - `common/`: Các thành phần dùng chung (guards, filters, interceptors, decorators, constants, utils).
  - `migrations/`: Lịch sử di cư cơ sở dữ liệu (Database Migrations).
  - `main.ts`: Điểm khởi chạy của ứng dụng, cấu hình CORS, Global Pipes, Exception Filters, Logger và Swagger.
- `packages/`: Các thư viện nghiệp vụ chia sẻ độc lập trong Monorepo:
  - `accounting/`: Quản lý quy tắc hạch toán tài khoản kế toán, công nợ nhà cung cấp, và phát sinh chứng từ tiền.
  - `inventory/`: Quy tắc kiểm tra tính hợp lệ và cập nhật kho bãi.
  - `order/`: Bộ tính toán giá tiền, chiết khấu và kiểm tra tính hợp lệ của đơn hàng.

---

## 🔑 Các thực thể dữ liệu chính (Core Entities & Schema)
Hệ thống sử dụng khoảng 50 bảng PostgreSQL, được chia làm các nhóm nghiệp vụ chính:

### 1. Hệ thống, Chi nhánh & Thiết bị
- `branches`: Quản lý chi nhánh canteen.
- `users`: Tài khoản quản trị, nhân viên và khách hàng/học sinh đăng nhập.
- `pos_devices`: Quản lý các thiết bị POS tại mỗi quầy của chi nhánh.

### 2. Khách hàng, Học sinh & Lớp học
- `customers`: Hồ sơ khách hàng tổng quát (học sinh, giáo viên, khách lẻ).
- `student_profiles`: Hồ sơ học sinh chi tiết liên kết 1-1 với `customers`.
- `student_cards`: Quản lý thẻ RFID/mã định danh thẻ của học sinh.
- `schools` & `classes` & `student_classes`: Cấu trúc tổ chức trường học, lớp học và phân lớp theo năm học.

### 3. Sản phẩm, Menu & Giỏ hàng
- `categories`: Danh mục sản phẩm (Đồ ăn, thức uống, v.v.).
- `products`: Thông tin chi tiết sản phẩm.
- `product_price_history`: Lịch sử thay đổi giá bán/giá vốn sản phẩm.
- `carts` & `cart_items`: Giỏ hàng nháp tạm của người dùng trước khi đặt đơn.

### 4. Quản lý Thực đơn & Đặt trước (Meal Planning)
- `meal_items`: Danh sách món ăn được thiết lập theo buổi học (`BREAKFAST`, `LUNCH`, `AFTERNOON`, `DINNER`), theo khối lớp (`level`), chi nhánh và ngày học cụ thể (`dateKey`).
- `customer_meal_items`: Lựa chọn món ăn cụ thể được tùy biến hoặc tự động chọn cho từng học sinh theo ngày học.

### 5. Đơn hàng & Thanh toán
- `orders`: Hóa đơn mua hàng từ Kiosk hoặc Cashier thao tác trực tiếp tại POS.
- `order_items`: Chi tiết các món trong đơn hàng.
- `order_status_log`: Lịch sử thay đổi trạng thái đơn hàng.
- `payments`: Các lượt thanh toán cho đơn hàng.
- `refunds` & `refund_items`: Yêu cầu hoàn tiền đơn hàng và danh sách món được hoàn.
- `coupons`: Khuyến mãi áp dụng cho khách hàng.

### 6. Ca bán & Tiền mặt quầy
- `shifts`: Ca làm việc của nhân viên thu ngân tại quầy POS.
- `cash_movements`: Thu/chi tiền mặt phát sinh trong ca quầy (CASH_IN, CASH_OUT).

### 7. Quản lý Kho bãi
- `stocks`: Danh sách kho hàng theo chi nhánh.
- `stock_items`: Số lượng tồn kho thực tế của từng sản phẩm trong mỗi kho.
- `stock_receipt_import` & `stock_receipt_export` & `stock_receipt_transfer`: Các chứng từ nhập kho, xuất kho, và chuyển kho nội bộ.
- `stock_receipt_detail`: Chi tiết hàng hóa trong chứng từ kho.
- `stock_takes` & `stock_take_items`: Phiếu kiểm kê và đối chiếu kho thực tế.
- `stock_fund_receipt_reason`: Danh mục lý do liên kết nghiệp vụ giữa kho và quỹ tiền mặt để hạch toán tự động.

### 8. Quản lý Quỹ & Hạch toán kế toán (Finance & Accounting)
- `funds`: Tài khoản quỹ/tiền mặt/tiền gửi ngân hàng theo chi nhánh (kèm mã tài khoản kế toán 111, 112).
- `fund_transactions`: Nhật ký biến động số dư quỹ.
- `fund_receipt_received`, `fund_receipt_paid`, `fund_receipt_transfer`: Các phiếu thu, phiếu chi, chuyển quỹ tiền tệ.
- `fund_detail`: Chi tiết định khoản hạch toán nguồn thu/chi tiền.
- `money_vouchers`: Chứng từ tiền tổng quát nối các nguồn phát sinh tài chính linh hoạt.
- `suppliers`: Hồ sơ nhà cung cấp.
- `debts`: Lịch sử công nợ của nhà cung cấp từ các phiếu nhập hàng hoặc thanh toán.

### 9. Tiện ích & Nhân sự
- `employees`, `work_schedules`, `payrolls`: Quản lý hồ sơ nhân viên, lịch làm việc và bảng lương chu kỳ.
- `notifications`: Lưu trữ thông báo gửi đến khách hàng/phụ huynh.

---

## 🔄 Các luồng nghiệp vụ cốt lõi (Core Business Workflows)

### 1. Luồng Xác thực đa phương thức (Multi-Strategy Auth)
Hệ thống cung cấp 4 phương thức đăng nhập chính:
- **Email/Password (`POST /auth/login`)**: Dành cho nhân viên, quản lý, admin hệ thống.
- **Card-Based Login (`POST /auth/login-card`)**: Quét thẻ RFID tại POS quầy để định danh nhanh chóng.
  - *Luồng truy vấn*: `cards` (active) -> `student_cards` (active, chưa hết hạn) -> `student_profiles` -> `customers` -> `users` (active).
- **Student/Parent Login (`POST /auth/login/student`)**: Học sinh/Phụ huynh đăng nhập linh hoạt bằng Thẻ RFID hoặc Email/Mật khẩu trên Kiosk/App di động.
- **Register (`POST /auth/register`)**: Đăng ký tài khoản người dùng mới.

### 2. Luồng Mua hàng và Trừ ví điện tử (Order & Wallet Checkout)
Khách hàng đặt hàng qua giỏ hàng Kiosk/App hoặc Cashier thao tác trực tiếp tại POS:
- Khi hoàn tất giỏ hàng (`POST /api/cart/me/complete` hoặc POS create):
  - Hệ thống kiểm tra hình thức thanh toán (`paymentMethod`).
  - Nếu chọn **WALLET (Ví điện tử)**:
    - Tìm ví tương ứng của `customerId`.
    - Số dư ví có thể âm đại diện cho số nợ của khách hàng.
    - So sánh lượng nợ tăng thêm (`debtIncrease`) với hạn mức nợ còn lại của khách hàng (`customers.debtLimit`).
    - Nếu nợ vượt quá hạn mức cho phép, hệ thống từ chối giao dịch (`Vượt quá số nợ cho phép`).
    - Ngược lại, cập nhật số dư ví mới, trừ hạn mức nợ của khách hàng tương ứng, ghi nhận giao dịch ví (`wallet_transactions` dạng `PAYMENT`), tạo bản ghi thanh toán (`payments`) và tạo phiếu xuất kho tự động (`stock_receipt_export`).
  - Nếu chọn **CASH (Tiền mặt)**:
    - Tạo đơn hàng trạng thái `PENDING_PAYMENT`, đợi thu ngân nhận tiền mặt tại quầy (`receiveCashPayment`) để chuyển đơn sang `PREPARING` và hoàn tất xuất kho.

### 3. Luồng Hoàn tiền và Hồi phục hạn mức nợ (Refund & Debt Restoration)
- Khi đơn hàng phát sinh yêu cầu hoàn tiền (`refunds`):
  - Đối với đơn thanh toán bằng ví, hệ thống hoàn tiền lại vào ví của học sinh (`refundToWallet`).
  - Khi số dư ví âm được phục hồi (tiến gần về 0 hoặc dương), hệ thống tự động tính toán khoản nợ giảm đi để cộng ngược lại vào hạn mức nợ của khách hàng (`customers.debtLimit`), giúp phục hồi khả năng mua nợ của học sinh.
  - Lưu giao dịch ví dạng `REFUND` và thay đổi trạng thái đơn hàng tương ứng.

### 4. Luồng Lên Thực đơn Tuần & Học sinh chọn món (Weekly Meal Plan)
- Quản trị viên thiết lập thực đơn tuần theo chi nhánh, buổi học và khối lớp học (`meal_items`).
- Học sinh/Phụ huynh xem kế hoạch tuần qua endpoint `/api/meal-items/week-plan`.
- Nếu học sinh không thay đổi lựa chọn, hệ thống sẽ tự động chọn món mặc định có `sortOrder` đầu tiên cho ngày đó (`selectionSource: "DEFAULT"`).
- Học sinh có thể chọn món khác theo nhu cầu cá nhân qua endpoint `POST /api/customer-meal-items/me/select`. Lựa chọn này sẽ vô hiệu hóa món mặc định trước đó của buổi học và ghi nhận lựa chọn tùy biến (`selectionSource: "CUSTOMER"`).

### 5. Luồng Đóng/Mở ca & Thu chi tiền mặt (POS Shift Management)
- Nhân viên quầy bắt đầu ca làm việc bằng cách mở ca (`shifts`) kèm số tiền đầu ca.
- Trong ca, mọi giao dịch thu/chi tiền mặt ngoài hóa đơn (ví dụ rút tiền nộp về két, đổi tiền lẻ) được ghi nhận thông qua phiếu thu/chi tiền mặt (`cash_movements` dạng `CASH_IN` / `CASH_OUT`).
- Cuối ca, nhân viên kiểm đếm tiền mặt thực tế và thực hiện đóng ca. Hệ thống tự động đối chiếu số tiền kỳ vọng dựa trên tiền đầu ca + doanh thu tiền mặt hóa đơn + tiền mặt nạp/rút từ cash movements để đưa ra số chênh lệch quỹ tiền mặt thực tế.

### 6. Liên kết Kho bãi & Kế toán (Inventory & Finance Integration)
- Khi tạo chứng từ nhập/xuất kho (`stock_receipt_import` / `stock_receipt_export`):
  - Chứng từ kho có thể liên kết trực tiếp với quỹ tiền mặt/ngân hàng (`funds`) và chứng từ tiền (`money_vouchers`).
  - Việc thanh toán đơn nhập hàng cho nhà cung cấp (`suppliers`) sẽ tự động khấu trừ công nợ nhà cung cấp (`debts`) và hạch toán tài khoản kế toán thông qua các quy tắc (accounting formulas) được cấu hình trước.

---

### 7. Luồng Phiếu nhập hàng (Stock Import Voucher)
Phiếu nhập hàng là chứng từ ghi nhận việc mua hoặc tiếp nhận hàng hóa vào kho từ nhà cung cấp. Luồng này phải đảm bảo đồng bộ 4 phần nghiệp vụ: chứng từ kho, tồn kho, thanh toán/công nợ nhà cung cấp và hạch toán kế toán.

#### 7.1. Dữ liệu chính của phiếu nhập
- **Thông tin đầu phiếu** (`stock_receipt_import`):
  - `branchId`: Chi nhánh phát sinh nhập hàng.
  - `stockId`: Kho nhận hàng.
  - `supplierId`: Nhà cung cấp, bắt buộc với phiếu nhập mua hàng.
  - `voucherCode`: Mã phiếu nhập, tự sinh theo chi nhánh/ngày hoặc nhập tay nhưng phải chống trùng.
  - `receiptDate`: Ngày chứng từ/ngày nhập kho.
  - `status`: Trạng thái phiếu, tối thiểu gồm `DRAFT`, `COMPLETED`, `CANCELLED`.
  - `paymentStatus`: Trạng thái thanh toán, gồm `UNPAID`, `PARTIAL`, `PAID`.
  - `subtotal`, `discountAmount`, `taxAmount`, `shippingFee`, `otherFee`, `grandTotal`, `paidAmount`, `debtAmount`.
  - `note`, `createdBy`, `completedBy`, `cancelledBy`, `completedAt`, `cancelledAt`.
- **Chi tiết hàng hóa** (`stock_receipt_detail`):
  - `productId`: Sản phẩm nhập kho.
  - `quantity`: Số lượng nhập, phải lớn hơn 0.
  - `unitPrice`: Đơn giá nhập trước thuế/chiết khấu theo cấu hình.
  - `discountAmount` hoặc `discountRate`: Chiết khấu theo dòng hàng nếu có.
  - `taxRate`, `taxAmount`: Thuế theo dòng hàng nếu có.
  - `lineTotal`: Thành tiền dòng hàng sau chiết khấu và thuế.
  - `expiryDate`, `batchNo`, `unit`, `note`: Bổ sung khi cần quản lý hạn dùng/lô hàng.

#### 7.2. Vòng đời phiếu nhập
- **Tạo nháp (`DRAFT`)**:
  - Người dùng chọn chi nhánh, kho nhận hàng, nhà cung cấp và danh sách sản phẩm nhập.
  - Hệ thống validate dữ liệu, tính tổng tiền và lưu phiếu nhưng chưa cập nhật tồn kho, chưa ghi công nợ và chưa phát sinh chứng từ tiền.
- **Hoàn tất nhập kho (`COMPLETED`)**:
  - Khi xác nhận hoàn tất, hệ thống chạy trong một database transaction.
  - Khóa phiếu để tránh hoàn tất nhiều lần.
  - Cập nhật tăng `stock_items.quantity` theo từng sản phẩm trong `stockId`.
  - Ghi nhận giá nhập/giá vốn nếu hệ thống dùng giá nhập gần nhất hoặc bình quân.
  - Tạo bút toán công nợ hoặc chứng từ tiền tùy theo phương thức thanh toán.
  - Cập nhật `completedBy`, `completedAt`, `status = COMPLETED`.
- **Hủy phiếu (`CANCELLED`)**:
  - Phiếu `DRAFT` có thể hủy trực tiếp.
  - Phiếu `COMPLETED` chỉ được hủy nếu quyền nghiệp vụ cho phép và phải đảo ngược tồn kho, chứng từ tiền, công nợ và hạch toán liên quan trong cùng transaction.
  - Nếu hàng đã bán/xuất làm tồn kho không đủ để đảo, hệ thống phải từ chối hủy và yêu cầu lập chứng từ điều chỉnh riêng.

#### 7.3. Quy tắc kiểm tra hợp lệ
- `branchId`, `stockId`, `supplierId`, `receiptDate` và danh sách hàng nhập là bắt buộc.
- Kho nhận hàng phải thuộc đúng chi nhánh hoặc nằm trong phạm vi người dùng được phân quyền.
- Sản phẩm phải tồn tại, đang active và được phép quản lý tồn kho.
- Mỗi dòng hàng phải có `quantity > 0` và `unitPrice >= 0`.
- Không cho phép hoàn tất phiếu không có dòng hàng hoặc tổng tiền âm.
- Không cho phép hoàn tất lại phiếu đã `COMPLETED` hoặc `CANCELLED`.
- Nếu nhập cùng một sản phẩm nhiều dòng, hệ thống cần quy định rõ: hoặc gộp dòng theo `productId`, hoặc cho phép tách dòng theo `batchNo`/`expiryDate`.
- Mọi thay đổi sau khi phiếu đã hoàn tất phải có quyền quản lý và phải tạo log/audit để truy vết.

#### 7.4. Tính tiền phiếu nhập
- `lineSubtotal = quantity * unitPrice`.
- `lineDiscount = discountAmount` hoặc `lineSubtotal * discountRate`.
- `lineTax = (lineSubtotal - lineDiscount) * taxRate`.
- `lineTotal = lineSubtotal - lineDiscount + lineTax`.
- `subtotal = sum(lineSubtotal)`.
- `discountAmount = sum(lineDiscount) + discount toàn phiếu nếu có`.
- `taxAmount = sum(lineTax)`.
- `grandTotal = subtotal - discountAmount + taxAmount + shippingFee + otherFee`.
- `paidAmount` không được lớn hơn `grandTotal`.
- `debtAmount = grandTotal - paidAmount`.

#### 7.5. Cập nhật tồn kho
- Khi phiếu chuyển sang `COMPLETED`, hệ thống tăng tồn kho:
  - Nếu `stock_items` đã tồn tại theo `stockId + productId`, cộng thêm `quantity`.
  - Nếu chưa tồn tại, tạo mới `stock_items` với số lượng nhập ban đầu.
- Việc cập nhật tồn kho phải nằm trong transaction với cập nhật trạng thái phiếu.
- Cần lưu lịch sử biến động kho để báo cáo tồn đầu kỳ, nhập, xuất, tồn cuối kỳ.
- Nếu có quản lý lô/hạn dùng, tồn kho phải tách theo `batchNo` và `expiryDate`, không chỉ theo `productId`.

#### 7.6. Thanh toán và công nợ nhà cung cấp
- **Chưa thanh toán / công nợ**:
  - FE gửi `paymentStatus = DEBT` hoặc `UNPAID`.
  - BE tự lấy lý do `code = NHNCC`, `is_debt = true`, `status = active` từ `stock_fund_receipt_reason`.
  - Tạo công nợ phải trả nhà cung cấp trong `debts` với số tiền bằng tổng phiếu nhập.
  - Không tạo phiếu chi và không cần resolve quỹ.
- **Thanh toán đủ**:
  - FE gửi `paymentStatus = PAID`.
  - BE tự lấy lý do `code = NHNCC`, `is_debt = false`, `status = active` từ `stock_fund_receipt_reason`.
  - Parse `accounting_formula` dạng `{accountCode:sign}`; `+` là ghi Có, `-` là ghi Nợ.
  - BE lấy toàn bộ `accountCode` trong công thức và tìm đúng một quỹ active trong `funds` theo `code IN accountCodes` và `branchId` của phiếu nhập.
  - Tạo chứng từ chi tiền (`money_vouchers` loại `PAYMENT` và `fund_receipt_paid`) và không tạo nợ còn lại.
- Khi thanh toán công nợ sau nhập hàng, hệ thống phải giảm `debts` tương ứng và lưu liên kết đến phiếu nhập gốc.

#### 7.7. Hạch toán kế toán
- Khi hoàn tất phiếu nhập chưa thanh toán:
  - Nợ tài khoản hàng tồn kho.
  - Có tài khoản phải trả nhà cung cấp.
- Khi hoàn tất phiếu nhập thanh toán ngay:
  - Nợ tài khoản hàng tồn kho.
  - Có tài khoản tiền mặt/ngân hàng được resolve từ `accounting_formula` của reason `NHNCC` và `branchId`.
- Khi thanh toán công nợ sau:
  - Nợ tài khoản phải trả nhà cung cấp.
  - Có tài khoản tiền mặt/ngân hàng theo `fundId`.
- Các tài khoản hạch toán phải lấy từ cấu hình kế toán của sản phẩm, kho, quỹ hoặc công thức hạch toán đã cấu hình trong `packages/accounting`.

#### 7.8. API nghiệp vụ kỳ vọng
- `POST /stock-vouchers/imports`: Tạo phiếu nhập hàng, có thể tạo nháp hoặc tạo và hoàn tất tùy `status/action`.
- `GET /stock-vouchers`: Danh sách phiếu nhập/xuất, lọc theo chi nhánh, kho, nhà cung cấp, trạng thái, ngày chứng từ.
- `GET /stock-vouchers/:id`: Chi tiết phiếu nhập kèm dòng hàng, thanh toán, công nợ và chứng từ liên quan.
- `POST /stock-vouchers/:id/complete`: Hoàn tất phiếu nhập, cập nhật tồn kho và phát sinh tài chính.
- `POST /stock-vouchers/:id/cancel`: Hủy phiếu nhập, đảo nghiệp vụ nếu phiếu đã hoàn tất.
- `PUT /stock-vouchers/:id`: Chỉ cho phép sửa phiếu `DRAFT`; phiếu `COMPLETED` phải dùng nghiệp vụ điều chỉnh.

#### 7.8.1. Request tạo phiếu nhập từ nhà cung cấp cho FE
- Endpoint: `POST /stock-vouchers` hoặc `POST /stock-vouchers/imports`.
- Quy ước:
  - `type = IMPORT`.
  - `sourceType = SUPPLIER`.
  - `sourceId` là id nhà cung cấp.
  - `paymentStatus = PAID` nếu đã thanh toán đủ.
  - `paymentStatus = DEBT` hoặc `UNPAID` nếu chưa thanh toán.
  - Không cần gửi `fundId`.
  - Không cần gửi `reasonCode`; BE mặc định dùng `NHNCC`.
  - Nếu gửi `reasonCode` để override, BE vẫn lọc thêm `is_debt` theo `paymentStatus`.

Request đã thanh toán:
```json
{
  "type": "IMPORT",
  "branchId": "branch-id",
  "sourceType": "SUPPLIER",
  "sourceId": "supplier-id",
  "paymentStatus": "PAID",
  "note": "Nhap hang tu nha cung cap",
  "items": [
    {
      "productId": "product-id",
      "quantity": 10,
      "unitPrice": 15000,
      "note": "Ghi chu dong hang"
    }
  ]
}
```

Request chưa thanh toán / ghi công nợ:
```json
{
  "type": "IMPORT",
  "branchId": "branch-id",
  "sourceType": "SUPPLIER",
  "sourceId": "supplier-id",
  "paymentStatus": "DEBT",
  "note": "Nhap hang cong no",
  "items": [
    {
      "productId": "product-id",
      "quantity": 10,
      "unitPrice": 15000
    }
  ]
}
```

#### 7.9. Báo cáo và truy vết
- Báo cáo nhập hàng theo ngày, chi nhánh, kho, nhà cung cấp và sản phẩm.
- Báo cáo công nợ nhà cung cấp phải đối chiếu được từ phiếu nhập, phiếu chi và số dư nợ còn lại.
- Báo cáo tồn kho phải truy ngược được phiếu nhập nào làm tăng tồn.
- Mỗi thao tác tạo, sửa, hoàn tất, hủy phiếu nhập cần lưu người thao tác, thời điểm và lý do nếu có.

## 📍 Danh sách API chi tiết theo chức năng (Detailed API Reference)

Dưới đây là bảng tổng hợp tất cả các endpoint API được đăng ký trong hệ thống MBH, được nhóm theo từng module chức năng cụ thể:

### Module: SRC (Prefix: ``)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `getHello` | getHello |

### Module: AUTH (Prefix: `auth`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | `register` | Register a new user |
| `POST` | `/auth/login/student` | `loginStudent` | Student login with card or email/password |
| `POST` | `/auth/login/cashier` | `loginCashier` | Cashier login with email/password |
| `POST` | `/auth/login/admin` | `loginAdmin` | loginAdmin |

### Module: BRANCH (Prefix: `branches`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/branches` | `` | N/A |
| `GET` | `/branches/:id` | `findOne` | Get all branches |
| `POST` | `/branches` | `create` | Get branch by ID |
| `PUT` | `/branches/:id` | `update` | Create new branch |
| `DELETE` | `/branches/:id` | `delete` | Update branch |

### Module: CART (Prefix: `cart`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/cart/draft` | `createDraftCart` | Create or get anonymous draft cart without token |
| `GET` | `/cart/me` | `getMyCart` | Get my cart from JWT token |
| `POST` | `/cart/me/items` | `addItemToMyCart` | Add item to my cart (via JWT token) |
| `PUT` | `/cart/me/items/:itemId` | `updateItemQuantity` | Update item quantity in my cart |
| `DELETE` | `/cart/me/items/:itemId` | `removeItem` | Remove item from my cart |
| `POST` | `/cart/me/complete` | `completeMyCart` | Complete my cart and create an order |
| `DELETE` | `/cart/me/clear` | `clearMyCart` | Clear my cart (via JWT token) |

### Module: CASH-MOVEMENT (Prefix: `cash-movements`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/cash-movements` | `` | N/A |
| `GET` | `/cash-movements/:id` | `` | Get all cash movements |
| `POST` | `/cash-movements` | `` | Get cash movement by ID |
| `PUT` | `/cash-movements/:id` | `` | Create new cash movement |
| `DELETE` | `/cash-movements/:id` | `delete` | Update cash movement |

### Module: CATEGORY (Prefix: `categories`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | `` | N/A |
| `GET` | `/categories/:id` | `` | Get all categories |
| `POST` | `/categories` | `` | Get category by ID |
| `PUT` | `/categories/:id` | `` | Create new category |
| `DELETE` | `/categories/:id` | `delete` | Update category |

### Module: COUPON (Prefix: `coupons`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/coupons` | `createCoupon` | createCoupon |
| `GET` | `/coupons` | `getAllCoupons` | getAllCoupons |
| `GET` | `/coupons/customer/:customerId` | `getCustomerCoupons` | getCustomerCoupons |
| `GET` | `/coupons/:id` | `getCoupon` | getCoupon |
| `PUT` | `/coupons/:id` | `updateCoupon` | updateCoupon |
| `DELETE` | `/coupons/:id` | `deleteCoupon` | deleteCoupon |
| `POST` | `/coupons/:id/use/:customerId` | `useCoupon` | useCoupon |

### Module: CUSTOMER (Prefix: `customers`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/customers` | `` | N/A |
| `GET` | `/customers/search` | `` | Get all customers |
| `GET` | `/customers/by-card/:cardUid` | `` | N/A |
| `GET` | `/customers/:id` | `` | N/A |
| `POST` | `/customers` | `` | Get customer by ID |
| `PUT` | `/customers/:id` | `` | Create new customer |
| `DELETE` | `/customers/:id` | `delete` | Update customer |

### Module: CUSTOMER-MEAL-ITEM (Prefix: `customer-meal-items`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/customer-meal-items` | `` | N/A |
| `GET` | `/customer-meal-items/:id` | `` | Get customer meal items |
| `POST` | `/customer-meal-items/me/select` | `` | Get customer meal item by ID |
| `POST` | `/customer-meal-items` | `` | N/A |
| `PUT` | `/customer-meal-items/:id` | `` | Create customer meal item |
| `DELETE` | `/customer-meal-items/:id` | `delete` | Update customer meal item |

### Module: DASHBOARD (Prefix: `dashboard`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard/revenue` | `` | N/A |
| `GET` | `/dashboard/customers` | `` | Dashboard revenue stats by filter |
| `GET` | `/dashboard/recent-activities` | `getRecentActivities` | Dashboard customer stats by filter |
| `GET` | `/dashboard/employee-attendance` | `` | N/A |
| `GET` | `/dashboard/revenue/hourly` | `getHourlyRevenueStats` | getHourlyRevenueStats |
| `GET` | `/dashboard/customers/hourly` | `getHourlyCustomerStats` | Dashboard hourly revenue stats |

### Module: EMPLOYEE (Prefix: `employees`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/employees` | `findAll` | findAll |
| `GET` | `/employees/:id` | `findOne` | Lấy danh sách nhân viên, lọc theo trạng thái |
| `POST` | `/employees` | `create` | Lấy thông tin nhân viên theo ID |
| `PUT` | `/employees/:id` | `update` | Tạo nhân viên mới |
| `DELETE` | `/employees/:id` | `delete` | Cập nhật thông tin nhân viên |

### Module: FINANCE (Prefix: `finance`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/finance/funds` | `findFunds` | findFunds |
| `POST` | `/finance/funds` | `createFund` | Get all funds |
| `GET` | `/finance/money-vouchers` | `` | Create fund |
| `GET` | `/finance/summary` | `` | Get all money vouchers |
| `POST` | `/finance/receipts` | `createReceipt` | Get income/expense summary by branch |
| `POST` | `/finance/payments` | `createPayment` | Create receipt voucher |
| `GET` | `/finance/receipts/received` | `findReceiptsReceived` | Create payment voucher |
| `GET` | `/finance/receipts/paid` | `findReceiptsPaid` | Get all received receipts (PT) |
| `GET` | `/finance/transfers` | `findTransfers` | Get all paid receipts (PC) |
| `GET` | `/finance/details` | `` | Get all fund transfers (CQ) |
| `POST` | `/finance/transfers` | `createTransfer` | Get all fund details |

### Module: INVENTORY-ITEM (Prefix: `inventory-items`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/inventory-items` | `` | N/A |
| `GET` | `/inventory-items/:id` | `findOne` | findOne |
| `POST` | `/inventory-items` | `create` | Get inventory item by product ID |
| `PUT` | `/inventory-items/:id` | `update` | Create inventory item as product stock record |
| `DELETE` | `/inventory-items/:id` | `delete` | Update inventory item stock fields |

### Module: MEAL-ITEM (Prefix: `meal-items`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/meal-items` | `findAll` | findAll |
| `GET` | `/meal-items/week-plan` | `weekPlan` | Get meal items |
| `GET` | `/meal-items/:id` | `` | Get meal items grouped as a weekly plan |
| `POST` | `/meal-items` | `` | Get meal item by ID |
| `PUT` | `/meal-items/:id` | `` | Create meal item |
| `DELETE` | `/meal-items/:id` | `delete` | Update meal item |

### Module: MOMO (Prefix: `payment-result`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/payment-result/create/:orderId` | `createPayment` | createPayment |
| `POST` | `/payment-result/topup` | `createTopup` | Create MoMo payment URL for an order |
| `POST` | `/payment-result/ipn` | `processIpn` | Create MoMo topup URL for a customer |
| `GET` | `/payment-result` | `processPaymentResult` | MoMo Webhook/IPN endpoint |

### Module: ORDER-ITEM (Prefix: `order-items`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/order-items` | `findAll` | findAll |
| `GET` | `/order-items/:id` | `` | Get all order items |
| `POST` | `/order-items` | `` | Get order item by ID |
| `PUT` | `/order-items/:id` | `` | Create new order item |
| `DELETE` | `/order-items/:id` | `delete` | Update order item |

### Module: ORDERS (Prefix: `orders`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/orders` | `findAll` | Get all orders with optional filtering |
| `GET` | `/orders/pending-cash` | `findPendingCash` | Get orders waiting for cash payment |
| `GET` | `/orders/preparing` | `findPreparing` | Get orders currently preparing |
| `GET` | `/orders/ready-to-pickup` | `findReadyToPickup` | Get orders ready for pickup |
| `GET` | `/orders/:id/status-logs` | `getStatusLogs` | Get order status logs |
| `GET` | `/orders/:id` | `getOrderWithItems` | Get order with items and payments |
| `POST` | `/orders` | `createOrder` | Create new order |
| `POST` | `/orders/:id/items` | `addItemToOrder` | Add item to order |
| `POST` | `/orders/:id/receive-cash` | `receiveCashPayment` | receiveCashPayment |
| `PUT` | `/orders/:id/pending` | `setPending` | Set order status to pending |
| `PUT` | `/orders/:id/ready-to-pickup` | `setReadyToPickup` | Set order status to ready for pickup |
| `PUT` | `/orders/:id/done` | `setDone` | Set order status to done (complete) |
| `PUT` | `/orders/me/:id/received` | `confirmMyReceived` | Student confirms they received their order |
| `PUT` | `/orders/:id/received` | `confirmReceivedByCashier` | Cashier confirms customer received order |
| `PUT` | `/orders/:id/cancel` | `cancelOrder` | Cancel order with refund info |
| `DELETE` | `/orders/:id` | `removeOrder` | Remove/delete order |

### Module: PARENT (Prefix: `parent`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/parent/home` | `` | N/A |

### Module: PAYMENT (Prefix: `payments`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/payments` | `` | N/A |
| `GET` | `/payments/:id` | `` | Get all payments |
| `POST` | `/payments` | `` | Get payment by ID |
| `PUT` | `/payments/:id` | `` | Create new payment |
| `DELETE` | `/payments/:id` | `delete` | Update payment |

### Module: PAYROLL (Prefix: `payrolls`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/payrolls` | `` | N/A |
| `GET` | `/payrolls/:id` | `` | Get all payrolls with optional filters |
| `POST` | `/payrolls` | `` | Get payroll by ID |
| `PUT` | `/payrolls/:id` | `` | Create new payroll |
| `DELETE` | `/payrolls/:id` | `delete` | Update payroll |

### Module: POS-DEVICE (Prefix: `pos-devices`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/pos-devices` | `` | N/A |
| `GET` | `/pos-devices/:id` | `` | Get all POS devices |
| `POST` | `/pos-devices` | `` | Get POS device by ID |
| `PUT` | `/pos-devices/:id` | `` | Create new POS device |
| `DELETE` | `/pos-devices/:id` | `delete` | Update POS device |

### Module: PRODUCTS (Prefix: `products`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/products` | `findAll` | Get all products |
| `GET` | `/products/categories` | `findAllCategories` | Get all product categories |
| `GET` | `/products/full` | `findAllCategoriesWithProducts` | Get active categories with active products |
| `GET` | `/products/:id` | `findOne` | Get product by ID |
| `POST` | `/products` | `create` | Create new product |
| `PUT` | `/products/:id` | `update` | Update product |
| `PUT` | `/products/bulk/update` | `updateBulk` | Bulk update products |
| `DELETE` | `/products/:id` | `delete` | Delete product |

### Module: REFUND (Prefix: `refunds`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/refunds` | `` | N/A |
| `GET` | `/refunds/by-order/:orderId` | `findByOrder` | Get all refunds |
| `GET` | `/refunds/:id` | `` | Lấy danh sách refund theo order |
| `POST` | `/refunds` | `create` | Get refund by ID (kèm items) |
| `PUT` | `/refunds/:id/approve` | `approve` | approve |
| `PUT` | `/refunds/:id/reject` | `reject` | reject |
| `DELETE` | `/refunds/:id` | `delete` | Từ chối refund |

### Module: REFUND-ITEM (Prefix: `refund-items`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/refund-items` | `findAll` | findAll |
| `GET` | `/refund-items/:id` | `` | Get all refund items |
| `POST` | `/refund-items` | `` | Get refund item by ID |
| `PUT` | `/refund-items/:id` | `` | Create new refund item |
| `DELETE` | `/refund-items/:id` | `delete` | Update refund item |

### Module: REPORTS (Prefix: `reports`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/reports/revenue` | `revenueSummary` | revenueSummary |
| `GET` | `/reports/revenue/daily` | `revenueDaily` | revenueDaily |
| `GET` | `/reports/serving` | `servingStats` | Doanh thu theo từng ngày |
| `GET` | `/reports/customer` | `` | Thống kê đơn và khách đang phục vụ |
| `GET` | `/reports/menu-performance` | `` | Thống kê lượt khách hàng |
| `GET` | `/reports/cancellations` | `` | Báo cáo hiệu quả thực đơn |
| `GET` | `/reports/employee` | `` | Báo cáo tình trạng hủy món |
| `GET` | `/reports/top-products` | `topProducts` | topProducts |
| `GET` | `/reports/shifts/:shiftId/summary` | `shiftSummary` | Top sản phẩm bán chạy |
| `GET` | `/reports/stock` | `stockSnapshot` | stockSnapshot |
| `GET` | `/reports/bottom-products` | `bottomProducts` | Tồn kho hiện tại (theo chi nhánh nếu có) |
| `GET` | `/reports/end-of-day` | `endOfDay` | Sản phẩm bán chậm nhất (lowSelling) |
| `GET` | `/reports/monthly-order-plan` | `monthlyOrderPlan` | monthlyOrderPlan |
| `GET` | `/reports/inventory` | `inventoryReport` | inventoryReport |
| `GET` | `/reports/meal-items` | `` | N/A |

### Module: SHIFT (Prefix: `shifts`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/shifts` | `` | N/A |
| `GET` | `/shifts/:id` | `` | Get all shifts |
| `POST` | `/shifts` | `` | Get shift by ID |
| `PUT` | `/shifts/:id` | `` | Create new shift |
| `DELETE` | `/shifts/:id` | `delete` | Update shift |

### Module: STOCK-TAKE (Prefix: `stock-takes`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/stock-takes` | `findAll` | findAll |
| `GET` | `/stock-takes/:id` | `findOne` | Get all stock takes |
| `POST` | `/stock-takes/drafts` | `createDraft` | Get stock take by ID |
| `POST` | `/stock-takes/:id/complete` | `complete` | Create a draft stock take |

### Module: STOCK-TRANSFER (Prefix: `stock-transfers`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/stock-transfers` | `findAll` | findAll |
| `GET` | `/stock-transfers/:id` | `findOne` | Get all stock transfers |
| `POST` | `/stock-transfers` | `create` | Get stock transfer by ID |
| `POST` | `/stock-transfers/:id/complete` | `complete` | Create a draft stock transfer |

### Module: STOCK-VOUCHER (Prefix: `stock-vouchers`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/stock-vouchers` | `findAll` | findAll |
| `POST` | `/stock-vouchers/imports` | `createImport` | Get all stock import/export vouchers |
| `POST` | `/stock-vouchers/exports` | `createExport` | Create stock import voucher and payment voucher |
| `POST` | `/stock-vouchers` | `create` | Create stock export voucher and receipt voucher |

### Module: STUDENT-PROFILE (Prefix: `student-profiles`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/student-profiles` | `` | N/A |
| `GET` | `/student-profiles/:id` | `` | Get all student profiles |
| `POST` | `/student-profiles` | `` | Get student profile by ID |
| `PUT` | `/student-profiles/:id` | `` | Create new student profile |
| `DELETE` | `/student-profiles/:id` | `delete` | Update student profile |

### Module: SUPPLIER (Prefix: `suppliers`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/suppliers` | `` | N/A |
| `GET` | `/suppliers/:id` | `` | Get all suppliers with optional filters |
| `POST` | `/suppliers` | `` | Get supplier by ID |
| `PUT` | `/suppliers/:id` | `` | Create new supplier |
| `DELETE` | `/suppliers/:id` | `delete` | Update supplier |
| `GET` | `/suppliers/:id/debts` | `getDebts` | Delete supplier |

### Module: UPLOAD (Prefix: `upload`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/upload/images` | `uploadImage` | Upload image |

### Module: USER (Prefix: `users`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/users/me` | `getMe` | getMe |
| `PUT` | `/users/me` | `updateProfile` | updateProfile |
| `GET` | `/users` | `findAll` | findAll |
| `GET` | `/users/:id` | `findOne` | Get all users |
| `POST` | `/users` | `create` | Get user by ID |
| `PUT` | `/users/:id` | `update` | Create new user |
| `DELETE` | `/users/:id` | `delete` | Update user |

### Module: WALLET (Prefix: `wallets`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/wallets` | `` | N/A |
| `POST` | `/wallets/topup` | `` | Get all wallets |
| `GET` | `/wallets/customer/:customerId/balance` | `getBalance` | getBalance |
| `GET` | `/wallets/customer/:customerId/transactions` | `getTransactions` | Lấy số dư ví của customer |
| `GET` | `/wallets/:id` | `` | Lịch sử giao dịch ví của customer |
| `POST` | `/wallets` | `` | Get wallet by ID |
| `PUT` | `/wallets/:id` | `` | Create new wallet |
| `DELETE` | `/wallets/:id` | `delete` | Update wallet |

### Module: WALLET-TRANSACTION (Prefix: `wallet-transactions`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/wallet-transactions` | `` | N/A |
| `GET` | `/wallet-transactions/:id` | `` | Get all wallet transactions |
| `POST` | `/wallet-transactions` | `` | Get wallet transaction by ID |
| `PUT` | `/wallet-transactions/:id` | `` | Create new wallet transaction |
| `DELETE` | `/wallet-transactions/:id` | `delete` | Update wallet transaction |

### Module: WORK-SCHEDULE (Prefix: `work-schedules`)

| Method | Endpoint Path | Function/Method Name | Description / API Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/work-schedules/timesheet` | `` | N/A |
| `GET` | `/work-schedules/monthly` | `` | N/A |
| `GET` | `/work-schedules/:id` | `findOne` | findOne |
| `POST` | `/work-schedules` | `create` | Lấy chi tiết một lịch làm việc |
| `POST` | `/work-schedules/weekly-repeat` | `createWeeklySchedule` | Tạo lịch làm việc mới cho nhân viên |
| `PUT` | `/work-schedules/:id` | `update` | Create work schedules from a weekly template |
| `DELETE` | `/work-schedules/:id` | `delete` | Cập nhật lịch làm việc |



## 🛠️ Thiết kế Kiến trúc Kỹ thuật (Technical Architecture Patterns)

### 1. Đồng bộ Realtime với Socket Gateway
- Sử dụng Socket.io để đẩy trạng thái đơn hàng tới các quầy bếp, thu ngân và màn hình hiển thị của khách hàng.
- Tổ chức các Rooms theo chi nhánh (`orders:branch:<branchId>`), theo mã đơn (`order:<orderId>`) và dashboard thống kê (`dashboard:branch:<branchId>`).

### 2. Phân quyền và Bảo mật
- **Global Auth Guard (`AuthGuard`)**: Bảo vệ toàn bộ API ngoại trừ các route được đánh dấu bằng `@Public()`.
- **Role Guard (`RolesGuard`)**: Kiểm soát truy cập dựa trên phân quyền vai trò người dùng (`ADMIN`, `MANAGER`, `STAFF`, `STUDENT`, `CUSTOMER`).
- **Read-Only Role Guard (`ReadOnlyRoleGuard`)**: Bảo vệ dữ liệu khỏi các thay đổi trái phép (write operations) từ các tài khoản chỉ có quyền xem thông tin.

### 3. Cấu trúc Response chuẩn hóa
Hệ thống sử dụng global interceptor `ResponseInterceptor` để wrap toàn bộ API response thành một định dạng chuẩn:
```json
{
  "success": true,
  "message": "Thành công",
  "data": { ... }
}
```

---

## 🚀 Hướng dẫn phát triển và chạy ứng dụng

### 1. Biến môi trường yêu cầu (.env)
```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=mbh_db
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRATION=24h
```

### 2. Lệnh khởi chạy chính
- Cài đặt thư viện: `npm install`
- Khởi chạy ở chế độ phát triển (watch mode): `npm run start:dev`
- Biên dịch dự án: `npm run build`
- Chạy môi trường production: `npm run start:prod`
- Định dạng code: `npm run format`
- Kiểm tra lỗi cú pháp: `npm run lint`

---

*Tài liệu được tạo tự động bởi AI trợ lý coding Antigravity dựa trên cấu trúc thực tế của mã nguồn dự án vào năm 2026.*
