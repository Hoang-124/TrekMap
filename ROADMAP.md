# 🗺️ LOST Project Roadmap — Phân Giai Đoạn Theo Dependency Thực Tế

Tài liệu này hệ thống hóa toàn bộ lộ trình phát triển của dự án LOST được phân chia thành **13 Giai đoạn (Phase 0 đến Phase 12)** dựa trên phụ thuộc dữ liệu và tính năng thực tế.

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
| **Phase 7** | **Tối ưu & Hoàn thiện** | Security Audit, DB Indexes, Dual-Theme QA & Regression Tests | ✅ 100% Done |
| **Phase 8** | **Thực Địa 3D, Offline & Hệ Sinh Thái Đoàn** | GPS Check-in/Wishlist/Audit, Offline Pack & Off-Trail Alarm, 3D DEM, Squad Chat/Chia Tiền, AI Go/No-Go, Refresh Cookie & CI | ✅ 100% Done |
| **Phase 9** | **Field-Atlas 8 Hubs, AI Suite, 24 Cung DEM & Bảo Mật Chuyên Sâu** | 24 cung DEM thật, 8 Flagship Hubs, LOST Alpine AI Suite, Live GPS, Học Viện Sinh Tồn, Ctrl+K, Owner CRUD & Security Hardening | ✅ 100% Done |
| **Phase 10** | **Siêu Ứng Dụng Thực Địa: 30 Cung DEM, AI 4 Chế Độ, Live Beacon & 3D Fly-Through** | 30 cung DEM, 8 Thử thách, 25 Kiểm lâm, 10 HDV, AI Photo Triage/SSE/TTS/Dossier, Live Family Beacon, 3D Fly-Through, Debt Settlement, Leg Splits, Social Feed & Goal Rings | ✅ 100% Done |
| **Phase 11** | **36 Cung DEM, Trí Tuệ Pace/Dinh Dưỡng AI, Field POIs, Cảnh Báo Thời Tiết, GIS Studio & Chuẩn 0-Warning A11y** | 36 cung DEM, 10 Thử thách, 28 Kiểm lâm, AI Pace/Fuel Planners, Weather Alert Watchlist, Crowdsourced Field POIs & Platform Pulse, Offline PNG Share Cards, Vietnam Topo Quiz, GIS Studio, Squad Load/Safety Gate, Profile CSV, FocusTrap LIFO & Global 0-Warning ESLint | ✅ 100% Done |
| **Phase 12** | **AI Kiểm Định Sẵn Sàng, Khí Hậu Đỉnh ERA5 3 Năm, PWA Offline, ICE Lockscreen, Cách Ly Lưu Trữ & WCAG AA Toàn Kho** | AI Readiness Audit (0–100) + 25/25 stress suite, Open-Meteo ERA5 3-Year Summit Climate SVG, Cloud Annual Goals API, Offline ICE Medical Lockscreen PNG & ISA Altimeter, Ranger Manifest CSV, PWA `manifest.json`/`sw.js` v2/CORS Packs, `storageScope.ts` + 40-Portal LIFO FocusTrap & 100% Repo-Wide WCAG AA (`0` ESLint warnings / `244` files) | ✅ 100% Done |

---

## 📌 Bảng Phân Tích Chi Tiết 13 Giai Đoạn

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

### ⚪ Phase 7 — Tối Ưu Tải Trọng, Bảo Mật & Kiểm Thử Toàn Diện (Done)
> **Lý do thiết kế**: Đảm bảo hệ thống đạt tiêu chuẩn bảo mật, dữ liệu thực tế và độ ổn định trước khi chính thức Release.

