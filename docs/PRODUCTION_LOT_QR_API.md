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

## Quản lý kho ERP: tổng quan và tồn kho

Menu **Hàng hóa → Kho** mở `/warehouse`. Navigation gồm: **Tổng quan**, **Tồn kho**, **Nhập kho**, **Xuất kho**, **Chuyển kho**, **Lô hàng**, **Truy xuất nguồn gốc**. Nút **Xuất bán** vẫn hiển thị và giữ nguyên `/stock-sale`, `/stock-sale/create` cùng luồng xử lý cũ; khi mở, mục Xuất kho được đánh dấu đang hoạt động.

### API mới

Bearer token; ADMIN/MANAGER/KITCHEN. Mọi endpoint dùng `resolveStockBranch`: chi nhánh lấy từ JWT, chỉ ADMIN được yêu cầu chi nhánh khác.

- `GET /warehouse/overview?from=YYYY-MM-DD&to=YYYY-MM-DD`: thống kê hiện tại, số lượng theo đơn vị, giá trị tồn, lô hoạt động/sắp hết hạn/đã hết hạn, mặt hàng dưới định mức, phiếu DRAFT chờ xử lý. Kèm biến động nhập/xuất, giá trị tồn tái dựng theo ngày, tỷ trọng giá trị theo nhóm, nguyên liệu xuất thực tế cho mẻ/phiên tiêu hao bếp, phân bố lô hết hạn trong 7 ngày và 12 lô cần ưu tiên xử lý. Khoảng biểu đồ tối đa 366 ngày, không vượt hôm nay; mặc định 30 ngày.
- `GET /warehouse/stocks`: kho thuộc chi nhánh.
- `GET /warehouse/inventory`: bảng tồn theo sản phẩm × kho; gồm hàng thuộc chi nhánh hoặc đã có bản ghi tồn tại chi nhánh (giữ nguyên ID khi chuyển kho); không tự đưa toàn bộ danh mục dùng chung vào từng kho. Hàng đang hoạt động trong phạm vi này chưa có số dư hiển thị tồn 0; hàng ngừng hoạt động chỉ hiển thị khi còn tồn. Lọc `search`, `stockId`, `productId`, `categoryId`, `productType`, `lotCode`, `expiresFrom`, `expiresTo`, `status=AVAILABLE|LOW|OUT|EXPIRING|EXPIRED`. Phân trang `page`, `size` tối đa 100. Lọc ở PostgreSQL trước khi đếm/phân trang; trang rỗng vẫn trả đúng total.
- `GET /warehouse/inventory/:productId`: thông tin hàng hóa, tồn từng kho, các lô/hạn dùng và lịch sử biến động trong chi nhánh. Lịch sử phân trang qua `page`, `size`; `historyKind=ADJUSTMENT` chỉ trả biến động liên kết phiếu kiểm kê. Các điều chỉnh cũ không có chứng từ nhận diện vẫn nằm trong lịch sử chung ở nhóm Khác; không tự suy đoán loại giao dịch.

Dashboard dùng snapshot transaction REPEATABLE READ để thống kê nhất quán. Không dùng dữ liệu mẫu làm fallback. Biểu đồ lượng nhập/xuất và tiêu thụ chọn từng đơn vị; tổng lượng tồn hiển thị từng đơn vị, không cộng kg với chai. Lô còn tồn hết hạn hôm nay vẫn hợp lệ đến hết ngày UTC+7. Công nợ không được tính là phiếu chờ xử lý; chỉ trạng thái DRAFT.

### Giá trị tồn và giữ chỗ

Giá trị = số dư × `products.cost_price` hiện tại. Hàng thiếu giá vốn được cảnh báo và không góp giá trị; tỷ trọng nhóm chỉ tính phần giá trị dương. Biểu đồ quá khứ tái dựng số dư cuối ngày từ số dư hiện tại trừ biến động sau ngày đó, dùng cùng giá vốn hiện tại; đây là ước tính, chưa phải sổ định giá lịch sử/FIFO. Ngày trước lần ghi biến động đầu tiên không có giá trị tái dựng (null).

