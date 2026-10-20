# Phê duyệt công thức bếp

## Phân quyền

- HEAD_CHEF trên Web Bếp: tạo và chỉnh định lượng bằng phiên bản mới, gửi duyệt công thức của mình. Không tự kích hoạt.
- ADMIN trên Web Admin: xem công thức/định lượng/giá vốn, phê duyệt và áp dụng hoặc yêu cầu chỉnh sửa kèm lý do; không tạo/sửa/gửi công thức.
- MANAGER: duyệt như ADMIN trong phạm vi `req.user.branchId`; không được thao tác chi nhánh khác, không tạo/sửa/gửi công thức.
- KITCHEN, CASHIER: chỉ đọc công thức ACTIVE; không tạo/gửi duyệt/phê duyệt.

Web Bếp: Thực đơn & Công thức → Công thức & Định lượng. Web Admin: Hàng hóa → món thành phẩm → Định lượng nguyên liệu để xem/duyệt. Form tạo/sửa sản phẩm chỉ có hướng dẫn và trạng thái công thức, không nhập định lượng. Có thể lưu sản phẩm chưa có công thức; chế biến vẫn yêu cầu công thức ACTIVE.

## Trạng thái và API

`POST /kitchen/recipes` luôn tạo `DRAFT`, không nhận `activate:true`.

- `POST /kitchen/recipes/:id/submit`: DRAFT hoặc REVISION_REQUESTED → PENDING_REVIEW; chỉ HEAD_CHEF gửi phiên bản mình tạo trong chi nhánh của mình.
- `POST /kitchen/recipes/:id/approve`: PENDING_REVIEW → ACTIVE, phiên bản ACTIVE cũ thành INACTIVE trong cùng giao dịch.
- `POST /kitchen/recipes/:id/request-changes` với `{ "reason": "..." }`: PENDING_REVIEW → REVISION_REQUESTED; lý do bắt buộc, tối đa 1000 ký tự.
- URL cũ `/activate` là alias phê duyệt với đầy đủ kiểm tra: chỉ ADMIN/MANAGER, chỉ PENDING_REVIEW.

Định lượng là bất biến theo phiên bản. Khi cần sửa, tạo phiên bản nháp mới từ công thức cũ rồi gửi lại. Không sửa nội dung một phiên bản đã gửi duyệt hoặc đã áp dụng. Các lượt gửi/duyệt/trả lại lưu người thực hiện, thời điểm và lý do trong `approval.history`.

## Giá vốn dự kiến

- Mỗi dòng = lượng nguyên liệu quy đổi về `baseUnitId` × `products.costPrice` trên **một đơn vị tồn chuẩn**. Không dùng giá bán hoặc giá vốn thành phẩm làm giá nguyên liệu.
- Tổng giá vốn là tổng các dòng; chi phí/đơn vị đầu ra = tổng vốn / yieldQuantity theo yieldUnit.
- `expectedWastePercent` do người lập khai báo, từ 0 đến dưới 100%, tối đa 2 số thập phân. Định lượng nhập là **đầu vào đã bao gồm hao hụt**, không cộng hao hụt thêm lần nữa. Giá trị hao hụt dự kiến = tổng vốn × tỷ lệ / 100.
- Thiếu giá vốn/đơn vị hoặc công thức rỗng không được gửi duyệt. Giá bằng 0 được chấp nhận nếu khai báo rõ ràng; null là chưa khai báo.
- Bản nháp hiển thị giá vốn hiện tại. Khi gửi duyệt, hệ thống chụp chi phí và giá thành phần vào `approval.costing`; thay đổi giá nguyên liệu sau đó không thay đổi hồ sơ đang chờ/đã duyệt.
- Đây là chi phí nguyên liệu dự kiến, chưa gồm nhân công/năng lượng và chưa thay thế giá vốn kế toán thực tế theo lô.

## Triển khai

Chạy migration `1765100000000-AddKitchenRecipeApproval` trước khi triển khai backend mới. Thêm `expected_waste_percent` và `approval`. Các công thức ACTIVE/INACTIVE hiện có giữ nguyên và gắn `approval.legacy=true` để phân biệt hồ sơ có trước quy trình duyệt. Không tự nhận chúng là đã có admin phê duyệt. API chế biến tiếp tục chỉ dùng ACTIVE; bản chưa duyệt không tham gia tính nhu cầu/chế biến.

Migration chưa được chạy trên DB thật trong lần thay đổi source này. Kiểm tra service thật trên PostgreSQL độc lập bằng `node scripts/verify-kitchen-task-flow.cjs` sau build; script kiểm tra quyền, chi nhánh, gửi/trả lại/gửi lại/duyệt, giữ bản cũ đến khi duyệt, chụp giá và toàn bộ luồng chế biến.