* [x] Security Audit (OWASP): loại bỏ backdoor login, khóa SSRF/LFI upload, ép xác thực JWT + RBAC + ownership checks, chặn NoSQL operator injection, siết Socket.IO & CORS.
* [x] Tối ưu CSDL MongoDB: chuẩn hóa schema Mongoose v9, chỉ mục `2dsphere` + `default_language: 'none'` cho tìm kiếm tiếng Việt, TTL index tự dọn thông báo/dự báo cũ, seed idempotent không phá dữ liệu thật.
* [x] Kiểm chuẩn dữ liệu thực địa Việt Nam (100% tọa độ GPS, cao độ đỉnh và danh bạ VQG / 112-113-114-115 xác thực) & chuẩn hóa Dual-Theme CSS Tokens + Pure SVG + Vietnamese Typography.
* [x] Kiểm thử tích hợp & hồi quy bảo mật (`vitest` + `supertest`), type-check & ESLint 0 lỗi trên cả Client và Server.

---

### 🚀 Phase 8 — Thực Địa 3D DEM, Offline-First & Hệ Sinh Thái Ghép Đoàn (Done)
> **Lý do thiết kế**: Nâng LOST thành nền tảng thực địa chuyên sâu cho trekker Việt Nam — sử dụng được cả khi mất sóng rừng sâu, có bản đồ địa hình 3D thật, cộng tác đoàn minh bạch và quy trình CI/Auth chuẩn production.

* [x] **Hoàn thiện các Model CSDL**: Check-in đỉnh có xác thực GPS/GPX + Bảng Xếp Hạng Chinh Phục Đỉnh (`CheckinModel`), Danh sách cung yêu thích đồng bộ đám mây (`SavedTrailModel`), Đồng bộ Checklist balo đa thiết bị (`GearChecklistModel`), Dòng thời gian hoạt động (`ActivityModel`) & Nhật ký kiểm toán Admin (`AuditLogModel`).
* [x] **Offline-First & An Toàn Thực Địa**: Gói tải Offline 1 chạm (`IndexedDB` + Cache API tile bản đồ), Ghi tracklog GPS thực địa + Cảnh báo lệch cung > 100m (Web Audio + rung + HUD + xuất GPX), Hẹn giờ báo bình an Dead-Man's Switch kèm tác vụ quét quá hạn gửi email cứu hộ (`SafetyTimerModel`), và soạn tin nhắn SOS 2G không cần 4G (`sms:` URI).
* [x] **Bản Đồ 3D Địa Hình Thật & Biểu Đồ Cao Độ DEM Thật**: `maplibre-gl` WebGL 3D Terrain kết hợp AWS Terrarium DEM + ảnh vệ tinh Esri, biểu đồ cao độ thật từ Open-Meteo Elevation API đồng bộ trỏ 2 chiều lên bản đồ Leaflet.
* [x] **Không Gian Đoàn & Thủ Tục Rừng**: Phòng Chat Nhóm Đoàn realtime (`ConversationModel`), Bảng phân công đồ dùng chung & Máy tính chia tiền VND minh bạch (`TripPlanModel`), đánh giá Porter/Guide xác thực (`GuideModel`), bộ checklist & mẫu đơn giấy phép VQG / Khu vực biên giới Việt Nam.
* [x] **AI Go/No-Go, Clean URL SEO, HttpOnly Refresh Token & CI**: API `POST /api/ai/go-no-go` tổng hợp Open-Meteo + sự cố + tình trạng đường thực tế, Clean History URL (`/trails/:slug`) + thẻ OpenGraph/Title động, cơ chế xoay vòng `HttpOnly` Refresh Token (`/api/auth/refresh`), GitHub Actions CI (`.github/workflows/ci.yml`) và bộ kiểm thử tự động toàn diện.

---

### 🏔️ Phase 9 — LOST Alpine Intelligence Suite, 24 Cung DEM Thật, 8 Flagship Hubs, Live GPS, Học Viện Sinh Tồn & Củng Cố Bảo Mật (Done)
> **Lý do thiết kế**: Hoàn thiện LOST thành nền tảng thám hiểm toàn diện nhất Việt Nam với 100% dữ liệu địa lý kiểm chuẩn DEM, bộ 8 trung tâm tác nghiệp Field-Atlas, trợ lý AI đa phiên chuyên sâu, máy tính GPS thực địa và kiến trúc bảo mật chuẩn production.

