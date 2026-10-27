# API truy xuất nguồn gốc công khai

`GET /stock-trace/full` không yêu cầu Authorization header.

## Định danh duy nhất

Client chỉ truyền `GET /stock-trace/full?lotId=<UUID-hoặc-mã-lô>`, không cần token.

Ví dụ: `GET /stock-trace/full?lotId=LO-78e74975-7024-49d6-87c1-0b112e3e94ff`.

Backend so khớp chính xác UUID hoặc mã lô, dùng một truy vấn `UNION ALL` để dò ID trong:

- `stock_lots`: dò `id` hoặc `lot_code` của lô nguyên/nhiên liệu/lô kho.
- `kitchen_production_batches`: mẻ chế biến.
- `finished_units`: một phần thành phẩm, có serial riêng.
- `kitchen_operations` với `kind='finished-inventory'`: dò `id` hoặc `payload.lotCode` của lô thành phẩm trong bếp, trỏ về mẻ qua `payload.batchId`.

Tự trả đúng loại dữ liệu theo bản ghi tìm được. Client không gửi `batchId`, `unitId`, loại sản phẩm hay chi nhánh.
`lotId` bắt buộc, không được rỗng và tối đa 255 ký tự. Giá trị không hợp lệ trả HTTP 400; không tìm thấy trả HTTP 404 (`TRACE_ID_NOT_FOUND`).
ID khớp nhiều loại trả HTTP 409 (`TRACE_ID_AMBIGUOUS`), không chọn tuỳ tiện một bản ghi.
Các cờ `includeTimeline`, `includeMovements`, `includeConsumption`, `includeRecipe` vẫn là tuỳ chọn, không phải định danh.

## Nguyên/nhiên liệu

Giữ nguyên `lot`, `product`, `location`, `origin`, `movements`, `consumption`, `recipe`, `timeline`.
Bổ sung các trường ở cấp response data:

| Trường | Ý nghĩa |
|---|---|
| `type` | Loại sản phẩm, ví dụ `INGREDIENT`, `FUEL` |
| `receivedAt` | Ngày giờ nhập kho từ phiếu nhập gốc (`origin.receivedAt`) |
| `purchasedAt` | Ngày/giờ mua hàng của đúng lô, nếu có khai báo |
| `imageUrl` | Ảnh minh hoạ sản phẩm, hoặc null |
| `imageSource` | `ILLUSTRATION`, hoặc null |

`receivedAt` khác `purchasedAt`. Không dùng ngày tạo lô hoặc ngày chế biến thay thế khi thiếu chứng từ nhập.

## Thành phẩm chế biến

| Trường | Ý nghĩa |
|---|---|
| `type` | `FINISHED_GOOD` |
| `unit` | `{ id, serial, batchId }` nếu `lotId` thuộc một phần thành phẩm; null nếu theo mẻ/lô |
| `product` | ID, tên, mã, loại, ảnh minh hoạ của món |
| `imageUrl` | Ảnh thực tế `batch.details.imageUrl`; thiếu ảnh thực tế thì lấy `product.imageUrl`; thiếu cả hai trả null |
| `imageSource` | `ACTUAL`, `ILLUSTRATION`, hoặc null; dùng để ghi chú đúng loại ảnh |
| `production` | `{ batchId, status, actualQuantity }` |
| `status` | Trạng thái truy xuất theo quy tắc hiện có (`IN STOCK`, `MAKE`, `READY`, `EXPIRED`) |
| `lifecycle.inStockAt` | Ngày nhập sớm nhất trong các lô đầu vào; xem từng lô trong `inputs` để có ngày chính xác |
| `lifecycle.startedAt` | Make — bắt đầu chế biến |
| `lifecycle.readyAt` | Ready — chế biến xong, sẵn sàng sử dụng |
| `lifecycle.completedAt` | Completed — hoàn tất kiểm tra/ghi nhận mẻ |
| `lifecycle.expiresAt` | Hạn sử dụng đã lưu của phần thành phẩm hoặc mẻ; truy xuất không gia hạn |
| `inputs` | Các lô nguyên/nhiên liệu thực tế đã xuất dùng cho mẻ, trừ phần hoàn trả toàn bộ |
| `timeline` | Ngày nhập từng lô và các mốc `MAKE`, `READY`, `COMPLETED`, `EXPIRED_AT` |

Mỗi phần tử `inputs` có:

- `lotId`, `lotCode`, `product` (ID, tên, loại nguyên/nhiên liệu).
- `receivedAt`, `purchasedAt`: ngày nhập và ngày mua của riêng lô đó.
- `origin`: chứng từ nhập và nhà cung cấp theo contract hiện có.
- `issuedQuantity`, `returnedQuantity`, `consumedQuantity`: số lượng đã xuất, hoàn trả và còn lại sau hoàn trả.
- `usedQuantity`, `wasteQuantity`: số liệu thực tế nếu mẻ đã ghi nhận; nếu chưa có trả null.
- `tracePath`: URL tương đối để truy xuất đầy đủ lô nguyên/nhiên liệu.
- `traceabilityComplete`: false khi thiếu lô/chứng từ nguồn.

Không lấy nguyên liệu từ công thức hiện tại để suy đoán lô thực tế đã chế biến. Thiếu ngày/ảnh/số liệu thì trả null.
`includeTimeline=false` ẩn timeline; thông tin lifecycle và đầu vào vẫn được trả để truy xuất thành phẩm.
Các cờ `includeRecipe`, `includeConsumption`, `includeMovements` giữ nguyên ý nghĩa với truy xuất lô kho; truy xuất mẻ/phần thành phẩm trả lifecycle và đầu vào thực tế, không trả công thức hiện hành.
