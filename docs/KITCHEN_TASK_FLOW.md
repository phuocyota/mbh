# Luồng nhận việc của nhân viên bếp

Màn `Nhận việc & Chế biến` dùng chung cho đơn căn tin đã thanh toán và mẻ theo kế hoạch. Nút chuông và các thẻ công việc trên Tổng quan mở màn này. Danh sách tải theo ngày, chi nhánh trong JWT; không polling hay kết nối socket từ giao diện.

## Các bước

| Bước | Thao tác | Trạng thái nhiệm vụ | Ảnh hưởng dữ liệu |
|---|---|---|---|
| 1–2 | Xem thông báo/nhiệm vụ | WAITING | Xem số lượng, công thức đang áp dụng, định mức, thời hạn nếu đã thiết lập |
| 3 | `receive` | RECEIVED | Chọn đủ nguyên liệu theo từng lô còn hạn. Chụp công thức/định mức và ghi người nhận; chưa trừ kho |
| 4 | `start` | PREPARING | Kiểm tra tồn và hạn dùng lại, trừ từng lô, ghi người và thời gian bắt đầu |
| 5 | `record` | RECORDED | Ghi sản lượng đạt, lượng thực dùng/hao hụt của từng lô. Có thể chỉnh lại trước QC |
| 6 | `complete` | COMPLETED | Xác nhận chất lượng, bắt buộc mẫu hợp lệ với món yêu cầu; hoàn nguyên liệu thừa về lô gốc; tạo thành phẩm/QR và nhập tồn thành phẩm tại bếp |
| 7 | `handover` | HANDED_OVER | Giao toàn bộ sản lượng đạt, ghi người nhận/nơi nhận/thời gian, trừ tồn thành phẩm tại bếp; đơn chuyển DONE |

Danh sách là hàng đợi chung. Nhân viên xác nhận nguyên liệu trở thành người phụ trách. Người khác xem hồ sơ; bếp trưởng/ADMIN/MANAGER được xử lý tiếp. CASHIER không có quyền gọi API nhiệm vụ.

## API

- `GET /kitchen/tasks?date=YYYY-MM-DD&type=ticket|batch` (type tùy chọn).
- `GET /kitchen/tasks/:type/:id` trả hồ sơ, công thức, lô khả dụng và lịch sử.
- `POST /kitchen/tasks/:type/:id/:action` với `action` thuộc receive/start/record/complete/handover. Body luôn có `expectedVersion` và `requestId` UUID; giữ nguyên body/requestId khi thử lại cùng yêu cầu.

Các trường riêng theo thao tác:

```json
{
  "receive": {"dishes":[{"productId":"UUID","inputLots":[{"lotId":"UUID","quantity":1}]}]},
  "start": {},
  "record": {"actuals":[{"batchId":"UUID","quantity":1,"note":"Lý do hao hụt nếu có","lots":[{"lotId":"UUID","used":1,"waste":0}]}]},
  "complete": {"qualityPassed":true,"samples":[{"batchId":"UUID","quantity":10,"unit":"g","storageLocation":"Tủ mẫu 1"}]},
  "handover": {"receivedBy":"Người nhận","receiverPlace":"Quầy căn tin","items":[{"batchId":"UUID","quantity":1}]}
}
```

## Ràng buộc và giới hạn

- Nhiệm vụ lưu trong `kitchen_operations`, kind `task-flow`; không cần thêm bảng. Công thức được chụp khi nhận nguyên liệu để sửa công thức sau đó không đổi nhiệm vụ đang làm.
- Giao dịch, khóa chi nhánh/nguồn, kiểm tra phiên bản và chống lặp request bảo vệ trừ kho/nhập thành phẩm/bàn giao. Socket backend chỉ phát sau commit; frontend vẫn tắt socket.
- Mẻ sinh từ đơn liên kết `details.workflowTicketId`, không hiện thành nhiệm vụ thứ hai và không cộng nhu cầu hai lần.
- Món chưa có công thức đang áp dụng hoặc công thức rỗng không được nhận. Dùng/hao hụt không vượt lượng nhận; cần ghi lượng thực dùng cho mỗi nguyên liệu. Sản lượng là số nguyên, tối đa 10.000. Đơn căn tin cần đủ số lượng đặt; chưa hỗ trợ thiếu món/hủy một phần hoặc bàn giao nhiều đợt.
- Chỉ nhận/bắt đầu/ghi thực tế/QC nhiệm vụ trong ngày Việt Nam hiện tại. Bàn giao được phép sau ngày đó nếu thành phẩm còn hạn theo quy tắc tồn bếp.
- Hạn hoàn thành hiển thị từ `batch.details.deadline` khi có; chưa bổ sung màn phân công riêng hay bộ lập lịch. Đơn căn tin chưa có deadline và hiện dùng Ca trưa.
- Mẻ/đơn đã chạy luồng cũ hiện `LEGACY`, không tự suy ngược các lô đã dùng.
- Tồn thành phẩm tại bếp dùng mô hình `finished-inventory` hiện có, độc lập với tồn kho tổng `stock_items`.
- Khi triển khai cần có schema recipe description từ migration trước đó; tài liệu này không xác nhận migration đã chạy trên môi trường thật.

## Kiểm chứng

Chạy build và Jest tập trung các kitchen suite. `node scripts/verify-kitchen-task-flow.cjs` sau build chạy TypeORM/service thật với PostgreSQL PGlite độc lập, không đọc `.env` và không kết nối DB ngoài. Cài `@electric-sql/pglite` ngoài repo rồi đặt `WAREHOUSE_PGLITE_PATH` tới package nếu không dùng đường dẫn mặc định của script. Script kiểm tra ba lô, kho chỉ trừ một lần, replay, ngày hết hạn, chi nhánh/người phụ trách/phiên bản, rollback khi thiếu mẫu, hoàn thừa, QR, tồn bếp và bàn giao đơn.
