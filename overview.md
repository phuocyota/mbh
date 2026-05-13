# Database Design - Hệ Thống POS Canteen/Trường Học

## 📋 Giới Thiệu

Đây là thiết kế database đủ dùng cho hệ thống POS thực tế với khả năng mở rộng cho:
- Canteen/trường học
- Nhiều quầy bán hàng
- Nhiều nhân viên
- Quản lý tồn kho
- Thanh toán đa phương thức
- Hoàn tiền và điều chỉnh

---

## 1️⃣ Nhóm Người Dùng

### `users`
Dùng cho admin, nhân viên bán hàng, quản lý kho.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `full_name` | varchar | Tên đầy đủ |
| `phone` | varchar | Số điện thoại |
| `email` | varchar | Email |
| `password_hash` | varchar | Mật khẩu đã mã hóa |
| `role` | varchar | ADMIN, MANAGER, CASHIER, KITCHEN, STAFF |
| `status` | varchar | ACTIVE, INACTIVE |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

---

## 2️⃣ Chi Nhánh / Quầy POS

### `branches`
Thông tin chi nhánh hoặc quầy bán hàng.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `name` | varchar | Tên chi nhánh |
| `address` | text | Địa chỉ |
| `status` | varchar | Trạng thái |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

### `pos_devices`
Mỗi máy POS, máy handheld, tablet là 1 device.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `branch_id` | uuid | Foreign Key → branches |
| `device_code` | varchar | Mã thiết bị |
| `device_name` | varchar | Tên thiết bị |
| `device_type` | varchar | DESKTOP_POS, HANDHELD, TABLET |
| `status` | varchar | ACTIVE, INACTIVE |
| `last_sync_at` | timestamp | Lần đồng bộ cuối |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

---

## 3️⃣ Khách Hàng / Học Sinh

### `customers`
Thông tin khách hàng, học sinh, giáo viên.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `customer_code` | varchar | Mã khách hàng |
| `full_name` | varchar | Tên đầy đủ |
| `phone` | varchar | Số điện thoại |
| `type` | varchar | STUDENT, TEACHER, GUEST |
| `status` | varchar | Trạng thái |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

### `student_profiles`
Nếu là hệ thống trường học.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `customer_id` | uuid | Foreign Key → customers |
| `school_id` | uuid | ID trường học |
| `class_id` | uuid | ID lớp |
| `student_code` | varchar | Mã học sinh |
| `parent_phone` | varchar | Số điện thoại phụ huynh |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

---

## 4️⃣ Thẻ Học Sinh / Ví Nội Bộ

### `cards`
Thẻ NFC/RFID/magnetic cho học sinh.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `customer_id` | uuid | Foreign Key → customers |
| `card_uid` | varchar | Mã NFC/RFID/magnetic card |
| `card_number` | varchar | Số thẻ |
| `status` | varchar | ACTIVE, LOST, BLOCKED |
| `issued_at` | timestamp | Ngày cấp thẻ |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

### `wallets`
Ví nội bộ cho khách hàng.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `customer_id` | uuid | Foreign Key → customers |
| `balance` | numeric(12,2) | Số dư |
| `status` | varchar | Trạng thái |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

### `wallet_transactions`
Lưu lịch sử nạp tiền, trừ tiền, hoàn tiền.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `wallet_id` | uuid | Foreign Key → wallets |
| `customer_id` | uuid | Foreign Key → customers |
| `type` | varchar | TOPUP, PAYMENT, REFUND, ADJUSTMENT |
| `amount` | numeric(12,2) | Số tiền |
| `balance_before` | numeric(12,2) | Số dư trước |
| `balance_after` | numeric(12,2) | Số dư sau |
| `ref_type` | varchar | ORDER, REFUND, MANUAL |
| `ref_id` | uuid | ID tham chiếu |
| `note` | text | Ghi chú |
| `created_by` | uuid | Foreign Key → users |
| `created_at` | timestamp | Ngày tạo |

---

## 5️⃣ Sản Phẩm / Món Ăn

### `categories`
Danh mục sản phẩm.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `name` | varchar | Tên danh mục |
| `sort_order` | int | Thứ tự sắp xếp |
| `status` | varchar | Trạng thái |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

### `products`
Sản phẩm/món ăn.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `category_id` | uuid | Foreign Key → categories |
| `sku` | varchar | Mã sản phẩm |
| `name` | varchar | Tên sản phẩm |
| `description` | text | Mô tả |
| `image_url` | text | URL hình ảnh |
| `price` | numeric(12,2) | Giá bán |
| `cost_price` | numeric(12,2) | Giá vốn |
| `unit` | varchar | Đơn vị (phần, ly, cái, hộp) |
| `is_active` | boolean | Có hoạt động |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

