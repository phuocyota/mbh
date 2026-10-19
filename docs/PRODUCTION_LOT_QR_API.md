# Lô nhập, mẻ chế biến và QR từng thành phẩm

## Quy ước

- Mỗi nguyên liệu/nhiên liệu cần `productType=INGREDIENT|FUEL`, `baseUnitId` và `lotTrackingEnabled=true`. Dùng luồng `POST /stock-lots/opening` hiện có nếu có tồn đầu; không bật theo dõi lô trực tiếp khi còn tồn chưa phân lô.
- Phiếu nhập hiện có nhận `lotCode`, `manufacturedAt`, `expiresAt` trên từng dòng sản phẩm. Một mã lô trong cùng kho/sản phẩm phải giữ nguyên ngày sản xuất/hạn dùng. Nguyên liệu bắt buộc có hạn dùng, nhiên liệu có thể không có.
- Thành phẩm: `productType=FINISHED_GOOD`. Mỗi đơn vị/phần có một UUID và QR riêng, cùng liên kết về mẻ chế biến. Số lượng thực tế là số nguyên 0–10000; số lượng 0 không sinh tem.
- Không tự suy ra nguồn gốc từ công thức: chỉ lô thực dùng đã được ghi nhận bằng stock movement mới được trả về làm đầu vào thực tế.

## Nhập nguyên liệu/nhiên liệu theo lô

`POST /stock-vouchers/material-imports` — Bearer token, ADMIN/MANAGER. Chi nhánh mặc định lấy JWT; người dùng không phải ADMIN không thể chọn chi nhánh khác.

```json
{
  "requestId": "37e62acf-18fd-4f2c-ab4c-f1d68bc504f9",
  "supplierId": "07b4b0cf-8964-4cd6-81cf-7f4aa693ba9e",
  "paymentStatus": "DEBT",
  "note": "Nhập nguyên liệu ca sáng",
  "items": [
    {
      "productId": "c82b57c4-4d9e-4c8a-85eb-fef828bd0529",
      "lotCode": "NL-20261019-01",
      "quantity": 10,
      "unitPrice": 25000,
      "manufacturedAt": "2026-10-19",
      "expiresAt": "2026-10-25"
    }
  ]
}
```

- `requestId` bắt buộc; gửi lại cùng ID và nội dung trả kết quả cũ, không cộng tồn lần nữa. Cùng ID nhưng đổi nội dung trả `IDEMPOTENCY_PAYLOAD_CONFLICT`.
- Lý do mặc định là `NHNNL` — **Nhập nguyên, nhiên liệu**. Migration `1764500000000-SeedMaterialImportReason.ts` thêm cấu hình đã thanh toán/công nợ. Công nợ (`isDebt=true`) dùng `{152:-,331:+}`: Nợ 152 – Nguyên vật liệu, Có 331 – Phải trả nhà cung cấp. Cấu hình đã thanh toán giữ công thức từ `NHNCC` đang hoạt động. Cần chạy migration trước khi dùng lý do mới; thiếu công thức nguồn đã thanh toán thì migration báo lỗi.
- `supplierId`, `paymentStatus` (PAID/UNPAID/DEBT), `productId`, `lotCode`, `quantity > 0` và `unitPrice >= 0` bắt buộc. PAID tạo thanh toán theo cấu hình kế toán hiện có; UNPAID/DEBT ghi công nợ NCC.
- Chỉ nhận INGREDIENT/FUEL có `baseUnitId` và `lotTrackingEnabled=true`. Không tự bật theo dõi lô trên sản phẩm đã có tồn chưa phân lô.
- `unitId` tùy chọn; nếu có thì quantity/unitPrice theo đơn vị nhập, backend quy đổi về đơn vị cơ sở. Ngày theo YYYY-MM-DD; nguyên liệu bắt buộc có hạn dùng; không nhận lô đã hết hạn.
- Tối đa 500 dòng; được nhập cùng sản phẩm ở các mã lô khác nhau, không lặp cùng productId + lotCode trong một yêu cầu.
- Response theo cấu trúc danh sách chi tiết phiếu nhập hiện có, mỗi dòng bổ sung `lot` gồm `id`, `lotCode`, `stockId`, `productId`, `manufacturedAt`, `expiresAt`, `quantity`, `status`. Dùng `lot.id` làm `inputLots[].lotId` khi bắt đầu chế biến. `lot.quantity` là tổng tồn hiện tại của lô theo đơn vị cơ sở; lượng nhập của phiếu nằm ở `detail.quantity`.
- Tạo phiếu, cộng tồn/lô, movement và thanh toán/công nợ trong cùng transaction. Phần nhập lô dùng schema hiện có; lý do `NHNNL` cần migration seed nêu trên.