* [x] **24 Cung Đường Thực Địa Kiểm Chuẩn Copernicus 90m DEM & Danh Bạ Chính Quy**: Đồng bộ SHA-256 `seedData.ts` & `vietnamDirectory.ts` (Client/Server) gồm 24 cung thật (11 Miền Bắc, 7 Miền Trung, 6 Miền Nam; 90 waypoint; 10–12 điểm gpxTrack sống núi mỗi cung; sửa ngược tuyến Bà Đen/Chứa Chan và 10 điểm lệch tọa độ; bổ sung Pu Si Lung 3.083m, Ngũ Chỉ Sơn 2.858m, Lùng Cúng 2.913m, Tây Côn Lĩnh 2.428m, Pù Luông 1.700m, Cực Đông Mũi Đôi, VQG Núi Chúa 1.039m, VQG Cát Tiên Bàu Sấu), 6 Thử Thách Chinh Phục Đỉnh (`SummitChallengeModel`), 24 trạm VQG/Kiểm lâm/CNCH (`RangerStationModel`), 9 đơn vị dẫn đường chính quy (`GuideModel` + tự động loại bỏ 3 bản ghi mẫu cũ vi phạm dữ liệu thật) và 276 mục tri thức AI có khóa định danh + chuẩn hóa tiếng Việt không dấu.
* [x] **8 Flagship Field-Atlas Hubs (`ExpeditionHubBar` & `HubShowcaseStrip`)**:
  - `PeakPassportView`: Hộ chiếu đỉnh, 6 thử thách chinh phục, bảng xếp hạng và mã QR chuẩn ISO/IEC 18004 dựng bằng SVG thuần (`qrMatrix.ts`).
  - `SeasonAlmanacView`: Ma trận lịch mùa 12 tháng × 24 cung, bản tin khí hậu vùng miền, biểu đồ phù hợp SVG và liên kết nhanh AI Go/No-Go.
  - `RoutePlannerView`: Thiết kế GPX tương tác trên Leaflet, phân tích độ dốc màu, tính Naismith/Tobler ETA, lưu/chia sẻ `/api/custom-routes`, xuất GPX 1.1 và chuyển thẳng sang Biểu mẫu Đóng góp 5 bước (`TrailContributionWizard`).
  - `FieldToolkitView`: Console sinh tồn offline 100% gồm La bàn SVG/WGS84-DMS, Cung Mặt Trời NOAA (`solarMath.ts`), Bio-Calc, SOS 2G + Đèn Morse + Còi 3.1kHz, và **Học Viện Sinh Tồn 8 Kịch Bản Thực Địa Việt Nam**.
  - `DirectoryCostView`: Danh bạ 24 VQG/Kiểm lâm, 9 đơn vị dẫn đường chính quy kèm gửi yêu cầu đặt lịch (`/api/directory/inquiries`) và Máy tính dự toán chi phí VND + biểu đồ cột chồng SVG.
  - `TrainingPlannerView`: Sinh giáo án thể lực 4/6/8 tuần tăng tải & taper, đồng bộ `/api/training-plans` + `localStorage`, kèm vòng Readiness Ring & biểu đồ cao độ tuần SVG.
  - `GearOptimizerView`: Quản lý tủ đồ & tối ưu trọng lượng balo, biểu đồ tròn phân bổ tải trọng SVG, đồng bộ đám mây (`/api/gear-packs`) & chia sẻ link `?pack=<slug>`.
  - `SafetyRadarView`: Radar an toàn toàn quốc, ma trận rủi ro vùng miền SVG, xác nhận sự cố trực tiếp và giám sát tình trạng đường mòn.