### `product_prices`
Lưu lịch sử đổi giá (tùy chọn).

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `product_id` | uuid | Foreign Key → products |
| `price` | numeric(12,2) | Giá |
| `start_date` | date | Ngày bắt đầu |
| `end_date` | date | Ngày kết thúc |
| `created_by` | uuid | Foreign Key → users |
| `created_at` | timestamp | Ngày tạo |

---

## 6️⃣ Tồn Kho

### `inventory_items`
Nguyên liệu hoặc hàng hóa nhập kho.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `name` | varchar | Tên nguyên liệu |
| `unit` | varchar | Đơn vị (kg, g, chai, hộp) |
| `status` | varchar | Trạng thái |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

### `stock_levels`
Tồn hiện tại theo chi nhánh.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `branch_id` | uuid | Foreign Key → branches |
| `inventory_item_id` | uuid | Foreign Key → inventory_items |
| `quantity` | numeric(12,2) | Số lượng |
| `updated_at` | timestamp | Ngày cập nhật |

### `stock_transactions`
Lịch sử nhập/xuất/điều chỉnh kho.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `branch_id` | uuid | Foreign Key → branches |
| `inventory_item_id` | uuid | Foreign Key → inventory_items |
| `type` | varchar | IMPORT, EXPORT, SALE, ADJUSTMENT, WASTE |
| `quantity` | numeric(12,2) | Số lượng |
| `ref_type` | varchar | ORDER, IMPORT_NOTE, MANUAL |
| `ref_id` | uuid | ID tham chiếu |
| `note` | text | Ghi chú |
| `created_by` | uuid | Foreign Key → users |
| `created_at` | timestamp | Ngày tạo |

### `product_recipes`
Nếu bán 1 ly sữa hạt thì trừ bao nhiêu nguyên liệu.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `product_id` | uuid | Foreign Key → products |
| `inventory_item_id` | uuid | Foreign Key → inventory_items |
| `quantity` | numeric(12,2) | Số lượng nguyên liệu |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

---

## 7️⃣ Đơn Hàng POS

### `orders`
Bảng quan trọng nhất - chứa thông tin đơn hàng.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `order_code` | varchar | Mã đơn hàng (unique) |
| `branch_id` | uuid | Foreign Key → branches |
| `pos_device_id` | uuid | Foreign Key → pos_devices |
| `customer_id` | uuid | Foreign Key → customers (nullable) |
| `cashier_id` | uuid | Foreign Key → users |
| `order_type` | varchar | DINE_IN, TAKEAWAY, PRE_ORDER |
| `status` | varchar | DRAFT, PENDING_PAYMENT, PAID, PREPARING, COMPLETED, CANCELLED, REFUNDED |
| `subtotal` | numeric(12,2) | Tổng cộng trước chiết khấu |
| `discount_amount` | numeric(12,2) | Tiền chiết khấu |
| `total_amount` | numeric(12,2) | Tổng cộng |
| `paid_amount` | numeric(12,2) | Số tiền đã thanh toán |
| `change_amount` | numeric(12,2) | Tiền thối lại |
| `payment_status` | varchar | UNPAID, PAID, PARTIAL, REFUNDED |
| `note` | text | Ghi chú |
| `created_at` | timestamp | Ngày tạo |
| `paid_at` | timestamp | Ngày thanh toán |
| `completed_at` | timestamp | Ngày hoàn thành |
| `cancelled_at` | timestamp | Ngày hủy |
| `updated_at` | timestamp | Ngày cập nhật |

### `order_items`
Chi tiết các mặt hàng trong đơn hàng.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `order_id` | uuid | Foreign Key → orders |
| `product_id` | uuid | Foreign Key → products |
| `product_name` | varchar | Tên sản phẩm |
| `unit_price` | numeric(12,2) | Giá đơn vị |
| `quantity` | int | Số lượng |
| `subtotal` | numeric(12,2) | Tổng cộng (trước chiết khấu) |
| `discount_amount` | numeric(12,2) | Tiền chiết khấu |
| `total_amount` | numeric(12,2) | Tổng cộng (sau chiết khấu) |
| `status` | varchar | NORMAL, CANCELLED, REFUNDED |
| `note` | text | Ghi chú |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

---

## 8️⃣ Thanh Toán

### `payments`
Một đơn có thể thanh toán bằng nhiều phương thức.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `order_id` | uuid | Foreign Key → orders |
| `method` | varchar | CASH, CARD, WALLET, BANK_TRANSFER, QR |
| `amount` | numeric(12,2) | Số tiền thanh toán |
| `status` | varchar | PENDING, SUCCESS, FAILED, REFUNDED |
| `transaction_code` | varchar | Mã giao dịch (nullable) |
| `paid_by_customer_id` | uuid | ID khách hàng thanh toán (nullable) |
| `created_by` | uuid | Foreign Key → users |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

