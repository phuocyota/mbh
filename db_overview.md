# Database Overview

Tài liệu này tóm tắt tính năng nghiệp vụ của các table đang được định nghĩa trong `src/entities`.

## Quy ước chung

Tất cả entity kế thừa `BaseEntity`, nên mặc định có các cột:

| Cột          | Ý nghĩa                     |
| ------------ | --------------------------- |
| `id`         | UUID khóa chính             |
| `created_at` | Thời điểm tạo bản ghi       |
| `updated_at` | Thời điểm cập nhật gần nhất |
| `created_by` | Người tạo, nếu có           |
| `updated_by` | Người cập nhật, nếu có      |

## Hệ thống, chi nhánh và thiết bị

| Table         | Tính năng                                                                            | Dữ liệu chính                                                                                   | Liên kết                                                                         |
| ------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `branches`    | Quản lý chi nhánh/cửa hàng. Dùng làm điểm neo cho POS, đơn hàng, ca bán, kho và quỹ. | Tên, địa chỉ, trạng thái, `max_customer_debt` setting hạn mức nợ khách hàng cấp chi nhánh.      | 1-n `pos_devices`, `orders`, `shifts`; được tham chiếu bởi nhiều bảng nghiệp vụ. |
| `users`       | Quản lý tài khoản nhân sự đăng nhập và phân quyền.                                   | Họ tên, phone, email, password hash, role, status, branch, avatar, địa chỉ, ngày sinh, ghi chú. | Thuộc `branches`; tạo đơn hàng, giao dịch ví, hoàn tiền, ca bán, thanh toán.     |
| `pos_devices` | Quản lý máy POS/thiết bị bán hàng theo chi nhánh.                                    | Mã thiết bị, tên, loại thiết bị, trạng thái, lần đồng bộ cuối.                                  | Thuộc `branches`; có `orders`, `shifts`.                                         |

## Sản phẩm và giỏ hàng

| Table        | Tính năng                                           | Dữ liệu chính                                                                     | Liên kết                                                                                                                    |
| ------------ | --------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `categories` | Phân nhóm sản phẩm và sắp xếp hiển thị menu.        | Tên, thứ tự sắp xếp, trạng thái.                                                  | 1-n `products`.                                                                                                             |
| `products`   | Quản lý danh mục mặt hàng bán.                       | SKU, tên, mô tả, ảnh, giá bán, giá vốn, đơn vị tính, trạng thái active. | Thuộc `categories`; được dùng trong `order_items`, `cart_items`, `stock_items`, `stock_receipt_detail`, `stock_take_items`. |
| `carts`      | Lưu giỏ hàng/đơn nháp tạm trước khi chốt thành đơn. | Customer, session, branch, tổng tiền, số lượng item.                              | 1-n `cart_items`.                                                                                                           |
| `cart_items` | Lưu từng dòng sản phẩm trong giỏ hàng.              | Product, tên snapshot, đơn giá, số lượng, thành tiền, ghi chú.                    | Thuộc `carts`; tham chiếu `products`.                                                                                       |

## Bán hàng

| Table         | Tính năng                                                                               | Dữ liệu chính                                                                                                                                                                  | Liên kết                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `orders`      | Quản lý hóa đơn/đơn hàng POS. Theo dõi trạng thái xử lý, thanh toán, coupon và cashier. | Mã đơn, số thứ tự, branch, POS, customer, cashier, coupon, loại đơn, status, subtotal, discount, total, paid, change, payment status/method, các mốc paid/completed/cancelled. | Thuộc `branches`, `pos_devices`, `customers`, `users`, `coupons`; có `order_items`, `payments`, `refunds`. |
| `order_items` | Lưu chi tiết sản phẩm trong đơn hàng.                                                   | Product, tên snapshot, đơn giá, số lượng, subtotal, discount, total, status, ghi chú.                                                                                          | Thuộc `orders`; tham chiếu `products`.                                                                     |

## Thanh toán, ví và hoàn tiền

| Table                 | Tính năng                                              | Dữ liệu chính                                                                             | Liên kết                                                               |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `payments`            | Ghi nhận lần thanh toán cho đơn hàng.                  | Order, phương thức, số tiền, status, mã giao dịch, customer thanh toán.                   | Thuộc `orders`; gắn với user tạo thanh toán qua `created_by`.          |
| `wallets`             | Quản lý số dư ví của customer. Số nợ thực tế của customer được xác định bằng số dư ví âm. | Customer, balance, status.                                                                | 1-1 `customers`; có `wallet_transactions`.                             |
| `wallet_transactions` | Lịch sử biến động số dư ví.                            | Wallet, customer, type, amount, balance before/after, ref type/id, note.                  | Thuộc `wallets`, `customers`; gắn user tạo giao dịch qua `created_by`. |
| `refunds`             | Quản lý yêu cầu hoàn tiền theo đơn hàng.               | Order, refund code, refund amount, reason, status, người duyệt, thời điểm duyệt/hoàn tất. | Thuộc `orders`; gắn user tạo; có `refund_items`.                       |
| `refund_items`        | Chi tiết sản phẩm/số lượng được hoàn trong một refund. | Refund, order item, quantity, amount.                                                     | Thuộc `refunds`; tham chiếu `order_items`.                             |
| `coupons`             | Quản lý coupon/giảm giá gắn cho customer.              | Customer, giá trị giảm, số lượng, đã dùng, status, ngày hết hạn.                          | Thuộc `customers`; được dùng bởi `orders`.                             |

