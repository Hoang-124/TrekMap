# 🗺️ TrekMap Project Roadmap — Phân Giai Đoạn Theo Dependency Thực Tế

Tài liệu này hệ thống hóa toàn bộ **64 nhiệm vụ (tasks)** của dự án TrekMap được phân chia thành **8 Giai đoạn (Phase 0 đến Phase 7)** dựa trên phụ thuộc dữ liệu và tính năng thực tế.

---

## 📊 Bảng Tổng Quan Các Giai Đoạn (Milestones Summary)

| Phase | Tên Giai Đoạn | Mục Tiêu & Trọng Tâm | Tình Trạng |
| :--- | :--- | :--- | :---: |
| **Phase 0** | **Nền tảng & Dữ liệu gốc** | Auth JWT, Hồ sơ user, Seed data Việt Nam | ✅ 100% Done |
| **Phase 1** | **Bản đồ & Khám phá + CDN** | Map 3D, GIS Query, Search/Filter, Cloudinary CDN | ✅ 100% Done |
| **Phase 2** | **Chi tiết & Tiện ích Trek** | Trail Detail, GPX, Weather, Gear Checklist, Timeline | ✅ 100% Done |
| **Phase 3** | **Đóng góp & Điểm thưởng** | Contribution Wizard, GPX Import, Reputation & Badges | ✅ 100% Done |
| **Phase 4** | **Admin & Kiểm duyệt** | Admin CRUD, Moderation, User & Incident Management | ✅ 100% Done |
| **Phase 5** | **Cộng đồng & Dịch vụ** | Reviews, Expedition Logs, Radar Badges, Porter & Guide | ✅ 100% Done |
| **Phase 6** | **An toàn & Khẩn cấp** | Incident Alert, Emergency Hotlines, Basecamp Radio Realtime | ✅ 100% Done |
| **Phase 7** | **Tối ưu & Hoàn thiện** | Refactor, Security Audit, E2E Testing | ⏳ Pending |

---

## 📌 Bảng Phân Tích Chi Tiết 8 Giai Đoạn

### 🟢 Phase 0 — Nền Tảng & Dữ Liệu Gốc (7/7 Task Done)
> **Lý do thiết kế**: Mọi tính năng về sau đều cần User đã authenticate + dữ liệu Trail có sẵn để test.

* [x] `Seed Data Initializer`: Khởi tạo dữ liệu các cung đường thật tại Việt Nam (*Hoàng | BE*)
* [x] `Register`: Đăng ký tài khoản mới (*Hoàng | BE*)
* [x] `Login`: Đăng nhập với Email & Password (*Hoàng | BE*)
* [x] `Login via Google`: Đăng nhập nhanh Google OAuth (*Hoàng | BE*)
* [x] `Logout`: Đăng xuất & hủy session/token (*Hoàng | BE*)
* [x] `Profile View`: Xem thông tin hồ sơ cá nhân (*Hoàng | FE*)
* [x] `Update Profile`: Cập nhật thông tin tài khoản & avatar (*Hoàng | FE/BE*)

---

### 🔵 Phase 1 — Bản Đồ & Khám Phá Cơ Bản + Tối Ưu Ảnh CDN (15/15 Task Done)
> **Lý do thiết kế**: Đây là **Core Value** của sản phẩm. Trải nghiệm xem/tìm trail và tối ưu tải ảnh (Cloudinary) phải mượt trước khi làm tính năng phụ.