Hệ thống hiện chưa có nghiệp vụ giữ chỗ: `reservedQuantity=null`, `reservationsSupported=false`, UI hiển thị **Chưa thiết lập**/dấu —. `availableQuantity` hiện là `max(0, tồn thực tế − tồn lô hết hạn)`, **chưa trừ giữ chỗ**; chú thích và Excel nêu rõ cơ sở này. Chưa thêm giữ chỗ theo đơn hàng hay phiếu xuất nháp.

### Định mức và UX

Migration `1764800000000-AddProductMinimumStock.ts` thêm `products.minimum_stock` nullable numeric(18,4), ràng buộc không âm và index biến động theo kho/thời gian. Form hàng hóa có **Định mức tồn tối thiểu mỗi kho** theo đơn vị cơ sở. Để trống nghĩa là chưa cấu hình, không áp dụng ngưỡng cảnh báo tự đặt. API nhận `minimumStock` hoặc `clearMinimumStock=true` để xóa cấu hình (tương thích client loại bỏ null trong request). Thay đổi định mức không đổi tồn thực tế.

Màn `/warehouse/inventory` có bảng theo kho, lọc thêm theo lô/hạn dùng, chi tiết theo kho/lô/lịch sử/điều chỉnh/truy xuất, và xuất Excel tất cả trang phù hợp bộ lọc. `/warehouse/trace` tra theo mã/tên/UUID lô; chi tiết tái sử dụng API `/production-trace/lots/:id` có kiểm tra chi nhánh. Nguồn nhập/NCC và đầu ra chế biến chỉ hiển thị dữ liệu đã ghi nhận. Màn hình có loading, empty/error/retry, tooltip và bảng cuộn ngang trên tablet. Navigation không bỏ các route nghiệp vụ cũ.

### Kiểm tra và triển khai

Chạy migration trước khi triển khai backend có trường mới; chưa thực thi migration hay deploy production trong lần sửa source này.

- `npm run test -- --runInBand warehouse product-kitchen stock-lot.controller kitchen-metadata`
- `npm run build`
- Kiểm tra SQL trên PostgreSQL tách biệt, không đọc `.env` hoặc kết nối server thật: cài `@electric-sql/pglite` trong `/tmp/mbh-warehouse-pgcheck`, rồi chạy `WAREHOUSE_PGLITE_PATH=/tmp/mbh-warehouse-pgcheck/node_modules/@electric-sql/pglite node scripts/verify-warehouse-postgres.cjs` sau build. Script kiểm tra cách ly chi nhánh, số dư/giá trị, đơn vị, lô hết hạn, phân trang, bộ lọc, tiêu thụ và điều chỉnh.

## Màn quản lý lô hàng hóa

FE có màn `/stock-lots`, truy cập từ **Hàng hóa → Kho → tab Lô hàng**. Màn hình dùng `GET /stock-lots`, phân trang phía server và lọc theo `search` (số lô, mã/tên hàng), `productType`, `status`. Danh sách trả thêm `product`, `stock`, `baseUnit`, tối đa 100 dòng/trang. Quyền ADMIN/MANAGER/KITCHEN; dữ liệu theo chi nhánh được kiểm tra bằng JWT như API hiện có.

Trạng thái lọc: `AVAILABLE` (chưa hết hạn và còn tồn), `EXPIRING` (hết hạn trong 7 ngày kể cả hôm nay, còn tồn), `EXPIRED` (đã hết hạn và còn tồn), `DEPLETED` (đã hết hàng). Lô hết hạn hôm nay còn sử dụng được hết ngày UTC+7. Lô hết tồn hiển thị **Đã hết hàng** dù đã qua hạn; không cộng tổng số lượng giữa các đơn vị khác nhau.

Chi tiết lô gọi `GET /production-trace/lots/:id`, có kiểm tra chi nhánh trước khi trả nguồn nhập/NCC và lịch sử xuất nhập. Nút **Nhập kho** dẫn về luồng tạo phiếu hiện có; lô được tạo từ nghiệp vụ nhập kho/theo dõi lô. Màn này không sửa trực tiếp tồn hoặc metadata lô. Không cần migration mới cho màn quản lý.

