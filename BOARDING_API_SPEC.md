# Tài liệu Đặc tả API - Thống kê bán trú (Boarding Statistics API Spec)

Dưới đây là thiết kế chi tiết về các tham số đầu vào (Request Parameters) và cấu trúc dữ liệu đầu ra (Response JSON Payload) của API thống kê bán trú để bàn giao cho đội ngũ Backend (BE).

---

## 1. Thông tin chung (Endpoint Details)
- **Đường dẫn (Path):** `/reports/meal-items`
- **Phương thức (Method):** `GET`
- **Yêu cầu (Headers):** `Authorization: Bearer <JWT_TOKEN>`

---

## 2. Tham số yêu cầu (Request Query Parameters)

Các tham số lọc từ FE gửi lên BE để truy vấn dữ liệu:

| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả | Ví dụ |
| :--- | :--- | :--- | :--- | :--- |
| `branchId` | String (UUID) | Không | Lọc theo chi nhánh cụ thể | `550e8400-e29b-41d4-a716-446655440000` |
| `from` | String (Date) | Có | Ngày bắt đầu khoảng thời gian lọc (`YYYY-MM-DD`) | `2026-06-25` |
| `to` | String (Date) | Có | Ngày kết thúc khoảng thời gian lọc (`YYYY-MM-DD`) | `2026-07-02` |
| `level` | String | Không | Lọc khối lớp: `preschool` (Mầm non), `primary` (Tiểu học) hoặc `all` | `all` |
| `mealPeriod` | String | Không | Lọc bữa ăn: `BREAKFAST` (Sáng), `LUNCH` (Trưa), `AFTERNOON` (Xế), `DINNER` (Tối) hoặc `all` | `LUNCH` |

---

## 3. Dữ liệu phản hồi (Response Payload - 200 OK)

Cấu trúc JSON phản hồi từ BE cần cung cấp đầy đủ thông số cho các cấu phần KPI, biểu đồ (Recharts) và bảng kê chi tiết của FE.

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalMealsOrdered": 3520,
      "totalMealsCancelled": 48,
      "totalMealsServed": 3472,
      "totalRevenue": 121520000,
      "completionRate": 98.6
    },
    "dailyTrend": [
      {
        "date": "2026-06-29",
        "portions": 560,
        "revenue": 19600000
      },
      {
        "date": "2026-06-30",
        "portions": 585,
        "revenue": 20475000
      },
      {
        "date": "2026-07-01",
        "portions": 578,
        "revenue": 20230000
      }
    ],
    "levelStats": [
      { "level": "preschool", "name": "Mầm non", "value": 1420 },
      { "level": "primary", "name": "Tiểu học", "value": 2052 }
    ],
    "mealStats": [
      { "mealPeriod": "BREAKFAST", "name": "Ăn sáng", "value": 850 },
      { "mealPeriod": "LUNCH", "name": "Ăn trưa", "value": 1150 },
      { "mealPeriod": "AFTERNOON", "name": "Ăn xế", "value": 900 },
      { "mealPeriod": "DINNER", "name": "Ăn tối", "value": 572 }
    ],
    "detailLogs": [
      {
        "date": "2026-07-01",
        "level": "preschool",
        "mealPeriod": "LUNCH",
        "dishName": "Cơm tôm rim thịt + Canh bí đỏ",
        "unitPrice": 35000,
        "ordered": 150,
        "cancelled": 2,
        "served": 148,
        "amount": 5180000,
        "status": "COMPLETED"
      },
      {
        "date": "2026-07-01",
        "level": "primary",
        "mealPeriod": "LUNCH",
        "dishName": "Cơm cá thu sốt cà chua + Canh chua cá lóc",
        "unitPrice": 40000,
        "ordered": 230,
        "cancelled": 5,
        "served": 225,
        "amount": 9000000,
        "status": "COMPLETED"
      }
    ]
  }
}
```

### Giải thích các khối dữ liệu trong Response:

1. **`summary` (Khối KPI chính):**
   - `totalMealsOrdered`: Tổng suất ăn đã đăng ký (trên hệ thống).
   - `totalMealsCancelled`: Tổng suất ăn học sinh báo hủy/trả.
   - `totalMealsServed`: Số lượng suất ăn thực phục vụ và chế biến (= `totalMealsOrdered` - `totalMealsCancelled`).
   - `totalRevenue`: Tổng số tiền ăn thu về (Doanh thu).
   - `completionRate`: Tỉ lệ hoàn thành suất ăn (= `totalMealsServed / totalMealsOrdered * 100`).

2. **`dailyTrend` (Biểu đồ miền/cột xu hướng theo ngày):**
   - Tập hợp dữ liệu thống kê tổng hợp số suất ăn (`portions`) và doanh thu (`revenue`) của mỗi ngày nằm trong khoảng lọc.

3. **`levelStats` & `mealStats` (Biểu đồ tròn cơ cấu):**
   - Đếm tổng số lượng suất ăn thực phục vụ gom nhóm theo **Khối lớp** (`level`) và **Bữa ăn** (`mealPeriod`) để biểu thị tỉ lệ cơ cấu phần trăm.

4. **`detailLogs` (Bảng kê chi tiết):**
   - Danh sách chi tiết thực đơn và số lượng phục vụ của từng ngày, từng khối lớp và từng bữa. Dùng hiển thị bảng báo cáo chi tiết giúp quản lý nhà bếp nắm số lượng cần chế biến thực tế.