* [x] **LOST Alpine Intelligence Suite (`TrekAssistantModal`)**: Giao diện 3 chế độ (Chat đa phiên lưu MongoDB `AiChatThreadModel` + Gợi ý cung thông minh `/api/ai/recommend` + Kiểm toán Balo `/api/ai/audit-pack`), tích hợp phân tích GPX (`/api/ai/analyze-gpx`), Bio-Calc (`/api/ai/bio-calc`), Go/No-Go áp suất/nhiệt độ đỉnh núi (`/api/ai/go-no-go`), So sánh đa cung đối đầu (`/api/ai/compare`), nhập giọng nói `vi-VN` và xuất báo cáo `.md` 1 chạm.
* [x] **Live GPS Tracker, Global `Ctrl+K`, Profile Analytics & Community Calendar**: Máy tính GPS thực địa (`LiveTrekTrackerModal`), Bảng lệnh toàn cục `Ctrl+K` (`CommandPaletteModal` tìm tức thì 24 cung / 8 Hub / 24 trạm kiểm lâm / LOST AI), Hồ sơ nhật ký & biểu đồ phân tích cá nhân (`ProfileAnalyticsPanel` + `/api/logbook`), Lịch Xuất Hành Cộng Đồng (`ExpeditionCalendarGrid` + `/api/trips/calendar`) và Live Platform Telemetry (`GET /api/trails/stats/summary`).
* [x] **Full Owner CRUD & Củng Cố Bảo Mật Production**: Đầy đủ sửa/xóa chính chủ cho Diễn đàn, Bình luận, Đánh giá, Nhật ký hành trình, Tình trạng đường và Lịch trình (0 `window.confirm()`); tách chặt Access/Refresh token trong `verifyToken`, khóa lỗi chiếm email tài khoản đã xóa, fail-closed auth & Socket.IO, kiểm tra Google OAuth `aud` + timeout, chỉ tra cứu token đặt lại/kích hoạt dạng băm, `sanitizeInput` không làm hỏng URL/nội dung, loại bỏ toàn bộ email PII khỏi Incident, giới hạn quyền truy cập phòng đoàn, PBKDF2 & gzip bất đồng bộ, partial unique index cho `GearChecklist`, lọc NASA EONET theo vùng Việt Nam, lọc `status: 'approved'` cho danh sách cung công khai, sửa cache offline pack trong `sw.js`, chuẩn hóa Dual-Theme CSS tokens + `color-mix()` + Z-Index Ladder + Pure SVG (0 emoji, 0 hex/rgba chết).

---

### 🌐 Phase 10 — Siêu Ứng Dụng Thực Địa: 30 Cung DEM, AI 4 Chế Độ + Photo Triage/SSE/TTS, Live Family Beacon & 3D Fly-Through (Done)
> **Lý do thiết kế**: Mở rộng độ phủ địa lý toàn quốc lên 30 cung đường thực địa kiểm chuẩn SRTM-30m/Copernicus DEM, bổ sung chia sẻ vị trí trực tiếp cho gia đình, phân tích ảnh đa phương thức, bay 3D dọc sống núi và tối ưu toàn diện trải nghiệm xã hội – quyết toán đoàn – in ấn hồ sơ.

