# FE Mock Data API Coverage

Nguồn đối chiếu: `FE_Kido_MBH/MOCK_DATA_CHECKLIST.md`

Mục tiêu file này là gom các phần mock/hard-code ở FE theo mức độ backend `mbh` hiện đáp ứng, để FE ưu tiên thay dữ liệu mẫu bằng API thật.

## 1. API đáp ứng tốt, có thể tích hợp trước

### 1.1 Payroll / bảng lương

FE mock liên quan:

- `src/datas/payrollData.js`
- `src/pages/Employee/Paysheet.jsx`

API BE:

```http
GET /payrolls
GET /payrolls?status=DRAFT
GET /payrolls/:id
POST /payrolls
PUT /payrolls/:id
DELETE /payrolls/:id
```

Field chính đã có:

- `code`
- `name`
- `cycle`
- `periodStart`
- `periodEnd`
- `totalSalary`
- `paid`
- `remaining`
- `status`
- `note`

Ghi chú:

- BE tự sinh mã dạng `BL000001`.
- Đủ thay mock danh sách bảng lương cơ bản.
- Chưa bao gồm chi tiết dòng lương từng nhân viên trong một bảng lương.

### 1.2 Suppliers / nhà cung cấp

FE mock liên quan:

- `src/datas/suppliersData.js`
- `src/pages/Suppliers/Suppliers.jsx`

API BE:

```http
GET /suppliers
GET /suppliers?status=active
GET /suppliers?status=all
GET /suppliers?search=abc
GET /suppliers/:id
POST /suppliers
PUT /suppliers/:id
DELETE /suppliers/:id
```

Field chính đã có:

- `code`
- `name`
- `phone`
- `email`
- `taxCode`
- `companyName`
- `address`
- `province`
- `district`
- `ward`
- `idCard`
- `group`
- `note`
- `debt`
- `totalPurchase`
- `status`

Ghi chú:

- BE tự sinh mã dạng `NCC000001`.
- Đủ thay mock danh sách nhà cung cấp.

### 1.3 Product categories / nhóm hàng

FE mock liên quan:

- `src/components/Products/SidebarFilter.jsx`
- `src/components/PriceBook/SidebarPrice.jsx` phần nhóm hàng

API BE:

```http
GET /categories
GET /categories/:id
POST /categories
PUT /categories/:id
DELETE /categories/:id

GET /products/categories
GET /products/full
```

Field chính đã có:

- `id`
- `name`
- `sortOrder`
- `status`
- `products` khi dùng `/products/full`

Ghi chú:

- Đủ thay nhóm hàng hard-code như `BIA & THUỐC LÁ`, `CLASSIC COCKTAILS`, `MÓN KHAI VỊ`, `SÚP`, `TEA`.

### 1.4 Products / danh sách sản phẩm

FE liên quan:

- Các màn sản phẩm cần filter theo nhóm hàng hoặc giá.

API BE:

```http
GET /products
GET /products?categoryId=<categoryId>
GET /products?minPrice=10000&maxPrice=50000
GET /products/:id
POST /products
PUT /products/:id
PUT /products/bulk/update
DELETE /products/:id
```

Field chính đã có:

- `categoryId`
- `sku`
- `name`
- `description`
- `imageUrl`
- `price`
- `costPrice`
- `unit`
- `isActive`

Ghi chú:

- Đủ cho danh sách sản phẩm và filter cơ bản.
- Có `costPrice`, có thể làm nền cho báo cáo lợi nhuận nhưng hiện chưa có API profit report riêng.

### 1.5 Branches / chi nhánh

FE hard-code liên quan:

- `src/pages/reports/ReportProduct.jsx`
- `src/components/reports/reportEndDay/ReportContent.jsx`
- `src/components/Employee/EmployeeDetail.jsx` nếu chỉ cần danh sách branch để chọn/hiển thị ngoài employee entity

API BE:

```http
GET /branches
GET /branches/:id
POST /branches
PUT /branches/:id
DELETE /branches/:id
```

Field chính đã có:

- `id`
- `name`
- `address`
- `status`

Ghi chú:

- Đủ thay hard-code `Chi nhánh trung tâm` ở các filter/report.
- Riêng employee hiện chưa có `branchId`, nên chưa đủ cho branch làm việc/trả lương của từng nhân viên.

### 1.6 Current user account / thông tin tài khoản hiện tại

FE hard-code liên quan:

- `src/pages/Account.jsx`

API BE:

```http
GET /users/me
PUT /users/me
```

Field chính đã có ở response `GET /users/me`:

- `userId`
- `email`
- `fullName`
- `phone`
- `role`
- `address`
- `province`
- `district`
- `birthday`
- `note`
- `avatar`
- `branchId`
- `branchName`

Ghi chú:

- Có thể thay hard-code tên, số điện thoại, role, branch.
- Cần test với tài khoản admin/staff vì service hiện merge thêm customer info.

### 1.7 Employees / nhân viên cơ bản

FE liên quan:

- `src/components/Employee/AddEmployeeModal.jsx`
- `src/components/Employee/EmployeeDetail.jsx`
- Các màn danh sách nhân viên

API BE:

```http
GET /employees
GET /employees?status=working
GET /employees?status=quit
GET /employees/:id
POST /employees
PUT /employees/:id
DELETE /employees/:id
```

Field chính đã có:

- `code`
- `timekeepingCode`
- `fullName`
- `phone`
- `cccd`
- `debt`
- `note`
- `status`

Ghi chú:

- Đủ cho CRUD nhân viên cơ bản.
- Chưa có salary/default salary.
- Chưa có branch làm việc/trả lương.

### 1.8 Work schedules / lịch làm việc, bảng chấm công theo lịch

FE liên quan:

- `src/components/Home/StaffAndCancelReport.jsx` một phần
- Các màn lịch làm việc/bảng công nếu có

API BE:

```http
GET /work-schedules/timesheet?from=2026-05-25&to=2026-05-31
GET /work-schedules/timesheet?from=2026-05-25&to=2026-05-31&employeeId=<employeeId>
GET /work-schedules/monthly?year=2026&month=6
GET /work-schedules/monthly?year=2026&month=6&employeeId=<employeeId>
GET /work-schedules/:id
POST /work-schedules
PUT /work-schedules/:id
DELETE /work-schedules/:id
```

Field chính đã có:

- `employeeId`
- `employeeName`
- `employeeCode`
- `workDate`
- `shift`
- `note`

Ghi chú:

- Đủ thay dữ liệu lịch làm việc dự kiến.
- Chưa đủ cho chấm công thực tế như vắng, đi muộn, về sớm.

### 1.9 Inventory snapshot / tồn kho hiện tại

FE liên quan:

- `src/components/reports/reportProduct/ProductInventoryReport.jsx` một phần
- Các màn cần tồn kho hiện tại

API BE:

```http
GET /inventory-items
GET /stock-levels
GET /reports/stock
GET /reports/stock?branchId=<branchId>
GET /reports/inventory
GET /reports/inventory?branchId=<branchId>
```

Field chính của `/reports/inventory`:

- `inventoryItemId`
- `name`
- `unit`
- `quantity`
- `branchId`
- `updatedAt`

Ghi chú:

- Đủ hiển thị tồn kho cơ bản.
- Chưa đủ nếu FE cần báo cáo nhập/xuất/tồn đầu kỳ/cuối kỳ, giá trị tồn, nhóm hàng, định mức.

### 1.10 End-of-day report / báo cáo cuối ngày

FE hard-code liên quan:

- `src/components/reports/reportEndDay/ReportContent.jsx`

API BE:

```http
GET /reports/end-of-day?from=2026-06-01&to=2026-06-01
GET /reports/end-of-day?from=2026-06-01&to=2026-06-01&branchId=<branchId>
```

Field chính đã có:

- `from`
- `to`
- `branchId`
- `data[].date`
- `data[].code`
- `data[].name`
- `data[].price`
- `data[].qty`
- `data[].total`
- `data[].gross`
- `data[].tax`
- `data[].net`

Ghi chú:

- Đủ thay phần data báo cáo cuối ngày theo sản phẩm.
- FE nên lấy `branchId` từ user/branch selector, không hard-code UUID.

### 1.11 Cancellation report / báo cáo hủy món

FE hard-code liên quan:

- `src/components/reports/reportProduct/ProductCancelReport.jsx`
- `src/components/Home/StaffAndCancelReport.jsx` phần hủy

API BE:

```http
GET /reports/cancellations?filter=7days
GET /reports/cancellations?from=2026-06-01&to=2026-06-07
GET /reports/cancellations?filter=7days&branchId=<branchId>
```

Field chính đã có:

- `summary.cancelledItems`
- `summary.cancelledInvoices`
- `stages[].key`
- `stages[].name`
- `stages[].itemCount`
- `stages[].amount`
- `stages[].percentage`
- `stages[].items[]`