## Các checkbox hàng hóa

**Hàng tươi sống** (`isFreshFood`), **Cho phép bán** (`isCanteenItem`) và **Bán trú** (`isBoarding`) độc lập; được phép bỏ chọn cả ba. `isBoarding` được lưu riêng thay vì suy ra từ `!isCanteenItem`. Migration `1764700000000-AddProductBoardingFlag.ts` bổ sung cột và giữ trạng thái Bán trú hiển thị của hàng cũ theo quy ước trước đây. Cần chạy migration trước khi triển khai backend mới.

## Hàng tươi sống

Danh mục hàng hóa có dấu chọn **Hàng tươi sống (HSD mặc định 7 ngày)** khi tạo/sửa, lưu qua `isFreshFood` (`products.is_fresh_food`, mặc định false). Cần chạy migration `1764600000000-AddProductFreshFood.ts` trước khi triển khai backend mới. Không tự thay đổi cờ theo dõi lô hay hạn dùng của các lô cũ khi bật/tắt dấu chọn này.

Phiếu nhập gửi `purchasedAt` dạng YYYY-MM-DD, lấy từ ô **Ngày mua / nhập kho**. Nếu không gửi, backend dùng ngày hiện tại UTC+7. Với hàng tươi sống, FE mặc định `expiresAt = purchasedAt + 7 ngày`; đổi ngày mua cập nhật các hạn dùng chưa sửa tay. Người dùng có thể nhập hạn dùng thực tế khác; backend giữ ngày được gửi và chỉ điền mặc định khi thiếu. Ngày sản xuất mặc định là ngày hiện tại khi chọn sản phẩm trên FE, có thể sửa theo thông tin thực tế. Ngày mua được lưu tại `detail.inputDetails.purchasedAt`.

Ví dụ: mua ngày 19/10/2026 → hạn dùng mặc định 26/10/2026. Cơ chế này áp dụng cả `POST /stock-vouchers` và `POST /stock-vouchers/material-imports`.

## Cấu hình hàng để nhập nguyên, nhiên liệu

Form tạo/sửa hàng hóa có checkbox **Nguyên, nhiên liệu**, liên kết trực tiếp với `productType`: chọn mặc định `INGREDIENT`, có thể chuyển sang `FUEL` ở phần Phân loại kho; bỏ chọn chuyển về `MERCHANDISE`. Checkbox phản ánh lại đúng phân loại khi mở sửa, độc lập với Hàng tươi sống/Cho phép bán/Bán trú; không phụ thuộc mã category.

Trong **Danh mục → Tạo/Sửa hàng hóa → Phân loại kho**, chọn `productType=INGREDIENT` (Nguyên liệu) hoặc `FUEL` (Nhiên liệu), rồi chọn đơn vị cơ sở (`baseUnitId`, danh sách từ `GET /kitchen/units`). FE lưu đúng hai trường này; Đồ ăn/Đồ uống/Combo và checkbox Hàng tươi sống không thay thế phân loại kho.

Sau khi lưu phân loại, mở sửa hàng để **Bật theo dõi lô (hàng chưa có tồn)**. Nút gọi `opening-preview` rồi `stock-lots/opening` hiện có, chỉ tiếp tục khi tồn đầu bằng 0. Hàng đang có tồn phải phân bổ tồn đầu theo lô, không tự chuyển hay xóa tồn. Backend tiếp tục kiểm tra/khóa dữ liệu trong transaction. Đổi phân loại/đơn vị của hàng đã dùng vẫn bị chặn theo quy tắc hiện có.

Mở lại phiếu nhập sau khi sửa cấu hình để tải metadata mới. Thông báo lỗi trên dòng hàng hướng dẫn đến đúng bước cấu hình; không bỏ kiểm tra loại hàng hoặc tự suy ra nguyên liệu từ cờ tươi sống.

### Bộ lọc danh sách nhập kho