* [x] **Mở Rộng Dữ Liệu Thực Địa 24 → 30 Cung DEM + 8 Thử Thách + 25 Kiểm Lâm + 10 HDV**: Bổ sung 6 tuyến kiểm chuẩn SRTM-30m DEM & 100% ảnh HTTP 200 gồm **Khang Su Văn / Phàn Liên San (3.012m & Cột Mốc 79)**, **Nam Kang Ho Tao (2.881m)**, **VQG Ba Vì (Đỉnh Vua 1.296m)**, **Chùa Đồng Yên Tử (1.068m)**, **Đỉnh Langbiang (2.167m)** và **VQG Bù Gia Mập (Đắk Ka – Thác Lưu Ly)** (114 waypoint, đồng bộ SHA-256 Client/Server); bổ sung 2 bộ thử thách (`ngu-dai-dinh-3000m`, `cuoi-tuan-luyen-the-luc`), BQL Di tích & Rừng QG Yên Tử (`0203.651.8888`), Trung tâm GDMT VQG Ba Vì (`0966.173.119`) và đồng bộ `SummitAltitudeLadder`.
* [x] **Radar Thời Tiết Đỉnh Trực Tiếp & So Sánh Thời Tiết 3 Ngày (`SummitWeatherRadar` + `/api/weather/summits-live` + `/api/weather/compare`)**: Bảng điều kiện nhiệt độ thực đỉnh núi (lapse-rate + windchill + xác suất săn mây) nhúng trong `SeasonAlmanacView`; so sánh thời tiết đỉnh 3 ngày song song + biểu đồ chồng cao độ DEM thuần SVG trong `TrailComparisonModal`.
* [x] **LOST Alpine AI 4 Chế Độ — SSE Streaming, TTS `vi-VN`, Photo Triage & Expedition Dossier**: Bổ sung truyền phát `POST /api/ai/chat/stream`, đọc giọng nói tiếng Việt (`speechSynthesis`), phân tích ảnh thực địa đa phương thức `POST /api/ai/analyze-image` (nén canvas <=1024px, kiểm tra magic bytes, cảnh báo an toàn nấm/rắn/sơ cứu), chip gợi ý ngữ cảnh và chế độ thứ 4 **Hồ Sơ Chuyến Đi In Ấn Được** (`POST /api/ai/expedition-brief` + `AiExpeditionBriefTab`).
* [x] **Đèn Hiệu Gia Đình Trực Tuyến (`/api/live-beacons` + `/beacon/:token`) & Quản Lý Bộ Nhớ Offline**: Cho phép người leo phát liên kết theo dõi vị trí trực tiếp từ `LiveTrekTrackerModal` (hỗ trợ cả **Cung Tự Vẽ** từ `RoutePlannerView`), xem tiến trình & cảnh báo mất tín hiệu >45 phút qua `LiveBeaconViewerPage`, TTL tự hủy sau 48 giờ; bổ sung tab thứ 6 **Bộ Nhớ Offline** (`OfflineStoragePanel`) trong `FieldToolkitView`.
* [x] **3D Terrain Fly-Through, Phân Chặng Waypoint & Lọc Bản Đồ Nhanh**: Chế độ bay dọc sống núi GPX 3D (`Terrain3DModal` Play/Pause + thanh tua 0–100%), **Bảng Phân Chặng Theo Mốc (Leg Splits)** kèm sao chép trong `RoutePlannerView`, lọc nhanh `Đỉnh >2.500m` / `Người Mới` / `Gần Tôi 50–150–300km` trên `MapView`, và cụm **4 Cung Lân Cận Kết Hợp** (`GET /api/trails/:id/nearby-trails`) trong `TrailDetailView`.
* [x] **Hệ Sinh Thái Xã Hội, Quyết Toán Nợ Đoàn, Wishlist Thư Mục & Mục Tiêu 2026**: Tab **Hoạt Động Cộng Đồng** (`GET /api/activities/community`) & danh sách **Người Theo Dõi / Đang Theo Dõi** (`AuthorProfileModal`); thuật toán **Ai Trả Ai — Tối Ưu Giao Dịch VND** trong `SquadWorkspaceModal`; phím tắt `Ctrl+Enter` & ghim Câu Trả Lời Hữu Ích trong `ThreadDetailModal`; thư mục Wishlist + tháng dự kiến + ghi chú (`PATCH /api/saved-trails/:trailId`), **Vòng Mục Tiêu Trekking 2026** (SVG thuần trong `ProfileAnalyticsPanel`), nâng chuẩn tương phản WCAG AA & stylesheet in ấn `@media print`.

---

### 🧭 Phase 11 — 36 Cung DEM, Trí Tuệ Pace & Dinh Dưỡng AI, Field POIs, Cảnh Báo Thời Tiết, GIS Studio & Chuẩn Mực 0-Warning A11y (Done)
> **Lý do thiết kế**: Nâng cấp LOST đạt chuẩn mực sản phẩm thám hiểm cao cấp toàn diện: 0 cảnh báo ESLint toàn bộ mã nguồn, mở rộng lên 36 tuyến DEM chuẩn xác, bổ sung 2 công cụ lập kế hoạch sống còn bằng AI (Giờ Quay Đầu NOAA & Khẩu Phần/Điện Giải), lớp dữ liệu điểm thực địa cộng đồng và hệ thống phím tắt + khóa tiêu điểm đạt chuẩn WAI-ARIA.