## Màn quản lý lô hàng hóa

FE có màn `/stock-lots`, truy cập từ **Hàng hóa → Lô hàng** hoặc tab **Lô hàng** trong phần kho. Màn hình dùng `GET /stock-lots`, phân trang phía server và lọc theo `search` (số lô, mã/tên hàng), `productType`, `status`. Danh sách trả thêm `product`, `stock`, `baseUnit`, tối đa 100 dòng/trang. Quyền ADMIN/MANAGER/KITCHEN; dữ liệu theo chi nhánh được kiểm tra bằng JWT như API hiện có.

Trạng thái lọc: `AVAILABLE` (chưa hết hạn và còn tồn), `EXPIRING` (hết hạn trong 7 ngày kể cả hôm nay, còn tồn), `EXPIRED` (đã hết hạn và còn tồn), `DEPLETED` (đã hết hàng). Lô hết hạn hôm nay còn sử dụng được hết ngày UTC+7. Lô hết tồn hiển thị **Đã hết hàng** dù đã qua hạn; không cộng tổng số lượng giữa các đơn vị khác nhau.

Chi tiết lô gọi `GET /production-trace/lots/:id`, có kiểm tra chi nhánh trước khi trả nguồn nhập/NCC và lịch sử xuất nhập. Nút **Nhập kho** dẫn về luồng tạo phiếu hiện có; lô được tạo từ nghiệp vụ nhập kho/theo dõi lô. Màn này không sửa trực tiếp tồn hoặc metadata lô. Không cần migration mới cho màn quản lý.

## Các checkbox hàng hóa

**Hàng tươi sống** (`isFreshFood`), **Cho phép bán** (`isCanteenItem`) và **Bán trú** (`isBoarding`) độc lập; được phép bỏ chọn cả ba. `isBoarding` được lưu riêng thay vì suy ra từ `!isCanteenItem`. Migration `1764700000000-AddProductBoardingFlag.ts` bổ sung cột và giữ trạng thái Bán trú hiển thị của hàng cũ theo quy ước trước đây. Cần chạy migration trước khi triển khai backend mới.

## Hàng tươi sống

Danh mục hàng hóa có dấu chọn **Hàng tươi sống (HSD mặc định 7 ngày)** khi tạo/sửa, lưu qua `isFreshFood` (`products.is_fresh_food`, mặc định false). Cần chạy migration `1764600000000-AddProductFreshFood.ts` trước khi triển khai backend mới. Không tự thay đổi cờ theo dõi lô hay hạn dùng của các lô cũ khi bật/tắt dấu chọn này.

Phiếu nhập gửi `purchasedAt` dạng YYYY-MM-DD, lấy từ ô **Ngày mua / nhập kho**. Nếu không gửi, backend dùng ngày hiện tại UTC+7. Với hàng tươi sống, FE mặc định `expiresAt = purchasedAt + 7 ngày`; đổi ngày mua cập nhật các hạn dùng chưa sửa tay. Người dùng có thể nhập hạn dùng thực tế khác; backend giữ ngày được gửi và chỉ điền mặc định khi thiếu. Ngày sản xuất mặc định là ngày hiện tại khi chọn sản phẩm trên FE, có thể sửa theo thông tin thực tế. Ngày mua được lưu tại `detail.inputDetails.purchasedAt`.

