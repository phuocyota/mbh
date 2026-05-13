# Common Folder Overview

## Giới thiệu

Folder `common` là một phần **cốt lõi** của ứng dụng, chứa những utility, decorator, guard, filter, interceptor, DTO, enum, interface và database layer được **tái sử dụng trên toàn bộ ứng dụng**. Nó đóng vai trò như một **shared library** giúp đảm bảo tính nhất quán (consistency) và giảm code duplication.

---

## Cấu trúc và Chức năng Chi tiết

### 1. **constant/** - Hằng số ứng dụng

**Chức năng:** Lưu trữ các giá trị hằng số được sử dụng trên toàn ứng dụng.

**Các file:**

- `constant.ts` - Chứa các hằng số chung (ví dụ: `EMPTY_UUID`)
- `error-messages.constant.ts` - Lưu trữ tất cả các thông báo lỗi (error messages)

**Tầm quan trọng:** Giúp quản lý tập trung các thông số configurable và error messages, dễ dàng bảo trì và thay đổi trong tương lai.

---

### 2. **database/** - Lớp trợ giúp database

**Chức năng:** Cung cấp các tiện ích liên quan đến database operations.

**Các file:**

- `transaction.utils.ts` - Hỗ trợ xử lý transaction với database

**Tầm quan trọng:** Đảm bảo tính nhất quán của dữ liệu (data consistency) thông qua quản lý transaction toàn ứng dụng.

---

### 3. **sql/** - Base Entity & Service

**Chức năng:** Cung cấp base class cho entities và services, giúp giảm code duplication.

**Các file:**

- `base.entity.ts` - Lớp cơ sở cho tất cả entities
  - Tự động tạo `id` (UUID)
  - Tự động quản lý `createdAt`, `updatedAt`
  - Theo dõi `createdBy`, `updatedBy` (ai tạo/cập nhật)

- `base.service.ts` - Lớp cơ sở cho tất cả services
  - Các method CRUD cơ bản: `findAll()`, `findById()`, v.v.
  - Hỗ trợ transaction: `runInTransaction()`
  - Xử lý lỗi thống nhất

**Tầm quan trọng:** Là nền tảng cho tất cả entities và services trong ứng dụng. Giảm code duplication lên đến 50% cho các service layer.

---

### 4. **decorator/** - Custom Decorators

**Chức năng:** Cung cấp custom decorators để làm đơn giản hóa code.

**Các file:**

- `public.decorator.ts` - Đánh dấu route là public (không yêu cầu authentication)
- `roles.decorator.ts` - Định nghĩa roles (phân quyền) cho route
- `user.decorator.ts` - Lấy thông tin user từ request

**Tầm quan trọng:** Cung cấp cách khai báo metadata cho controller, giúp code sạch và dễ đọc.

---

### 5. **guard/** - Authentication & Authorization

**Chức năng:** Bảo vệ routes bằng cách xác thực và phân quyền.

**Các file:**

- `auth.guard.ts` - Kiểm tra JWT token, cho phép access public routes
- `roles.guard.ts` - Kiểm tra quyền hạn dựa trên roles

**Tầm quan trọng:**

- Đảm bảo chỉ các request được phép mới được xử lý
- Bảo vệ các sensitive endpoints (endpoint nhạy cảm)
- Duy nhất hóa logic xác thực trên toàn ứng dụng

---

### 6. **dto/** - Data Transfer Objects

**Chức năng:** Định nghĩa cấu trúc dữ liệu cho request/response.

**Các file:**

- `pagination.dto.ts` - DTO cho pagination (page, size, search)
- `base.dto.ts` - DTO base cho các response chung

**Tầm quan trọng:**

- Xác thực dữ liệu input (validation)
- Định nghĩa schema API rõ ràng
- Hỗ trợ Swagger documentation

---

### 7. **enum/** - Enumerations

**Chức năng:** Định nghĩa các giá trị enum được dùng chung.

**Các file:**

- `certificate-level.enum.ts` - Mức độ chứng chỉ
- `certificate-subject.enum.ts` - Môn học chứng chỉ
- `content-type.enum.ts` - Loại nội dung
- `status.enum.ts` - Trạng thái chung
- `user-type.enum.ts` - Loại người dùng

**Tầm quan trọng:** Tập trung quản lý các giá trị enum, giảm hardcoding, dễ bảo trì.

---

### 8. **filter/** - Exception Filters

**Chức năng:** Bắt và xử lý exceptions, trả về response thống nhất.

**Các file:**

- `all-exceptions.filter.ts` - Xử lý tất cả exceptions (HTTP, custom errors, v.v.)