* [x] **Mở Rộng Dữ Liệu Thực Địa 30 → 36 Cung DEM + 10 Thử Thách + 28 Kiểm Lâm (`seedData.ts`, `vietnamDirectory.ts`, `SummitAltitudeLadder.tsx`, `trekkerKnowledgeDataset.ts`)**: Bổ sung 6 tuyến kiểm chuẩn Copernicus/SRTM-30m DEM & 100% ảnh HTTP 200 gồm **Tả Liên Sơn – Đỉnh Cổ Trâu (2.996m, Top #6 Việt Nam)**, **Đỉnh Pha Luông (2.000m, Sơn La)**, **Bình Liêu – Sống Lưng Khủng Long & Cột Mốc 1305 (1.292m, Quảng Ninh)**, **VQG Cúc Phương – Đỉnh Mây Bạc (648m, Ninh Bình)**, **Khu BTTN Hòn Bà – Di Tích Bác Sĩ A. Yersin (1.578m, Khánh Hòa)** và **Núi Bà Rá – 1.767 Bậc Đá (723m, Bình Phước)** (139 waypoint, SHA-256 đồng bộ Client/Server); nâng lên **10 Thử thách** (`bien-gioi-dong-tay-bac`, `vuon-quoc-gia-di-san-vn`) và **28 trạm Kiểm lâm/VQG** (bổ sung Chi cục KL Sơn La, Chi cục KL Quảng Ninh, BQL Khu BTTN Hòn Bà & liên kết VQG Cúc Phương); chuẩn hóa số đếm động trên toàn bộ thanh điều hướng & trang chủ.
* [x] **AI Turnaround Time & NOAA Sunset Cutoff Pace Planner + AI Nutrition, Hydration & Electrolyte Planner (`POST /api/ai/pace-plan`, `POST /api/ai/fuel-plan`)**: Tính thiên văn NOAA tại tọa độ đỉnh (`UTC+7`), mốc **Giờ Quay Đầu An Toàn** theo Tobler/Naismith + tải balo (`pace_schedule_card` SVG); tính năng lượng Pandolf/ACSM, lượng nước + Oresol WHO theo nhiệt ẩm, trích xuất điểm tiếp nước thực và thực đơn thực địa Việt Nam (`fuel_plan_card` SVG), xuất đầy đủ trong tệp `.md` ngoại tuyến.
* [x] **Cảnh Báo Thời Tiết Đỉnh & Săn Mây Cá Nhân Hóa (`/api/weather-alerts` + `WeatherAlertModal` + `SummitWeatherRadar`)**: Theo dõi tối đa 10 cung/người dùng với ngưỡng mưa/gió/nhiệt độ/xác suất săn mây tùy chỉnh, tách biệt hoàn toàn cooldown cảnh báo an toàn `NO_GO` và săn mây, kiểm tra tức thì và đồng bộ trạng thái đăng nhập real-time (`lost:auth-changed`).
* [x] **Điểm Thực Địa Cộng Đồng "Thực Địa & Nước" (`/api/trail-pois` + `TrailPoiSection`) & Nhịp Đập Thực Địa (`GET /api/analytics/platform-pulse`)**: Cho phép cộng đồng đóng góp, xác nhận (`+N`) và cập nhật trạng thái nguồn nước, lán trại, sóng 4G, nguy hiểm và điểm ngắm cảnh có tọa độ WGS84 ngay trong `TrailDetailView`; hiển thị telemetry sống trên `SafetyRadarView` với SWR cache & fallback ngoại tuyến.
* [x] **Trình Tạo Thẻ PNG Hành Trình Ngoại Tuyến, Thử Tài Địa Hình & Nâng Cấp GIS Studio**: Tạo thẻ ảnh PNG `1080×1350` & `1200×630` bằng HTML5 Canvas 100% ngoại tuyến (`expeditionShareCard.ts` + `ExpeditionShareCardModal`) trong `PeakPassportView`, `LiveTrekTrackerModal` và `RoutePlannerView`; ra mắt Tab #7 **Thử Tài Địa Hình (`VietnamPeakQuizPanel`)** với trắc dọc DEM ẩn danh thuần SVG + 10 kịch bản WFA; nâng cấp `RoutePlannerView` với 1 chạm Đảo Chiều Tuyến, gắn nhãn GPX 1.1 `<wpt><sym>` và thanh Phân Tầng Độ Dốc 4 Cấp.
* [x] **Ma Trận Phân Tải Balo Đoàn, Cổng Kiểm Tra An Toàn 6 Bước & Hồ Sơ Wishlist + Xuất CSV**: Bổ sung Ma trận chia tải đồ chung có ngưỡng cân bằng động + **Cổng Kiểm Tra An Toàn Trước Giờ G (6 Bước)** trong `SquadWorkspaceModal`; nâng cấp `UserProfileView` với lọc 5 Bộ sưu tập Wishlist, chỉnh sửa ghi chú/tháng dự kiến đồng bộ server và 1 chạm **Xuất Hồ Sơ (CSV)** chuẩn RFC-4180 chống formula injection.
* [x] **Chuẩn Mực Tiếp Cận WAI-ARIA, Phím Tắt Toàn Hệ Thống & Global 0-Warning ESLint (`--max-warnings=0`)**: Triển khai `useFocusTrap.ts` (ngăn xếp LIFO cho modal lồng nhau), `ShortcutsHelpModal` (`?`), bộ phím tắt chuẩn đa nền tảng `Ctrl+K`, `?`, `Alt+A`, `Alt+T`, `/` có lọc IME tiếng Việt & modal guard, token `--color-error-text` đạt WCAG AA cả 2 chế độ Sáng/Tối, và đưa toàn bộ `client/src/` về **0 lỗi / 0 cảnh báo ESLint** qua kiểm định đối kháng liên chéo nhiều vòng.

---

### 🛡️ Phase 12 — AI Kiểm Định Sẵn Sàng `0–100`, Khí Hậu Đỉnh ERA5 3 Năm, PWA Offline Chuẩn Production, ICE Lockscreen, Cách Ly Lưu Trữ & WCAG AA Toàn Kho (Done)
> **Lý do thiết kế**: Hoàn thiện LOST ở cấp độ phát hành chính thức: kết hợp dữ liệu khí hậu lịch sử 3 năm thật (ERA5), chấm điểm sẵn sàng trước chuyến đi có khóa an toàn cứng, thẻ y tế màn hình khóa offline, PWA cài đặt chuẩn cùng kiểm định đối kháng toàn bộ 244 tệp nguồn về bảo mật lưu trữ, tiếp cận WAI-ARIA và tương phản WCAG AA.

* [x] **AI Expedition Readiness Audit (`0–100`) & 25/25 Vietnamese Adversarial Stress Suite (`aiReadinessAudit.service.ts`, `POST /api/ai/readiness-audit`, `AiRichCards.tsx`, `AiExpeditionBriefTab.tsx`)**: Hợp nhất Go/No-Go thời tiết sống, NOAA Pace, Pandolf Fuel/Oresol (dùng nhiệt ẩm sống), tỷ lệ tải balo/cơ thể và thời hạn giấy phép VQG/biên giới thành điểm `0–100` qua 4 trụ cột có trọng số kèm khóa trần an toàn cứng (không bao giờ cấp `READY` khi thiếu dữ liệu thời tiết sống hoặc `NO_GO`); tích hợp thẻ SVG `readiness_audit_card`, dải tính nhanh trong `AiExpeditionBriefTab`, xuất `.md`, và kiểm chứng **25/25 kịch bản đối kháng** + **36/36 ma trận cung (`108/108` lượt chạy sạch)**.
* [x] **Khí Hậu Đỉnh Lịch Sử Open-Meteo ERA5 3 Năm (`GET /api/weather/climate/:trailId` + `SummitClimateChart.tsx`)**: Tổng hợp 3 năm đầy đủ (`2023–2025`) từ `archive-api.open-meteo.com` với hiệu chỉnh lapse-rate `-6.5°C/1000m`, chuẩn hóa mẫu mưa/ngày mưa theo `MONTH_AVG_DAYS`/`MONTH_MAX_DAYS`, bộ đệm SWR 24 giờ gắn khóa tọa độ/cao độ + backoff 45s khi lỗi lạnh; hiển thị biểu đồ SVG hai trục tương tác bàn phím ngay trong `TrailDetailView` và `SeasonAlmanacView`.
* [x] **Mục Tiêu Năm Đồng Bộ Đám Mây (`GET/PATCH /api/users/me/goals` + `ProfileAnalyticsPanel.tsx`)**: Lưu `annualGoals` trong `UserModel` với cập nhật nguyên tử MongoDB `$ifNull`, tách riêng giới hạn tốc độ đọc (`120/15m`) và ghi (`30/15m`), hiển thị **3 Vòng Tiến Độ SVG Thuần** (Quãng đường, Độ cao nâng, Chinh phục đỉnh) cùng trình chỉnh sửa trực tiếp & bộ đệm riêng theo từng `userId`.
* [x] **Thẻ Y Tế Khẩn Cấp ICE Màn Hình Khóa PNG Ngoại Tuyến (`1080×1920`) & Vật Lý Khí Quyển ISA (`iceLockscreenCard.ts` + `FieldToolkitView.tsx`)**: Dựng PNG màn hình khóa `1080×1920` bằng Canvas đọc token sống `[data-theme]` (chỉ lưu cục bộ theo `userId`, 0 gửi PII y tế lên máy chủ); bổ sung thẻ tham chiếu áp suất khí quyển ISO 2533, điểm sôi nước NIST Antoine (`100.0°C` → `89.6°C` tại Fansipan `3.143m`) và đường cong SVG oxy hiệu dụng `pO₂`.
* [x] **Xuất Bảng Khai Báo Kiểm Lâm CSV (`SquadWorkspaceModal.tsx`) & Nâng Cấp Nhật Ký Hành Trình (`TripReportDetailModal.tsx`)**: Xuất CSV chuẩn UTF-8 BOM chống OWASP formula injection cho trạm VQG/Kiểm lâm từ danh sách đoàn, trang bị chung & Cổng An Toàn 6 Bước; bổ sung thời gian đọc `~N phút đọc`, Lightbox khóa tiêu điểm LIFO (`←`/`→`) và nút mở thẳng trang cung đường.
* [x] **PWA Cài Đặt Chuẩn Production (`manifest.json`, `favicon.svg`, `sw.js` `lost-static-v2`, `offlinePack.ts`)**: Tạo `manifest.json` `standalone` + lối tắt thực địa, đồng bộ `favicon.svg` Field-Atlas Pine Green, thu hẹp `sw.js` chỉ đệm máy chủ bản đồ 2D hợp lệ (loại trừ Terrarium 3D DEM, giới hạn dung lượng tile/opaque), và gói tải Offline theo hành lang polyline GPX kèm CORS sạch.
* [x] **Cách Ly Lưu Trữ Theo Tài Khoản (`storageScope.ts`), 40-Portal LIFO `useFocusTrap` & 100% WCAG AA Toàn Kho (`244` tệp, `0` ESLint warnings)**: Dọn sạch toàn bộ khóa nhạy cảm & xoay vòng `lost_client_session_id` khi đăng xuất/`401`/khóa tài khoản; chấm dứt đổ `lost_contributions` toàn cục; phủ LIFO `useFocusTrap` + `isTopmostFocusTrap` + `e.isComposing` khắp 40 bề mặt modal/drawer/lightbox; bỏ `!important` trên `.modal-overlay` + thêm `--z-modal-nested: 3100`; nâng cấp 100% chữ lỗi sang `--color-error-text`, đồng bộ `46/46` ảnh HTTP `200`, SHA-256 `seedData.ts`/`vietnamDirectory.ts` và xác nhận `0` lỗi TypeScript / `0` cảnh báo ESLint toàn dự án.