Ví dụ: mua ngày 19/10/2026 → hạn dùng mặc định 26/10/2026. Cơ chế này áp dụng cả `POST /stock-vouchers` và `POST /stock-vouchers/material-imports`.

## Nhập số lô và serial trên FE

Màn hình `/stock-in/create` có lựa chọn **Nhập nguyên, nhiên liệu** bên cạnh **Nhập hàng từ nhà cung cấp**, gửi `reasonCode=NHNNL` đến `POST /stock-vouchers`. Backend tự áp dụng kiểm tra `MATERIAL_IMPORT` cho lý do này (chỉ INGREDIENT/FUEL, bật theo dõi lô, có đơn vị cơ sở, mã lô và hạn dùng hợp lệ). Chi tiết phiếu hiển thị loại phiếu theo lý do đã lưu.

Màn hình `/stock-in/create` tự sinh số lô dạng `LO-<UUID>` khi chọn sản phẩm (cả tìm kiếm nhanh và thêm dòng). Số lô chỉ đọc, được giữ trong dòng hàng khi thay đổi số lượng hoặc thử lưu lại; ngày sản xuất mặc định hôm nay và có thể sửa; hạn sử dụng do người dùng nhập hoặc mặc định theo quy tắc hàng tươi sống. FE gửi các trường này đến `POST /stock-vouchers` hiện có. Sản phẩm bật theo dõi lô bắt buộc số lô; nguyên liệu bật theo dõi lô bắt buộc hạn dùng. Thông tin lô và serial hiển thị lại trong chi tiết phiếu nhập.

Mỗi dòng nhận `serialMode`:

- `NONE` (mặc định): không dùng serial.
- `MANUAL`: gửi `serials: ["SN-001", "SN-002"]`, mỗi đơn vị một serial; FE cho nhập mỗi dòng một serial.
- `AUTO`: không gửi `serials`; backend sinh UUID cho từng đơn vị khi lưu phiếu.

Hàng có serial cần nhập theo đơn vị cơ sở, số lượng nguyên 1–10000. Serial được trim, phân biệt hoa/thường, tối đa 128 ký tự; không trùng trong dòng hoặc với các phiếu nhập trước của cùng sản phẩm/chi nhánh. Kiểm tra trùng nằm trong transaction có khóa chi nhánh, trước khi ghi tồn và kế toán. `serialMode` và `serials` lưu ở `detail.inputDetails`, không cần migration. FE giữ cùng `requestId` khi thử lại nội dung phiếu để tránh cộng tồn/sinh serial lần nữa.

Serial nhập kho là thông tin định danh trên phiếu nhập; luồng này chưa quản lý xuất/chuyển kho theo từng serial và chưa in QR serial hàng nhập. Serial/QR thành phẩm sau chế biến tiếp tục dùng API `production-trace` bên dưới.

## Bắt đầu mẻ

`POST /kitchen/batches/:id/start`

```json
{
  "expectedVersion": 1,
  "inputLots": [
    { "lotId": "UUID_LO_NGUYEN_LIEU", "quantity": 2500 },
    { "lotId": "UUID_LO_NHIEN_LIEU", "quantity": 0.5 }
  ]
}
```

Số lượng theo đơn vị cơ sở của sản phẩm (vd g, ml). Bắt buộc đầu vào đối với FINISHED_GOOD; tối đa 500 lô. Backend kiểm tra kho thuộc chi nhánh, loại sản phẩm, hạn dùng và đủ tồn; khóa sản phẩm và trừ tồn theo lô trong cùng transaction với chuyển mẻ sang PREPARING. `StockMovement.referenceId` là batch ID. Version và trạng thái ngăn gửi lại bị trừ kho lần nữa.

Không kết hợp xuất tiêu hao theo session và theo mẻ cho cùng chi nhánh/ngày/bữa/trạm. Backend chặn cả hai chiều bằng `SCOPE_ALREADY_CONSUMED_BY_SESSION` hoặc `SCOPE_ALREADY_CONSUMED_BY_BATCH` để tránh trừ kho hai lần. Session ở scope khác vẫn dùng được.