* [x] `Browse Trails`: Duyệt danh sách các cung đường (*Tùng | FE/BE*)
* [x] `GPX Track Polyline`: Trực quan hóa tuyến đường GPX trên bản đồ (*Tùng | FE*)
* [x] `Waypoints Marker`: Hiển thị mốc tọa độ/điểm dừng (*Tùng | FE*)
* [x] `TrailCard 3D`: Thẻ xem tóm tắt cung đường (*Tùng | FE*)
* [x] `Search Trails`: Tìm kiếm cung đường theo từ khóa (*Tùng | BE*)
* [x] `Filter Region`: Lọc cung đường theo vùng miền (*Tùng | FE*)
* [x] `Tile Layer Switcher`: Đổi các lớp bản đồ (Vệ tinh / Địa hình) (*Tùng | FE*)
* [x] `3D Perspective Map`: Chế độ xem nghiêng 3D Pitch (*Tùng | FE*)
* [x] `Difficulty Color Markers`: Đánh dấu màu đường đi theo độ khó (*Tùng | FE*)
* [x] `Map Auto FlyTo`: Bản đồ tự động FlyTo vào vị trí trail (*Tùng | FE*)
* [x] `Image Auto-Optimization`: Tối ưu hóa tải ảnh Cloudinary CDN (*Hoàng | BE/FE*)
* [x] `Advanced Filter`: Bộ lọc nâng cao theo độ khó & thời gian (*Tùng | FE/BE*)
* [x] `Filter Campsite & Kid`: Lọc trail có bãi cắm trại & phù hợp trẻ em (*Tùng | FE*)
* [x] `Sort Trails`: Sắp xếp theo đánh giá & khoảng cách (*Tùng | FE*)
* [x] `2dsphere Spatial Query`: Tìm cung đường gần tọa độ GPS người dùng (*Tùng | BE*)

---

### 🟡 Phase 2 — Chi Tiết Cung Đường & Tiện Ích Hỗ Trợ Trek (15/15 Task Done)
> **Lý do thiết kế**: Chuẩn bị đầy đủ thông tin chi tiết và công cụ hỗ trợ người đi rừng trước chuyến đi.

* [x] `Overview Stats`: Hiển thị thông số kỹ thuật chi tiết trail (*Nguyên | FE*)
* [x] `Download GPX File`: Tải file GPX về thiết bị (*Nguyên | FE*)
* [x] `Best Season Calendar`: Lịch khuyến nghị các tháng đi đẹp nhất (*Nguyên | FE*)
* [x] `Transportation Guide`: Hướng dẫn phương tiện di chuyển tới trailhead (*Nguyên | FE*)
* [x] `Permit & Ranger Note`: Thông tin xin giấy phép Ban quản lý rừng (*Nguyên | FE*)
* [x] `Mountain Weather 7 Days`: Dự báo thời tiết vùng núi 7 ngày (*Uyên | FE/BE*)
* [x] `Cloud Hunting Index`: Tỷ lệ phần trăm xác suất săn mây (*Uyên | FE/BE*)
* [x] `Bad Weather Warning`: Cảnh báo thời tiết nguy hiểm (*Uyên | FE/BE*)
* [x] `Gear Checklist Generator`: Tự động gợi ý danh mục trang bị sinh tồn (*Quang | FE*)
* [x] `Backpack Weight Calculator`: Tính tổng trọng lượng balo (*Quang | FE*)
* [x] `Overweight Warning`: Cảnh báo balo vượt quá tỷ lệ trọng lượng cơ thể (*Quang | FE*)
* [x] `Expedition Timeline`: Lập lịch trình chuyến đi chi tiết theo giờ (*Nguyên | FE*)
* [x] `Export Zalo Share Card`: Xuất card lịch trình để gửi nhóm Zalo (*Nguyên | FE*)
* [x] `Offline Map Caching`: Tải & lưu bản đồ offline (*Tùng | FE*)
* [x] `GPS Live Tracking`: Định vị thời gian thực của người dùng trên đường trek (*Tùng | FE*)

---

### 🟠 Phase 3 — Đóng Góp Nội Dung & Gamification (6/6 Task Done)
> **Lý do thiết kế**: Đặt sau Phase 1 & 2 vì cần trải nghiệm xem trail ổn định trước khi mở cho cộng đồng đóng góp. Thưởng điểm/badge ngay sau khi đóng góp.

* [x] `5-Step Contribution Wizard`: Quy trình 5 bước đóng góp cung đường mới (*Quang | FE*)
* [x] `Import GPX File`: Tải tệp GPX trích xuất tọa độ tự động (*Quang | FE/BE*)
* [x] `Live Trail Preview`: Xem trước giao diện bài viết trước khi gửi (*Quang | FE*)
* [x] `Submit Contribution`: Gửi bài viết lên chờ Admin duyệt (*Quang | BE*)
* [x] `User Reputation`: Tích lũy điểm uy tín khi đóng góp (*Hoàng | BE* — *Gắn liền sau Contribution*)
* [x] `User Badges`: Mở khóa huy hiệu thành tích (*Hoàng | FE/BE* — *Gắn liền sau Contribution*)