**Ví dụ:** Đơn 50k, trả 30k ví + 20k tiền mặt vẫn xử lý được.

---

## 9️⃣ Hủy Đơn / Hoàn Tiền

### `refunds`
Thông tin hoàn tiền cho đơn hàng.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `order_id` | uuid | Foreign Key → orders |
| `refund_code` | varchar | Mã hoàn tiền |
| `refund_amount` | numeric(12,2) | Số tiền hoàn |
| `reason` | text | Lý do hoàn |
| `status` | varchar | PENDING, APPROVED, REJECTED, COMPLETED |
| `created_by` | uuid | Foreign Key → users |
| `approved_by` | uuid | Người phê duyệt (nullable) |
| `created_at` | timestamp | Ngày tạo |
| `approved_at` | timestamp | Ngày phê duyệt |
| `completed_at` | timestamp | Ngày hoàn thành |

### `refund_items`
Chi tiết các mặt hàng được hoàn.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `refund_id` | uuid | Foreign Key → refunds |
| `order_item_id` | uuid | Foreign Key → order_items |
| `quantity` | int | Số lượng hoàn |
| `amount` | numeric(12,2) | Số tiền hoàn |
| `created_at` | timestamp | Ngày tạo |

---

## 🔟 Ca Làm Việc / Chốt Ca

### `shifts`
Thông tin ca làm việc của nhân viên bán hàng.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `branch_id` | uuid | Foreign Key → branches |
| `pos_device_id` | uuid | Foreign Key → pos_devices |
| `cashier_id` | uuid | Foreign Key → users |
| `opening_cash` | numeric(12,2) | Tiền mặt mở ca |
| `closing_cash` | numeric(12,2) | Tiền mặt đóng ca |
| `expected_cash` | numeric(12,2) | Tiền mặt dự kiến |
| `difference_cash` | numeric(12,2) | Chênh lệch tiền mặt |
| `status` | varchar | OPEN, CLOSED |
| `opened_at` | timestamp | Thời gian mở ca |
| `closed_at` | timestamp | Thời gian đóng ca |
| `note` | text | Ghi chú |

### `cash_movements`
Thu/chi tiền mặt ngoài đơn hàng.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `shift_id` | uuid | Foreign Key → shifts |
| `type` | varchar | CASH_IN, CASH_OUT |
| `amount` | numeric(12,2) | Số tiền |
| `reason` | text | Lý do |
| `created_by` | uuid | Foreign Key → users |
| `created_at` | timestamp | Ngày tạo |

---

## 1️⃣1️⃣ Bếp / Xử Lý Món

### `kitchen_tickets`
Phiếu bếp cho màn hình bếp (nếu có).

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `order_id` | uuid | Foreign Key → orders |
| `branch_id` | uuid | Foreign Key → branches |
| `status` | varchar | WAITING, PREPARING, READY, DELIVERED, CANCELLED |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

### `kitchen_ticket_items`
Chi tiết mặt hàng trong phiếu bếp.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `kitchen_ticket_id` | uuid | Foreign Key → kitchen_tickets |
| `order_item_id` | uuid | Foreign Key → order_items |
| `product_name` | varchar | Tên sản phẩm |
| `quantity` | int | Số lượng |
| `status` | varchar | WAITING, DONE, CANCELLED |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |

---

## 1️⃣2️⃣ Đồng Bộ Offline / Local POS

### `sync_logs`
Nếu POS chạy local rồi sync cloud.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | uuid | Primary Key |
| `device_id` | uuid | Foreign Key → pos_devices |
| `entity_name` | varchar | orders, payments, products |
| `entity_id` | uuid | ID của entity |
| `action` | varchar | CREATE, UPDATE, DELETE |
| `sync_status` | varchar | PENDING, SYNCED, FAILED |
| `error_message` | text | Thông báo lỗi |
| `created_at` | timestamp | Ngày tạo |
| `synced_at` | timestamp | Ngày đồng bộ |

---

## 📌 Cột Bắt Buộc Nên Thêm Vào Hầu Hết Bảng

```
sync_version int default 1          -- Phiên bản đồng bộ
is_deleted boolean default false    -- Cờ xóa mềm
created_at timestamp                -- Ngày tạo
updated_at timestamp                -- Ngày cập nhật
```

---

## 🔗 Quan Hệ Chính