## Sẵn sàng và hoàn tất

Giữ API `/kitchen/batches/:id/ready` và `/complete` hiện có. Hạn dùng chốt ở READY: `readyAt + recommendedUseMinutes`. Khi complete, gửi `actualQuantity` nguyên và `expectedVersion`; yêu cầu lưu mẫu hiện có vẫn áp dụng. Backend tự tạo các bản ghi `finished_units` trong cùng transaction. Chặn hoàn tất nếu đã hết hạn/thiếu hạn dùng; chặn sửa số lượng sau khi hoàn tất. Không gia hạn lúc in lại.

Mẻ cũ không có liên kết lô không được tự gán nguồn gốc: API trả `traceabilityComplete=false`. Không tự sinh lại tem cho các mẻ đã hoàn tất trước migration.

## API truy xuất và in tem

Tất cả API dưới đây yêu cầu Bearer token, role ADMIN/MANAGER/KITCHEN/CASHIER và kiểm tra chi nhánh từ JWT. ADMIN có thể xem chi nhánh của bản ghi.

- `GET /production-trace/lots/:lotId`: trạng thái và nguồn gốc lô nhập từ API tổng hợp hiện có.
- `GET /production-trace/batches/:batchId`: trạng thái, thời gian chế biến, hạn dùng, từng lô thực dùng/số lượng và nguồn nhập/NCC.
- `GET /production-trace/batches/:batchId/labels?page=1&size=100`: tem từng đơn vị, tối đa 100/trang; có `qrSvg`, `qrPayload`, `unitId`, `serial`, tên món, mẻ, thời điểm hoàn tất và hạn dùng. In lại trả cùng định danh.
- `GET /production-trace/units/:unitId`: quét đơn vị thành phẩm → mẻ → các lô thực dùng → nguồn nhập/NCC.

Trạng thái truy xuất trả đúng chuỗi `IN STOCK`, `MAKE`, `READY`, `EXPIRED`:

| Đối tượng | Điều kiện | Trạng thái |
| --- | --- | --- |
| Lô nhập | Chưa hết hạn | IN STOCK |
| Mẻ | WAITING | IN STOCK |
| Mẻ | PREPARING | MAKE |
| Mẻ/thành phẩm | READY hoặc COMPLETED | READY |
| Lô/mẻ/thành phẩm | Hết hạn | EXPIRED |

Lô ngày hết hạn còn dùng được hết ngày địa phương UTC+7; thành phẩm hết hạn đúng timestamp. Trạng thái tính tại lúc gọi API, không ghi cứng vào QR. Tồn còn lại vẫn trả riêng, IN STOCK không bảo đảm quantity > 0.

## Nội dung QR và tích hợp FE

Mặc định QR chứa `MBH:UNIT:<uuid>`. FE/scanner đọc UUID và gọi API unit có xác thực. Để QR mở trang web bằng camera điện thoại, cấu hình `TRACE_QR_BASE_URL=https://your-frontend/trace?unitId=`; backend nối UUID vào cuối URL và tạo SVG. Cần trang FE `/trace` xử lý đăng nhập và gọi API. Không cấu hình URL vào API có Bearer rồi kỳ vọng camera điện thoại tự đăng nhập.

Thay đổi này triển khai backend và SVG cho in tem; chưa bổ sung màn hình FE in/quét công khai. API bảo vệ dữ liệu NCC, không tự mở truy xuất cho khách chưa đăng nhập.

## Triển khai

Có migration `1764400000000-CreateFinishedUnits.ts` cho thành phẩm và `1764500000000-SeedMaterialImportReason.ts` cho lý do nhập nguyên, nhiên liệu. Chạy migration bằng quy trình triển khai hiện có trước khi dùng luồng mới. Cập nhật client gửi `inputLots` khi start FINISHED_GOOD. Chưa chạy migration hay thay đổi dữ liệu production trong lần sửa mã này.