---

### 🔴 Phase 4 — Admin System & Kiểm Duyệt Hệ Thống (8/8 Task Done)
> **Lý do thiết kế**: Quản trị viên kiểm duyệt các nội dung từ Phase 3 gửi lên và điều hành hệ thống.

* [x] `Create Trail`: Admin khởi tạo trực tiếp cung đường mới (*Hoàng | BE*)
* [x] `Update Trail`: Cập nhật thông tin cung đường (*Hoàng | BE*)
* [x] `Delete Trail`: Xóa cung đường (*Hoàng | BE*)
* [x] `Moderation Dashboard`: Giao diện BQT duyệt bài đóng góp (*Hoàng | FE/BE*)
* [x] `Incident Management`: Quản lý các vụ cứu hộ/sự cố (*Hoàng | FE/BE*)
* [x] `User Management`: Quản lý người dùng, ban/unban (*Hoàng | BE*)
* [x] `Delete Review`: Xóa đánh giá rác/spam (*Hoàng | BE*)
* [x] `Analytics Dashboard`: Báo cáo thống kê toàn hệ thống (*Hoàng | FE/BE*)

---

### 🟣 Phase 5 — Cộng Đồng & Dịch Vụ Địa Phương (8/8 Task Done)
> **Lý do thiết kế**: Tăng tính tương tác xã hội và hỗ trợ thuê Porter/Guide địa phương.

* [x] `Submit Review`: Đánh giá & chấm điểm sao cho cung đường (*Tùng | FE/BE*)
* [x] `Review List View`: Xem danh sách đánh giá từ cộng đồng (*Tùng | FE*)
* [x] `Safety Note Feedback`: Để lại ghi chú cảnh báo an toàn trên tuyến (*Tùng | FE/BE*)
* [x] `Expedition Logs`: Chia sẻ nhật ký hành trình (*Hoàng | FE/BE*)
* [x] `Radar Safety Status`: Badge trạng thái thực địa trên log (*Hoàng | FE*)
* [x] `Porter List`: Danh sách Porter/Guide địa phương (*Uyên | FE/BE*)
* [x] `Verified Porter Badge`: Badge xác minh Porter uy tín (*Uyên | FE*)
* [x] `Direct Call Porter`: Gọi điện trực tiếp cho Porter (*Uyên | FE*)

---

### 🟤 Phase 6 — An Toàn, Khẩn Cấp & Realtime (5/5 Task Done)
> **Lý do thiết kế**: Các tính năng khẩn cấp và đàm thoại Radio hạ tầng Realtime phức tạp được đẩy xuống giai đoạn hoàn thiện sản phẩm.

* [x] `Incident Reporting`: Báo cáo sự cố khẩn cấp trên đường đi (*Uyên | FE/BE*)
* [x] `Top Emergency Banner`: Banner cảnh báo khẩn cấp toàn ứng dụng (*Uyên | FE*)
* [x] `Emergency Contacts`: Danh bạ hotline cứu hộ khẩn cấp (*Uyên | FE*)
* [x] `Radio Channel Tuning`: Kênh radio liên lạc nội bộ nhóm (*Hoàng | FE/BE* — *Được đẩy xuống Phase 6*)
* [x] `Altitude & GPS Signal Tag`: Đính kèm tọa độ & độ cao vào tin nhắn rescue (*Hoàng | FE/BE* — *Được đẩy xuống Phase 6*)

---

### ⚪ Phase 7 — Tối Ưu Tải Trọng & Kiểm Thử Toàn Diện
> **Lý do thiết kế**: Đảm bảo hệ thống đạt tiêu chuẩn trước khi chính thức Release.

* [ ] Kiểm thử E2E (End-to-End Testing) cho toàn bộ 7 phases.
* [ ] Security Audit (Rà soát lỗ hổng OWASP).
* [ ] Tối ưu truy vấn CSDL MongoDB index & Caching.