```
branches (1) ─────────── (n) pos_devices
branches (1) ─────────── (n) orders
branches (1) ─────────── (n) stock_levels
branches (1) ─────────── (n) shifts

users (1) ───────────── (n) orders
users (1) ───────────── (n) wallet_transactions
users (1) ───────────── (n) stock_transactions
users (1) ───────────── (n) refunds
users (1) ───────────── (n) shifts
users (1) ───────────── (n) payments

customers (1) ────────── (n) orders
customers (1) ────────── (n) cards
customers (1) ────────── (n) wallets
customers (1) ────────── (1) student_profiles

orders (1) ────────────── (n) order_items
orders (1) ────────────── (n) payments
orders (1) ────────────── (n) refunds
orders (1) ────────────── (n) kitchen_tickets

products (1) ─────────── (n) order_items
products (1) ─────────── (n) product_recipes
products (1) ─────────── (n) product_prices

categories (1) ────────── (n) products

wallets (1) ────────────── (n) wallet_transactions

inventory_items (1) ────── (n) stock_levels
inventory_items (1) ────── (n) stock_transactions
inventory_items (1) ────── (n) product_recipes

refunds (1) ──────────── (n) refund_items

shifts (1) ────────────── (n) cash_movements

kitchen_tickets (1) ────── (n) kitchen_ticket_items
```

---

## 🎯 Thiết Kế MVP (Tối Thiểu)

Nếu muốn làm MVP nhanh, chỉ cần các bảng này trước:

✅ **Bắt buộc:**
- `users` - Quản lý nhân viên
- `branches` - Chi nhánh
- `pos_devices` - Thiết bị POS
- `customers` - Khách hàng / học sinh
- `cards` - Thẻ học sinh
- `wallets` - Ví nội bộ
- `wallet_transactions` - Lịch sử giao dịch ví
- `categories` - Danh mục sản phẩm
- `products` - Sản phẩm / món ăn
- `orders` - Đơn hàng
- `order_items` - Chi tiết đơn hàng
- `payments` - Thanh toán
- `refunds` - Hoàn tiền
- `shifts` - Ca làm việc

⏳ **Làm sau:**
- `inventory_items` - Nguyên liệu
- `stock_levels` - Tồn kho
- `stock_transactions` - Lịch sử kho
- `product_recipes` - Công thức
- `kitchen_tickets` - Phiếu bếp
- `student_profiles` - Hồ sơ học sinh
- `product_prices` - Lịch sử giá

---

## 📊 Gợi Ý Status Chuẩn Cho Orders

```javascript
enum OrderStatus {
  DRAFT = 'DRAFT',                    // Đang soạn thảo
  PENDING_PAYMENT = 'PENDING_PAYMENT', // Chờ thanh toán
  PAID = 'PAID',                      // Đã thanh toán
  PREPARING = 'PREPARING',            // Đang chuẩn bị
  READY = 'READY',                    // Sẵn sàng phục vụ
  COMPLETED = 'COMPLETED',            // Hoàn thành
  CANCELLED = 'CANCELLED',            // Đã hủy
  REFUNDED = 'REFUNDED',              // Đã hoàn tiền
}
```

---

## 🔄 Flow Chính - Canteen Trường Học

Luồng xử lý tiêu biểu cho hệ thống canteen:

```
1. Quẹt thẻ học sinh
   └─> Tự động tìm customer từ card_uid

2. Chọn món ăn
   └─> Thêm vào order_items

3. Tạo order
   └─> Trạng thái: DRAFT
   └─> Tính subtotal, discount, total_amount

4. Thanh toán (ví/tiền mặt)
   └─> Tạo payment record
   └─> Cập nhật wallet (nếu thanh toán ví)
   └─> Trạng thái: PAID
   └─> Cập nhật paid_amount, change_amount

5. In bill
   └─> In từ order data

6. Gửi bếp (nếu cần)
   └─> Tạo kitchen_tickets
   └─> Trạng thái: WAITING

7. Bếp chuẩn bị
   └─> Cập nhật kitchen_tickets → PREPARING
   └─> Cập nhật kitchen_ticket_items → DONE
   └─> Cập nhật kitchen_tickets → READY

8. Giao món & hoàn thành
   └─> Trạng thái order: COMPLETED
   └─> Ghi nhận trong shift
```

---

## ✨ Ưu Điểm Thiết Kế Này

✅ **Đủ chắc chắn** cho hệ thống POS thực tế
✅ **Dễ mở rộng** sang nhiều quầy, nhiều trường
✅ **Hỗ trợ hoàn tiền** và điều chỉnh chi tiết
✅ **Quản lý tồn kho** khoa học
✅ **Báo cáo doanh thu** dễ dàng
✅ **Đồng bộ offline** nếu cần
✅ **Lịch sử giao dịch** đầy đủ
✅ **Ca làm việc** rõ ràng

---

## 🚀 Bước Tiếp Theo

1. **Tạo migration** cho các bảng MVP
2. **Seed data** cho test
3. **API endpoints** cho core features
4. **Frontend** cho UI POS
5. **Integration** thanh toán & ví điện tử
6. **Report** doanh thu & tồn kho