**Loại nhập** dùng chung nhãn từ cấu hình mục đích tạo phiếu: **Tất cả / Nhập hàng / Nhập nguyên, nhiên liệu**. Nhãn phiếu hiển thị theo `reasonCode` (`NHNCC`/`NHNNL`); bộ lọc danh sách đã tải so khớp mã lý do, trạng thái thanh toán và khoảng ngày, kết hợp với tìm kiếm. Nút **Lọc** áp dụng, **Đặt lại** xóa điều kiện; bản bên trái và bản thu gọn dùng chung trạng thái. Khoảng ngày mặc định để trống. Màu lựa chọn, viền khi mở, lịch và nút Lọc dùng indigo thống nhất với giao diện kho.

### Chọn mục đích trước khi tạo phiếu

Danh sách nhập kho `/stock-in` hiển thị hai nút lớn có mô tả và ví dụ:

- **Nhập hàng**: hàng mua từ nhà cung cấp để bán/bổ sung tồn (nước đóng chai, sữa hộp, bánh đóng gói) → `/stock-in/create?reasonCode=NHNCC`.
- **Nhập nguyên, nhiên liệu**: nguyên liệu/nhiên liệu phục vụ chế biến (thịt, rau, gạo, dầu ăn, gas), quản lý theo lô và hạn dùng → `/stock-in/create?reasonCode=NHNNL`.

Form đọc lý do từ URL, chọn sẵn đúng mục đích, hiển thị mô tả tương ứng và gọi danh sách sản phẩm phù hợp. Người dùng vẫn có thể đổi giữa hai mục đích trên form; URL cập nhật theo lựa chọn. Mở URL cũ không có lý do hoặc lý do không hợp lệ thì mặc định `NHNCC`. Đã bỏ lựa chọn Khác chưa có nghiệp vụ riêng.

### Bộ chọn hàng theo lý do nhập

Khi chọn **Nhập nguyên, nhiên liệu**, cả tìm kiếm nhanh và bộ chọn sản phẩm trên từng dòng gọi `GET /products?productType=INGREDIENT,FUEL&search=...&page=1&size=50`. Backend lọc bằng `IN` trước phân trang/đếm, đồng thời giữ phạm vi chi nhánh và tìm kiếm hiện có. API vẫn nhận một loại như `productType=FUEL`; không truyền thì giữ danh sách thông thường.

Đổi lý do nhập tạo lại bộ chọn/cache theo phạm vi tương ứng, tránh hiển thị gợi ý từ lý do trước. Hàng đã chọn vẫn được kiểm tra khi lưu phiếu. Cần triển khai FE và BE hỗ trợ bộ lọc nhiều loại; không cần migration.

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


## Quản lý serial nhập kho

Mở **Quản lý kho → Lô hàng → Serial** (`/stock-lots?tab=serial`). Bấm số lô hoặc Chi tiết sẽ hiển thị trực tiếp danh sách serial đã nhập thuộc lô đó (lọc `lotId` và phiếu COMPLETED), kèm tìm kiếm và phân trang. Ví dụ lô có 10 đơn vị đã khai báo serial sẽ hiện 10 số serial trong chi tiết lô; không sinh thêm serial từ số lượng tồn. Danh sách đọc từ `stock_receipt_detail.input_details.serials`, không tạo bản sao hoặc thay đổi tồn kho. Serial thành phẩm `finished_units` vẫn thuộc luồng QR/truy xuất thành phẩm riêng.

- `GET /warehouse/serials`: phân trang `page`, `size` (tối đa 100), tìm `search` theo serial/mã/tên hàng/số lô/phiếu nhập; lọc `stockId` (kho nhập), `productId`, `lotId`, `lotCode`, `serialMode=MANUAL|AUTO`, `receiptStatus=COMPLETED|CANCELLED|DRAFT`. Trả `{ data, total, page, size, serialMovementTrackingSupported: false }` trong response wrapper hiện có.
- `GET /warehouse/serials/:detailId/:position`: chi tiết nguồn nhập của một serial. `position` bắt đầu từ 1 trong danh sách serial của dòng phiếu nhập; cặp `detailId + position` xác định đúng bản ghi kể cả serial lặp lại giữa các sản phẩm. Không tìm thấy trong chi nhánh trả 404.
- Cả hai API dùng JWT, quyền ADMIN/MANAGER/KITCHEN và quy tắc chi nhánh như các API kho. Không cần migration.
- Kho là **kho nhập ban đầu**, trạng thái là **trạng thái phiếu nhập**. Hệ thống chưa ghi nhận serial được chọn khi xuất/chuyển kho nên không suy ra tồn hiện tại, đã bán hoặc lịch sử riêng từng serial. Chi tiết có liên kết xem lịch sử của **toàn bộ lô** nếu có.
- Kiểm tra: `npm run test -- --runInBand stock-serial warehouse stock-lot.controller`; sau build chạy `WAREHOUSE_PGLITE_PATH=/tmp/mbh-warehouse-pgcheck/node_modules/@electric-sql/pglite node scripts/verify-stock-serials-postgres.cjs` (SQL tách biệt, không kết nối database thật).