Ghi chú:

- Có thể thay placeholder báo cáo xuất hủy/hủy món ở mức khá tốt nếu FE map theo shape hiện tại.

### 1.12 Revenue/report summary cơ bản

FE liên quan:

- `src/components/reports/reportProduct/ProductSaleReport.jsx` một phần
- `src/components/Home/SalesChart.jsx` một phần nếu dùng theo ngày

API BE:

```http
GET /reports/revenue?from=2026-06-01&to=2026-06-07
GET /reports/revenue?from=2026-06-01&to=2026-06-07&branchId=<branchId>
GET /reports/revenue/daily?from=2026-06-01&to=2026-06-07
GET /reports/top-products?from=2026-06-01&to=2026-06-07&limit=10
GET /reports/bottom-products?from=2026-06-01&to=2026-06-07&limit=10
GET /reports/menu-performance?filter=7days&groupBy=category
```

Field chính đã có:

- Tổng doanh thu
- Net revenue
- Refund count/amount
- Payment breakdown
- Doanh thu theo ngày
- Top/bottom products
- Hiệu quả menu theo category/type

Ghi chú:

- Đủ cho dashboard/report doanh thu cơ bản.
- Chưa đủ cho chart theo giờ hoặc full product sale report đúng shape FE nếu FE cần header/KPI riêng.

## 2. API đáp ứng một phần, cần FE map lại hoặc BE bổ sung nhỏ

### 2.1 ProductInventoryReport

FE hard-code liên quan:

- `src/components/reports/reportProduct/ProductInventoryReport.jsx`

API có thể dùng:

```http
GET /reports/inventory?branchId=<branchId>
GET /reports/stock?branchId=<branchId>
```

Đã có:

- Tên hàng
- Đơn vị
- Số lượng tồn hiện tại
- Branch
- Thời gian cập nhật

Thiếu hoặc chưa rõ:

- Mã hàng nếu FE cần
- Nhóm hàng
- Tồn đầu kỳ
- Nhập trong kỳ
- Xuất trong kỳ
- Tồn cuối kỳ theo khoảng ngày
- Giá trị tồn
- Header tổng số mặt hàng/tổng giá trị/tổng nhập xuất

Đề xuất:

- Nếu chỉ cần snapshot tồn kho, FE tích hợp ngay `/reports/inventory`.
- Nếu là báo cáo tồn kho theo kỳ, BE cần endpoint mới như `GET /reports/inventory-period?from=&to=&branchId=`.

### 2.2 ProductSaleReport

FE hard-code liên quan:

- `src/components/reports/reportProduct/ProductSaleReport.jsx`

API có thể dùng:

```http
GET /reports/revenue
GET /reports/revenue/daily
GET /reports/top-products
GET /reports/menu-performance
```

Đã có:

- Tổng doanh thu
- Doanh thu theo ngày
- Top sản phẩm
- Doanh thu/số lượng theo category/type

Thiếu hoặc chưa rõ:

- Endpoint gom sẵn đúng shape màn product sale report.
- Header company/school/branch/date từ BE.
- KPI đúng theo UI nếu FE đang cần các chỉ số riêng.

Đề xuất:

- FE có thể ghép nhiều endpoint trước.
- Nếu muốn đơn giản, BE nên thêm endpoint tổng hợp `GET /reports/product-sales`.

### 2.3 ProductCancelReport

FE hard-code liên quan:

- `src/components/reports/reportProduct/ProductCancelReport.jsx`

API có thể dùng:

```http
GET /reports/cancellations
```

Đã có:

- Tổng món hủy
- Tổng hóa đơn hủy
- Hủy theo stage
- Danh sách sản phẩm hủy theo stage

Thiếu hoặc chưa rõ:

- Nếu FE đang gọi màn này là “xuất hủy” theo kho, API cancellations hiện đang thiên về hủy món/order item, không phải stock waste/export.

Đề xuất:

- Nếu nghiệp vụ là hủy món bán hàng, dùng `/reports/cancellations`.
- Nếu nghiệp vụ là xuất hủy kho, cần report từ `stock_transactions.type = WASTE`.

### 2.4 Monthly order plan

FE liên quan:

- Báo cáo kế hoạch đặt hàng theo tháng nếu FE đang dùng hard-code company/school/revenue.

API BE:

```http
GET /reports/monthly-order-plan?month=2026-06&branchId=<branchId>
GET /reports/monthly-order-plan?from=2026-06-01&to=2026-06-30&branchId=<branchId>
```

Đã có:

- Company name hard-code trong BE
- School/branch name từ row đầu nếu có
- Doanh thu tháng
- Monthly usage
- Plan sales min/max

Thiếu hoặc chưa rõ:

- `stockOnHand` hiện trả `null`.
- `dataAvailable.stockOnHand = false`.
- `usagePerMil` hiện `null`.

Đề xuất:

- FE dùng được phần kế hoạch cơ bản.
- BE cần nối stock level nếu muốn đủ tồn hiện tại và gợi ý đặt hàng chính xác hơn.

### 2.5 Account / user profile cho admin/staff

FE hard-code liên quan:

- `src/pages/Account.jsx`

API có thể dùng:

```http
GET /users/me
PUT /users/me
```

Đã có:

- Thông tin user và branch.

Rủi ro:

- `getMe` đang gọi `customerService.getUserCustomerInfo(userId)`. Với user admin/staff không gắn customer, cần test để chắc không lỗi.

Đề xuất:

- Test bằng token admin/staff.
- Nếu lỗi, tách response profile admin/staff khỏi customer info.

## 3. Chưa đáp ứng hoặc thiếu endpoint nghiệp vụ

### 3.1 Stock take / phiếu kiểm kho

FE mock liên quan:

- `src/datas/stockTakeData.js`
- `src/components/StockTakes/StockTakeModal.jsx`
- `src/components/StockTakes/TableStock.jsx`

BE hiện có:

```http
GET /inventory-items
GET /stock-levels
GET /stock-transactions
GET /reports/stock
GET /reports/inventory
```

Thiếu:

- Entity phiếu kiểm kho.
- Entity dòng kiểm kho.
- API tạo phiếu kiểm kho.
- API cập nhật số lượng đếm thực tế.
- API submit/confirm/cancel phiếu.
- Trường `systemQuantity`, `countedQuantity`, `differenceQuantity`, `differenceValue`.
- Danh sách phiếu kiểm kho cho `TableStock.jsx`.

Đề xuất API:

```http
GET /stock-takes
GET /stock-takes/:id
POST /stock-takes
PUT /stock-takes/:id
POST /stock-takes/:id/items
PUT /stock-takes/:id/items/:itemId
POST /stock-takes/:id/submit
POST /stock-takes/:id/approve
POST /stock-takes/:id/cancel
```

### 3.2 Recent activities dashboard

FE hard-code liên quan:

- `src/components/Home/RecentActivities.jsx`

BE hiện chưa thấy endpoint tương ứng.

Thiếu:

- API hoạt động gần đây dạng gom từ orders/payments/refunds/stock/user actions.
- Payload gồm user/action/amount/time/icon/type nếu FE cần.

Đề xuất API:

```http
GET /dashboard/recent-activities?branchId=<branchId>&limit=10
```

### 3.3 Sales chart theo giờ

FE hard-code/liên quan:

- `src/components/Home/SalesChart.jsx`
- `src/components/reports/reportProduct/ProductSaleChart.jsx`

BE hiện có:

```http
GET /reports/revenue/daily
GET /reports/customer
```

Thiếu:

- Doanh thu theo giờ.
- Số order theo giờ.
- Số khách theo giờ.
- KPI theo ngày/chi nhánh nếu FE cần.

Đề xuất API:

```http
GET /dashboard/sales-hourly?date=2026-06-07&branchId=<branchId>
```

Response nên có:

- `hour`
- `revenue`
- `orders`
- `customers`

### 3.4 Staff dashboard metrics / chấm công thực tế

FE hard-code liên quan:

- `src/components/Home/StaffAndCancelReport.jsx`

BE hiện có:

```http
GET /employees
GET /work-schedules/timesheet
GET /work-schedules/monthly
```

Thiếu:

- Attendance/check-in/check-out thực tế.
- Vắng mặt.
- Đi muộn.
- Về sớm.
- Đơn xin nghỉ/chờ duyệt.
- Tổng giờ làm thực tế.

Đề xuất API:

```http
GET /dashboard/staff-summary?date=2026-06-07&branchId=<branchId>
GET /attendances?from=2026-06-01&to=2026-06-07&employeeId=<employeeId>
GET /leave-requests?status=PENDING
```

### 3.5 Price book / bảng giá

FE hard-code liên quan:

- `src/components/PriceBook/SidebarPrice.jsx`

BE hiện có:

```http
GET /products
PUT /products/bulk/update
GET /categories
```

Thiếu:

- Entity bảng giá.
- Entity dòng bảng giá.
- Nhiều bảng giá.
- Bảng giá mặc định `Bảng giá chung`.
- API active/default price book.

Đề xuất API:

```http
GET /price-books
GET /price-books/default
GET /price-books/:id/items
POST /price-books
PUT /price-books/:id
PUT /price-books/:id/items/bulk
DELETE /price-books/:id
```

### 3.6 Employee salary/default salary

FE hard-code liên quan:

- `src/components/Employee/AddEmployeeModal.jsx`

BE hiện có employee cơ bản nhưng thiếu salary field.

Thiếu:

- `baseSalary`
- `hourlyRate` hoặc `dailyRate`
- Chính sách lương mặc định.

Đề xuất:

- Thêm field salary vào `employees` hoặc tạo payroll setting riêng.
- Nếu default salary là cấu hình hệ thống, thêm endpoint config.

### 3.7 Employee branch làm việc/trả lương

FE hard-code liên quan:

- `src/components/Employee/EmployeeDetail.jsx`

BE hiện có `branches`, nhưng `employees` chưa có branch relation.

Thiếu:

- `branchId`
- `workBranchId` nếu khác branch trả lương
- `payrollBranchId`

Đề xuất:

- Thêm `branchId` vào employee nếu chỉ có một chi nhánh chính.
- Nếu nghiệp vụ phức tạp, tạo bảng employee-branch assignment.

### 3.8 Profit report / báo cáo lợi nhuận

FE hard-code liên quan:

- `src/components/reports/reportProduct/ProductProfitReport.jsx`

BE hiện có:

- `products.costPrice`
- Order/order items để tính doanh thu

Thiếu:

- API báo cáo lợi nhuận.
- Tổng revenue/cost/profit/margin.
- Profit theo sản phẩm/category/ngày.

Đề xuất API:

```http
GET /reports/profit?from=2026-06-01&to=2026-06-07&branchId=<branchId>
GET /reports/profit/products?from=2026-06-01&to=2026-06-07&branchId=<branchId>
```

### 3.9 Dashboard controller chưa expose API

BE hiện có `DashboardService.getCustomerStats`, nhưng `DashboardController` đang trống.

Ảnh hưởng:

- FE không gọi được `/dashboard/...` cho các dashboard-specific endpoints.

Đề xuất:

- Expose các API dashboard cần thiết hoặc dùng thống nhất `/reports/...`.

## 4. Lưu ý route/doc cần rà lại

### 4.1 Route customer report trong doc lệch controller

Trong `FE_HANDOFF.md` có ghi:

```http
GET /api/reports/customers?filter=7days
```

Controller thực tế đang là:

```http
GET /reports/customer
```

Đề xuất:

- Sửa doc thành `/api/reports/customer`, hoặc thêm alias `/reports/customers` trong controller để tránh FE gọi sai.

### 4.2 Một số controller có `ApiBearerAuth` nhưng chưa thấy `UseGuards`

Các controller như suppliers/payrolls/categories/branches/stock-levels/stock-transactions/inventory-items có `ApiBearerAuth`, nhưng không thấy guard ở controller.

Đề xuất:

- Nếu API admin cần bảo vệ JWT, rà lại và thêm `@UseGuards(JwtAuthGuard)`.

## 5. Thứ tự ưu tiên tích hợp FE đề xuất

### Ưu tiên 1: thay mock render trực tiếp

1. `src/datas/payrollData.js` -> `GET /payrolls`
2. `src/datas/suppliersData.js` -> `GET /suppliers`
3. Nhóm hàng hard-code -> `GET /categories` hoặc `GET /products/full`
4. Branch hard-code trong report -> `GET /branches`

### Ưu tiên 2: thay report có API sẵn

1. End-of-day -> `GET /reports/end-of-day`
2. Inventory snapshot -> `GET /reports/inventory`
3. Cancellation -> `GET /reports/cancellations`
4. Revenue summary/daily -> `GET /reports/revenue`, `GET /reports/revenue/daily`

### Ưu tiên 3: cần BE bổ sung trước khi FE bỏ mock hoàn toàn

1. Stock take
2. Recent activities
3. Sales hourly chart
4. Staff attendance metrics
5. Price book
6. Employee salary/branch fields
7. Profit report