**Tầm quan trọng:** Đảm bảo error response được format thống nhất trên toàn ứng dụng, tốt cho user experience và debugging.

---

### 9. **interceptors/** - Request/Response Interceptors

**Chức năng:** Xử lý request và response trước khi gửi đi.

**Các file:**

- `response-logger.interceptor.ts` - Log response để debug
- `success-response.interceptor.ts` - Format response thành cấu trúc chuẩn

**Tầm quan trọng:**

- Đảm bảo tất cả response có format nhất quán
- Hỗ trợ logging để monitor ứng dụng
- Dễ dàng thêm thông tin metadata (timestamps, etc.)

---

### 10. **middleware/** - HTTP Middleware

**Chức năng:** Xử lý request ở cấp middleware.

**Các file:**

- `authorization.middleware.ts` - Kiểm tra authorization headers
- `request-logger-middleware.ts` - Log tất cả incoming requests

**Tầm quan trọng:**

- Log request để tracking và debugging
- Xử lý pre-processing trước khi request đến controllers
- Thêm metadata vào request object

---

### 11. **interface/** - TypeScript Interfaces

**Chức năng:** Định nghĩa type definitions được dùng chung.

**Các file:**

- `jwt-payload.interface.ts` - Cấu trúc JWT token payload

**Tầm quan trọng:** Cung cấp type safety cho TypeScript, giúp phát hiện lỗi ở compile time.

---

### 12. **utils/** - Utility Functions

**Chức năng:** Cung cấp các hàm helper được dùng chung.

**Các file:**

- `array-diff.utils.ts` - So sánh sự khác biệt giữa 2 arrays
- `auto-map.util.ts` - Tự động mapping object (dạng như AutoMapper)

**Tầm quan trọng:** Chứa các hàm dùng lại được (reusable), giảm code duplication.

---

## Tầm Quan Trọng Của Folder Common

### 1. **Consistency (Tính Nhất Quán)**

- Tất cả modules sử dụng cùng base classes, decorators, guards
- Đảm bảo behavior giống nhau trên toàn ứng dụng
- Response format thống nhất

### 2. **Code Reusability (Tái Sử Dụng Code)**

- BaseEntity và BaseService giảm code duplication lên đến 50%
- Decorators, Guards, Filters/Interceptors được dùng lại
- Utils functions giảm việc viết code trùng lặp

### 3. **Maintainability (Dễ Bảo Trì)**

- Thay đổi logic chung (ví dụ: auth logic) chỉ cần sửa 1 file
- Error messages quản lý tập trung
- Enum values quản lý tập trung

### 4. **Security (Bảo Mật)**

- Auth Guard bảo vệ tất cả endpoints
- Roles Guard kiểm soát quyền hạn
- JWT validation tập trung và bảo mật

### 5. **Type Safety (An Toàn Kiểu)**

- Interfaces và DTOs giúp phát hiện lỗi type ở compile time
- Validation tự động trên DTOs

### 6. **Monitoring & Debugging**

- Logging middleware và interceptor giúp tracking requests/responses
- Exception filter đảm bảo error response format thống nhất
- Dễ dàng debug và monitor ứng dụng

---

## Mô Hình Sử Dụng

```
┌─────────────────────────────────────────────┐
│         Controllers (API Routes)             │
├─────────────────────────────────────────────┤
│  Guards (AuthGuard, RolesGuard)             │
│  Decorators (Roles, User, Public)           │
├─────────────────────────────────────────────┤
│         Services (Business Logic)            │
│  - Extends BaseService                      │
│  - Uses transaction utilities               │
├─────────────────────────────────────────────┤
│         Entities (Data Models)              │
│  - Extends BaseEntity                       │
├─────────────────────────────────────────────┤
│     Common (Shared Layer)                   │
│  ├── Guards, Filters, Interceptors          │
│  ├── DTOs, Enums, Interfaces                │
│  ├── Constants, Utils                       │
│  └── Database Layer (BaseService, Tx Utils) │
└─────────────────────────────────────────────┘
```

---

## Kết Luận

Folder `common` là **trái tim** của ứng dụng NestJS này. Nó:

- ✅ Giảm code duplication
- ✅ Đảm bảo consistency trên toàn ứng dụng
- ✅ Dễ dàng bảo trì và scale
- ✅ Cung cấp security layer tập trung
- ✅ Hỗ trợ monitoring và debugging

Bất kỳ module nào cũng phụ thuộc vào `common`, vì vậy việc thiết kế và bảo trì tốt folder này rất quan trọng cho chất lượng toàn bộ ứng dụng.