## Khách hàng, học sinh và lớp học

| Table              | Tính năng                                              | Dữ liệu chính                                                            | Liên kết                                                                                 |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `customers`        | Quản lý khách hàng, học sinh, giáo viên hoặc khách lẻ. | Mã customer, họ tên, phone, type, status, `debt_limit` hạn mức nợ còn lại riêng của customer, user liên kết. | Có `orders`, `wallet`, `student_profile`, `student_classes`, `coupons`, `notifications`. |
| `student_profiles` | Hồ sơ học sinh mở rộng từ customer.                    | Customer, class hiện tại, mã học sinh, họ tên.                           | 1-1 `customers`; có `student_cards`.                                                     |
| `student_cards`    | Quản lý thẻ học sinh/định danh card UID.               | Student profile, card UID, card number, status, ngày phát hành/hết hạn.  | Thuộc `student_profiles`.                                                                |
| `schools`          | Quản lý trường học.                                    | Tên, địa chỉ, phone, status.                                             | Được tham chiếu bởi `classes`.                                                           |
| `classes`          | Quản lý lớp học theo trường.                           | Tên lớp, school, khối/lớp, status.                                       | Thuộc `schools`; có `student_classes`.                                                   |
| `student_classes`  | Bảng gắn học sinh vào lớp theo năm học.                | Student/customer, class, year, status.                                   | Nối `customers` với `classes`.                                                           |

## Ca bán và tiền mặt tại quầy

| Table            | Tính năng                                   | Dữ liệu chính                                                                                                     | Liên kết                                                       |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `shifts`         | Quản lý ca làm/ca bán của cashier trên POS. | Branch, POS, cashier, tiền đầu ca, tiền cuối ca, tiền kỳ vọng, chênh lệch, status, thời điểm mở/đóng ca, ghi chú. | Thuộc `branches`, `pos_devices`, `users`; có `cash_movements`. |
| `cash_movements` | Ghi nhận thu/chi tiền mặt trong ca.         | Shift, type CASH_IN/CASH_OUT, amount, reason.                                                                     | Thuộc `shifts`; gắn user tạo qua `created_by`.                 |

## Kho và chứng từ kho

| Table                       | Tính năng                                                           | Dữ liệu chính                                                                                                   | Liên kết                                                                                                         |
| --------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `stocks`                    | Quản lý kho/điểm tồn theo chi nhánh.                                | Tên kho, branch, địa chỉ, ghi chú.                                                                              | Thuộc `branches`; có `stock_items`; được dùng bởi lý do/chứng từ kho.                                            |
| `stock_items`               | Tồn kho hiện tại theo sản phẩm trong từng kho.                      | Stock, product, quantity.                                                                                       | Nối `stocks` với `products`; unique theo `stock_id` + `product_id`.                                              |
| `stock_receipt_import`      | Phiếu nhập kho, có thể gắn nhà cung cấp/đơn hàng/quỹ/phiếu tiền.    | Code, branch, supplier, order, fund, money voucher, total amount, status, note.                                 | Thuộc `branches`, `suppliers`, `orders`, `funds`, `money_vouchers`; có `stock_receipt_detail`.                   |
| `stock_receipt_export`      | Phiếu xuất kho, có thể gắn đơn hàng/quỹ/phiếu tiền.                 | Code, branch, order, fund, money voucher, total amount, status, note.                                           | Thuộc `branches`, `orders`, `funds`, `money_vouchers`; có `stock_receipt_detail`.                                |
| `stock_receipt_transfer`    | Phiếu chuyển kho/nhận chuyển hàng giữa chi nhánh.                   | Code, transfer id, from branch, to branch, status, received at, total amount, note.                             | Nối 2 `branches`; có `stock_receipt_detail`.                                                                     |
| `stock_receipt_detail`      | Chi tiết dòng hàng của phiếu nhập/xuất/chuyển kho.                  | Product, quantity, receipt type, from/to id, from/to type, import/export/transfer id.                           | Thuộc một trong `stock_receipt_import`, `stock_receipt_export`, `stock_receipt_transfer`; tham chiếu `products`. |
| `stock_takes`               | Phiếu kiểm kê kho.                                                  | Branch, code, status, counted at, tổng chênh lệch tiền, tổng tăng/giảm số lượng, note.                          | Thuộc `branches`; có `stock_take_items`.                                                                         |
| `stock_take_items`          | Chi tiết sản phẩm trong phiếu kiểm kê.                              | Stock take, product, system quantity, actual quantity, difference quantity, unit cost, difference amount, note. | Thuộc `stock_takes`; tham chiếu `products`.                                                                      |
| `stock_fund_receipt_reason` | Danh mục/lý do liên kết nghiệp vụ giữa kho và quỹ khi tạo chứng từ. | Stock, fund, reason, note, status.                                                                              | Tùy chọn tham chiếu `stocks` và `funds`.                                                                         |