### Truy xuất đến từng serial

Trong chi tiết lô, bấm một số serial để mở `/warehouse/trace?mode=serial&detailId=<uuid>&position=<n>`. Màn Truy xuất nguồn gốc có hai lựa chọn **Theo lô hàng** và **Theo serial**. Tra serial rồi chọn kết quả sẽ hiển thị chuỗi nhà cung cấp → đúng phiếu nhập → lô → serial; định danh nguồn là cặp dòng phiếu nhập/vị trí, không suy nguồn từ lần nhập đầu tiên của cả lô. Nếu nhiều kết quả trùng chữ serial, người dùng chọn đúng hàng hóa/phiếu nhập. Lịch sử lô vẫn được mở riêng và không được trình bày là lịch sử riêng của serial.

Chi tiết serial ưu tiên hiển thị **Ngày nhập kho** và **Ngày hết hạn** ngay dưới số serial. Ngày nhập dùng `input_details.purchasedAt` khi đã khai báo; bản ghi cũ thiếu trường này hiển thị ngày tạo phiếu nhập. Hạn dùng lấy từ thông tin nhập của chính serial, thiếu thì hiển thị chưa khai báo.


## API truy xuất bằng một ID

`GET /production-trace/lookup?id=<ID-lô-hoặc-số-serial>` (JWT, quyền ADMIN/MANAGER/KITCHEN; phạm vi chi nhánh theo JWT, ADMIN có thể chọn `branchId`). Chỉ có một trường định danh `id`, chuỗi tối đa 128 ký tự. Dùng query param và URL-encode để hỗ trợ serial có dấu `/`, `#`, `+`.

- ID lô: UUID của `stock_lots.id`, trả `{ type: "LOT", id, trace }`.
- Số serial: so khớp chính xác, phân biệt hoa/thường, trả `{ type: "SERIAL", id, serial, lotTrace }`. `serial` có ngày nhập (`purchasedAt`, fallback `receivedAt`), hạn dùng (`expiresAt`), hàng hóa, đúng phiếu nhập và NCC của serial đó. `lotTrace` là lịch sử chung của lô hoặc `null`, không phải lịch sử xuất/chuyển riêng của serial.
- Serial AUTO dạng UUID vẫn được tra như serial; không suy loại chỉ từ định dạng UUID.
- Không tìm thấy trong chi nhánh: 404. Trùng nhiều serial hoặc vừa khớp UUID lô vừa khớp serial: 409, `code=TRACE_ID_AMBIGUOUS`, `matches` (tối đa 20 serial và 1 lô), `total`. Không tự chọn nguồn gốc đầu tiên. Chọn bản ghi trong kết quả rồi dùng API chi tiết cũ `detailId/position` hoặc API lô để phân biệt chính xác.
- FE mặc định có một ô nhập ID lô/serial; bấm serial trong lô cũng gửi chuỗi serial tới API này. Các đường dẫn và API chi tiết cũ vẫn hoạt động.

Ví dụ: `/production-trace/lookup?id=DEMO-SERIAL-20261019-001` hoặc `/production-trace/lookup?id=<stock_lots.id>`.

Mục Kiểm kê đã được gỡ khỏi navigation kho. Đường dẫn FE cũ `/stock-takes` chuyển tới `/warehouse/inventory`; dữ liệu kiểm kê và lịch sử điều chỉnh trước đây vẫn được giữ để truy xuất.