## Quỹ, kế toán và công nợ

| Table                   | Tính năng                                                                                | Dữ liệu chính                                                                                                              | Liên kết                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `funds`                 | Quản lý quỹ/tài khoản tiền theo chi nhánh và mã tài khoản kế toán.                       | Branch, code, name, account code, balance, debit, credit, status.                                                          | Thuộc `branches`; được dùng bởi phiếu thu/chi/chuyển quỹ, money voucher, stock receipt.                 |
| `fund_transactions`     | Nhật ký biến động quỹ và số dư sau giao dịch.                                            | Fund, type, amount, balance after, debit/credit account code, ref type/id, order id, note.                                 | Thuộc `funds`; liên kết logic với các chứng từ qua `ref_type`, `ref_id`, `order_id`.                    |
| `fund_receipt_received` | Phiếu thu tiền vào quỹ.                                                                  | Code, branch, amount, fund, status, note.                                                                                  | Thuộc `branches`, `funds`; có `fund_detail`.                                                            |
| `fund_receipt_paid`     | Phiếu chi tiền từ quỹ.                                                                   | Code, branch, amount, fund, status, note.                                                                                  | Thuộc `branches`, `funds`; có `fund_detail`.                                                            |
| `fund_receipt_transfer` | Phiếu chuyển tiền giữa hai quỹ.                                                          | Code, amount, from fund, to fund, status, note.                                                                            | Nối 2 `funds`; có `fund_detail`.                                                                        |
| `fund_detail`           | Chi tiết hạch toán/phân loại của phiếu thu, chi, chuyển quỹ.                             | Amount, type, category, fund, received/paid/transfer id, note.                                                             | Thuộc `funds`; gắn vào một trong `fund_receipt_received`, `fund_receipt_paid`, `fund_receipt_transfer`. |
| `money_vouchers`        | Chứng từ tiền tổng quát cho thu/chi liên quan quỹ, đơn hàng, nhà cung cấp hoặc ref khác. | Code, type, fund, amount, order, supplier, purpose, debit/credit account code, ref type/id, note.                          | Thuộc `funds`; tùy chọn tham chiếu `orders`, `suppliers`.                                               |
| `suppliers`             | Quản lý nhà cung cấp/đối tác mua hàng.                                                   | Code, name, phone, email, tax code, company, địa chỉ, tỉnh/huyện/xã, CMND/CCCD, group, note, debt, total purchase, status. | Được dùng bởi `stock_receipt_import`, `money_vouchers`, `debts`.                                        |
| `debts`                 | Lịch sử công nợ nhà cung cấp.                                                            | Supplier, type, amount, balance after, ref type/id, note.                                                                  | Thuộc `suppliers`; liên kết chứng từ qua `ref_type`, `ref_id`.                                          |

## Nhân sự, lương và lịch làm

| Table            | Tính năng                                  | Dữ liệu chính                                                                     | Liên kết                                                |
| ---------------- | ------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `employees`      | Quản lý hồ sơ nhân viên vận hành/làm việc. | Code, timekeeping code, họ tên, phone, CCCD, debt, note, status.                  | Được dùng bởi `work_schedules`.                         |
| `work_schedules` | Lịch làm việc của nhân viên theo ngày/ca.  | Employee, work date, shift, note.                                                 | Thuộc `employees`.                                      |
| `payrolls`       | Bảng lương theo chu kỳ.                    | Code, name, cycle, period start/end, total salary, paid, remaining, status, note. | Hiện chưa có relation entity tới employee/detail lương. |

## Thông báo

| Table           | Tính năng                                                                       | Dữ liệu chính                                                   | Liên kết                                                                        |
| --------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `notifications` | Lưu thông báo gửi cho customer về đơn hàng, thanh toán, nạp tiền hoặc hệ thống. | Customer, message, type, amount, is read, read at, ref id/type. | Thuộc `customers`; liên kết logic tới đối tượng nguồn qua `ref_type`, `ref_id`. |

## Ghi chú về relation logic

Một số table có cặp `ref_type` và `ref_id` thay vì foreign key cứng, vì chúng cần trỏ tới nhiều loại chứng từ khác nhau:

| Table               | Mục đích                                                                    |
| ------------------- | --------------------------------------------------------------------------- |
| `fund_transactions` | Nối giao dịch quỹ với đơn hàng, phiếu tiền, phiếu kho hoặc chứng từ khác.   |
| `money_vouchers`    | Nối chứng từ tiền với nguồn phát sinh linh hoạt.                            |
| `debts`             | Nối công nợ nhà cung cấp với phiếu nhập, phiếu chi hoặc chứng từ liên quan. |
| `notifications`     | Nối thông báo với đối tượng nguồn bất kỳ.                                   |
