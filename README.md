# LOST — Nền Tảng Bản Đồ Địa Hình 3D, Thực Địa Offline & Trí Tuệ Thám Hiểm Việt Nam

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0%2F7.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.1-purple.svg)](https://vitejs.dev/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre%20GL-6.19-teal.svg)](https://maplibre.org/)
[![Express](https://img.shields.io/badge/Express-5.2-green.svg)](https://expressjs.com/)
[![Mongoose](https://img.shields.io/badge/Mongoose-9.8-brightgreen.svg)](https://mongoosejs.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-CDN-orange.svg)](https://cloudinary.com/)

**LOST** là siêu ứng dụng bản đồ địa hình 3D, điều phối chuyến đi, an toàn thực địa offline và trợ lý AI đa phương thức dành riêng cho cộng đồng trekking tại Việt Nam. Toàn bộ cơ sở dữ liệu gồm **36 cung đường trekking thực địa đã kiểm chuẩn Copernicus / SRTM-30m DEM** (19 Miền Bắc, 8 Miền Trung, 9 Miền Nam; 139 waypoint định vị), **28 trạm VQG / Kiểm lâm / Cứu hộ CNCH xác thực**, **10 trung tâm dịch vụ dẫn đường chính quy của các VQG/KBT** và **10 bộ sưu tập Thử thách Chinh phục Đỉnh Việt Nam** — cam kết 100% dữ liệu địa lý thật.

---

## Tính Năng Cốt Lõi

### 1. Bản Đồ Địa Hình 3D Fly-Through & 36 Cung Đường Thực Địa Việt Nam
- **36 cung đường thực địa chuẩn hóa 100%**:
  - **19 cung Miền Bắc**: Fansipan (3.143m), Pu Si Lung (3.083m), Pu Ta Leng (3.049m), Bạch Mộc Lương Tử – Kỳ Quan San (3.046m), Khang Su Văn – Phàn Liên San & Cột Mốc 79 (3.012m), **Tả Liên Sơn – Đỉnh Cổ Trâu (2.996m)**, Tà Chì Nhù (2.979m), Nhìu Cồ San (2.965m), Lùng Cúng (2.913m), Nam Kang Ho Tao (2.881m), Tà Xùa (2.865m), Lảo Thẩn (2.860m), Ngũ Chỉ Sơn (2.858m), Tây Côn Lĩnh (2.428m), **Đỉnh Pha Luông – Mộc Châu (2.000m)**, VQG Ba Vì (1.296m), **Bình Liêu – Sống Lưng Khủng Long & Cột Mốc 1305 (1.292m)**, Đỉnh Chùa Đồng Yên Tử (1.068m), **VQG Cúc Phương – Đỉnh Mây Bạc (648m)**.
  - **8 cung Miền Trung**: Chư Yang Sin (2.442m), Pù Luông (1.700m), **Khu BTTN Hòn Bà – Di Tích Bác Sĩ A. Yersin (1.578m)**, Bạch Mã (1.450m), VQG Núi Chúa (1.039m), Thác K50 Kon Chư Răng (1.020m), Giếng Trời Đà Nẵng (480m), Cực Đông Mũi Đôi (145m).
  - **9 cung Miền Nam**: Bidoup – Núi Bà (2.287m), Đỉnh Langbiang (2.167m), Tà Năng – Phan Dũng (1.100m), Núi Bà Đen (986m), Núi Chứa Chan (837m), **Núi Bà Rá – 1.767 Bậc Đá & Hồ Thác Mơ (723m)**, VQG Bù Gia Mập – Đắk Ka & Thác Lưu Ly (660m), Núi Dinh (504m), VQG Cát Tiên – Bàu Sấu (168m).
- **Bản đồ kép Leaflet 2D + MapLibre GL 3D WebGL Terrain (`Terrain3DModal`)**: tích hợp chế độ **Bay Dọc Tuyến 3D (Fly-Through)** mượt mà theo sống núi GPX, bộ lọc nhanh **Đỉnh >2.500m / Người Mới (≤2) / Bán kính Gần Tôi 50–150–300km**, cụm gợi ý **4 cung lân cận kết hợp** (`GET /api/trails/:id/nearby-trails`), **Điểm Thực Địa Cộng Đồng "Thực Địa & Nước"** (`/api/trail-pois` + `TrailPoiSection`: nguồn nước, lán trại, sóng 4G, nguy hiểm, điểm ngắm cảnh có tọa độ WGS84 & xác nhận cộng đồng), **Biểu Đồ Khí Hậu Thực Tế 12 Tháng ERA5 (`GET /api/weather/climate/:trailId` + `SummitClimateChart`)** từ dữ liệu Open-Meteo ERA5 3 năm (`2023–2025`, hiệu chỉnh lapse-rate `-6.5°C/1000m`), và **So Sánh Đa Cung** với biểu đồ chồng đường cong cao độ DEM thuần SVG + bảng **Dự Báo Thời Tiết Đỉnh 3 Ngày Trực Tiếp** (`GET /api/weather/compare`).
- **PWA Chuẩn Cài Đặt, Gói Tải Offline Theo Hành Lang GPX & Bộ Nhớ Offline (`manifest.json`, `sw.js`, `OfflineStoragePanel`)**: Manifest cài đặt `standalone` kèm lối tắt thực địa, `favicon.svg` Pine Green đồng bộ Field-Atlas, Service Worker `lost-static-v2` cho phép đúng danh sách máy chủ bản đồ 2D (loại trừ hoàn toàn DEM Terrarium 3D khỏi bộ đệm 2D và giới hạn dung lượng tile/opaque), cùng gói tải Offline theo hành lang polyline GPX (`offlinePack.ts`) lưu vào IndexedDB + Cache API cho vùng mất sóng 4G.

### 2. Hệ Sinh Thái 8 Flagship Field-Atlas Hubs (`ExpeditionHubBar`)
1. **Hộ Chiếu Đỉnh, 10 Thử Thách & Thẻ PNG Hành Trình (`PeakPassportView` + `ExpeditionShareCardModal`)**: Xác thực check-in GPS/GPX, bảng xếp hạng chinh phục đỉnh, **10 bộ sưu tập thử thách** (gồm **Ngũ Đại Đỉnh >3.000m**, **Cột Mốc Biên Cương Việt Nam** & **Vườn Quốc Gia Di Sản 3 Miền**), mã QR Hộ chiếu chuẩn ISO/IEC 18004 dựng bằng SVG thuần (`qrMatrix.ts`) và **Trình Tạo Thẻ Ảnh PNG Ngoại Tuyến 100%** (`1080×1350` Story & `1200×630` Ngang bằng Canvas không CORS taint).
2. **Lịch Mùa 12 Tháng, Khí Hậu Đỉnh ERA5 3 Năm, Radar Thời Tiết Đỉnh & Cảnh Báo Cá Nhân (`SeasonAlmanacView` + `SummitClimateChart` + `SummitWeatherRadar` + `WeatherAlertModal`)**: Tích hợp trực tiếp **Khí Hậu Thực Tế 12 Tháng ERA5 (3 Năm)** với biểu đồ SVG hai trục (nhiệt độ đỉnh °C & lượng mưa mm), **Radar Thời Tiết & Săn Mây Top Đỉnh Cao Việt Nam** (`GET /api/weather/summits-live`, lapse-rate `-6.5°C/1000m` & windchill), **Cảnh Báo Thời Tiết & Săn Mây Cá Nhân Hóa** (`/api/weather-alerts`, tách biệt cooldown an toàn `NO_GO` vs săn mây), ma trận 12 tháng × 36 cung và đánh giá AI Go/No-Go tức thì.
3. **GIS Studio — Thiết Kế GPX, Đảo Chiều, Phân Tầng Độ Dốc 4 Cấp & Thẻ PNG (`RoutePlannerView`)**: Chấm điểm trên bản đồ Leaflet, **1 chạm Đảo Chiều Tuyến (Reverse)**, gắn nhãn mốc tọa độ (`start` / `summit` / `water` / `camp` / `caution`) xuất chuẩn GPX 1.1 `<wpt><sym>`, **Thanh Phân Tầng Độ Dốc 4 Cấp (`<5%`, `5–12%`, `12–20%`, `>20%`)**, **Bảng Phân Chặng Theo Mốc (Leg Splits)**, tính Naismith/Tobler ETA, xuất **Thẻ PNG Tuyến Tự Vẽ**, lưu/chia sẻ link tuyến (`/planner?route=<slug>`) và chuyển thẳng sang Biểu mẫu Đóng góp 5 bước.
4. **Bộ Công Cụ Sinh Tồn Offline 100%, Thẻ Y Tế ICE Màn Hình Khóa, Vật Lý Khí Quyển ISA & Thử Tài Địa Hình (`FieldToolkitView` + `iceLockscreenCard.ts` + `VietnamPeakQuizPanel`)**: **7 tab WAI-ARIA** (đồng bộ URL `?tab=` & điều hướng `ArrowLeft`/`ArrowRight`/`Home`/`End`) — La bàn SVG/WGS84-DMS kèm **Thẻ Tham Chiếu Áp Suất Khí Quyển ISA & Đường Cong Điểm Sôi / Oxy (`pO₂`) SVG** (`0m → 3.143m`, chuẩn ISO 2533 & NIST Antoine), Cung Mặt Trời NOAA (`solarMath.ts`), Bio-Calc, SOS 2G + Đèn Morse + Còi 3.1kHz + **Trình Tạo Thẻ Y Tế Khẩn Cấp ICE Màn Hình Khóa PNG `1080×1920` Ngoại Tuyến 100%** (chỉ lưu cục bộ theo tài khoản, 0 gửi PII y tế lên server), **Học Viện Sinh Tồn 8 Kịch Bản**, **Bộ Nhớ Offline**, và **Thử Tài Địa Hình Việt Nam** (biểu đồ trắc dọc DEM ẩn danh thuần SVG + 10 kịch bản WFA + kỷ lục ngoại tuyến).
5. **Danh Bạ 28 Trạm Kiểm Lâm, 10 Đơn Vị Dẫn Đường Chính Quy & Dự Toán Chi Phí (`DirectoryCostView`)**: Tra cứu 28 đầu mối VQG/Kiểm lâm/CNCH (ghim cố định 112/114/115/113), gửi yêu cầu đặt lịch dẫn đoàn tới 10 đơn vị VQG/KBT (`/api/directory/inquiries`, bộ đệm cục bộ tách riêng theo tài khoản), và máy tính dự toán VND chi tiết cho toàn bộ **36 cung DEM** kèm chuyển nhanh sang lập đoàn ghép nhóm.
6. **Giáo Án Thể Lực 4 / 6 / 8 Tuần (`TrainingPlannerView`)**: Sinh lộ trình tập luyện tăng tải lũy tiến & giảm tải (taper) theo cao độ 36 đỉnh mục tiêu, đồng bộ `/api/training-plans` + `localStorage` kèm xác nhận xóa 2 bước nội tuyến, vòng Readiness Ring & biểu đồ tích lũy cao độ tuần SVG thuần thích ứng di động.
7. **Tối Ưu Trọng Lượng Balo & Cầu Nối Pace AI (`GearOptimizerView`)**: Quản lý tủ đồ theo chuẩn LighterPack, biểu đồ tròn phân bổ trọng lượng SVG, đồng bộ đám mây (`/api/gear-packs`), chia sẻ link balo (`?pack=<slug>`) và phóng thẳng tổng tải balo sang **AI Lập Kế Hoạch Tốc Độ & Giờ Quay Đầu**.
8. **Radar An Toàn Toàn Quốc & Nhịp Đập Thực Địa (`SafetyRadarView`)**: Ma trận rủi ro vùng miền SVG, dải **Nhịp Đập Thực Địa Việt Nam** trực tiếp (`GET /api/analytics/platform-pulse` — sự cố mở, đoàn ghép, Field POIs xác thực, tổng km cộng đồng & Top Đỉnh Đang Hot), giám sát tình trạng đường mòn và cảnh báo thiên tai NASA EONET khu vực Việt Nam.

### 3. LOST Alpine Intelligence Suite (Trợ Lý AI Thực Địa 4 Chế Độ + Kiểm Định Sẵn Sàng `0–100`)
- **4 chế độ tác nghiệp chuyên sâu (`TrekAssistantModal`)** đã kiểm chứng **25/25 kịch bản đối kháng tiếng Việt** (cấp cứu P0 3 miền, gõ không dấu/sai chính tả, prompt injection, GPX lỗi, ảnh giả mạo) & **36/36 ma trận cung (`108/108` lượt chạy sạch)**:
  1. **Chat Đa Phiên SSE Streaming, TTS `vi-VN`, Kiểm Định Sẵn Sàng `0–100`, Giờ Quay Đầu NOAA & Khẩu Phần Dinh Dưỡng**:
     - Truyền phát trực tiếp (`POST /api/ai/chat/stream`), lưu hội thoại MongoDB (`AiChatThreadModel`), nhập/đọc giọng nói `vi-VN` và xuất báo cáo `.md`.
     - **AI Expedition Readiness Audit (`POST /api/ai/readiness-audit` + thẻ SVG `readiness_audit_card`)**: chấm điểm tổng hợp **0–100** qua 4 trụ cột có trọng số (An toàn thời tiết 30%, Tốc độ & Ánh sáng NOAA 25%, Tải balo & Thể lực 25%, Bù nước & Giấy phép 20%) kèm **khóa trần an toàn cứng** (không bao giờ cấp `READY` khi thiếu dữ liệu thời tiết sống hoặc `NO_GO`) và danh sách việc cần xử lý trước giờ G.
     - **AI Turnaround Time & NOAA Sunset Cutoff Pace Planner (`POST /api/ai/pace-plan` + thẻ SVG `pace_schedule_card`)**: tính thiên văn NOAA tại đỉnh núi (`UTC+7`), mốc **Giờ Quay Đầu An Toàn** (giữ biên ≥30 phút trước hoàng hôn) và cảnh báo đèn đội đầu theo tải balo & độ dốc Tobler/Naismith.
     - **AI Nutrition, Hydration & Electrolyte Planner (`POST /api/ai/fuel-plan` + thẻ SVG `fuel_plan_card`)**: tính năng lượng Pandolf/ACSM, định mức nước theo nhiệt ẩm thực tế & gói Oresol WHO, điểm tiếp nước thực từ 65 waypoint suối/lán và thực đơn thực địa Việt Nam (`standard` / `vegetarian` / `ultralight`) kèm dự toán VND khớp tuyệt đối `0đ`.
  2. **Phân Tích Ảnh Thực Địa Đa Phương Thức (`POST /api/ai/analyze-image`)**: đính kèm ảnh chụp thực địa (tự động nén canvas <=1024px JPEG, xác thực magic bytes trên server) kèm cảnh báo an toàn bắt buộc khi nhận diện nấm dại, rắn hoặc chấn thương.
  3. **Gợi Ý Cung Thông Minh (`/api/ai/recommend`) & Kiểm Toán Balo (`/api/ai/audit-pack`)**: áp dụng danh sách trang bị 1 chạm vào Checklist của cung đường.
  4. **Hồ Sơ Chuyến Đi In Ấn Được & Thanh Công Cụ Nhanh (`POST /api/ai/expedition-brief` + `AiExpeditionBriefTab`)**: tích hợp dải tính nhanh **Kiểm Tra Sẵn Sàng (0–100)**, **Giờ Quay Đầu NOAA** & **Nước & Oresol** ngay trên biểu mẫu, tổng hợp trọn gói Go/No-Go, kiểm lâm, lịch trình, checklist & ngân sách VND — in sắc nét theo `@media print`.

### 4. Máy Tính GPS Thực Địa, Đèn Hiệu Gia Đình `/beacon/:token`, Cộng Đồng, Cách Ly Lưu Trữ & Khả Năng Tiếp Cận (A11y)
- **Live GPS Tracker, Thẻ PNG Thực Địa & Đèn Hiệu Gia Đình (`/beacon/:token`)**: Ghi vết GPS thời gian thực (`LiveTrekTrackerModal`, hỗ trợ cả **Cung Tự Vẽ** từ Route Planner), xuất **Thẻ PNG Hành Trình** từ chính tracklog ghi được, cảnh báo lệch cung > 100m, phát **Liên Kết Chia Sẻ Vị Trí Cho Người Thân (`/beacon/:token`)** với TTL 48h, tự cảnh báo mất tín hiệu > 45 phút, Dead-Man's Switch (`SafetyTimerModel`) và xuất GPX 1.1.
- **Khả Năng Tiếp Cận Toàn Diện (40 Cổng Modal LIFO) & Cách Ly Dữ Liệu Theo Tài Khoản (`useFocusTrap` + `storageScope.ts`)**:
  - Ngăn xếp khóa tiêu điểm LIFO (`useFocusTrap` + `isTopmostFocusTrap`) kèm bộ lọc IME tiếng Việt (`e.isComposing`) phủ toàn bộ **40 bề mặt portal/modal/drawer**, không còn `!important` ghi đè `z-index`, bổ sung tầng `--z-modal-nested: 3100`.
  - **Cách ly bộ nhớ cục bộ theo `userId` (`storageScope.ts`)**: tự động dọn sạch khóa nhạy cảm (`clearSensitiveSessionStorage()`), xoay vòng `lost_client_session_id` (`rotateClientSessionId()`) khi đăng xuất / `401` / khóa tài khoản, chấm dứt hoàn toàn rò rỉ dữ liệu liên tài khoản trên thiết bị dùng chung.
  - **Bảng Phím Tắt (`?`)**, **Bảng Lệnh Toàn Cục (`Ctrl+K`)** tìm không dấu trên toàn bộ 36 cung đường / 8 Hub / 28 trạm kiểm lâm / LOST AI, bật/tắt LOST AI (`Alt+A`), đổi giao diện Tối/Sáng (`Alt+T`), tìm nhanh (`/`).
- **Cộng Đồng, Không Gian Đoàn & Hồ Sơ Cá Nhân**:
  - **Dòng Hoạt Động Cộng Đồng (`GET /api/activities/community`)** & **Mạng Lưới Người Theo Dõi (`/followers`, `/following`)**.
  - **Không Gian Đoàn (`SquadWorkspaceModal`)**: phòng chat đoàn realtime, **Ma Trận Phân Tải Đồ Chung Cân Bằng Động**, **Cổng Kiểm Tra An Toàn Trước Giờ G (6 Bước)**, thuật toán **Ai Trả Ai — Tối Ưu Giao Dịch VND** kèm xuất Zalo 1 chạm và **1 chạm Xuất Bảng Khai Báo Kiểm Lâm (CSV)** chuẩn UTF-8 BOM chống OWASP formula injection.
  - **Nhật Ký Hành Trình (`TripReportDetailModal`)**: ước lượng thời gian đọc (`~N phút đọc`), Lightbox ảnh khóa tiêu điểm LIFO điều hướng phím `←` / `→` và nút nhảy thẳng tới trang cung đường.
  - **Hồ Sơ Wishlist Bộ Sưu Tập, Xuất CSV & Mục Tiêu Năm Đồng Bộ Đám Mây (`UserProfileView` + `ProfileAnalyticsPanel`)**: lọc 5 bộ sưu tập Wishlist đồng bộ `PATCH /api/saved-trails/:trailId`, **1 chạm Xuất Hồ Sơ Leo Núi (CSV)**, và **Mục Tiêu Trekking Năm Đồng Bộ Đám Mây (`GET/PATCH /api/users/me/goals`)** hiển thị 3 vòng tiến độ SVG thuần (Quãng đường, Độ cao nâng, Chinh phục đỉnh) có chỉnh sửa trực tiếp & đồng bộ đa thiết bị.
  - **Full Owner CRUD** (Diễn đàn kèm `Ctrl+Enter` & ghim Câu Trả Lời Hữu Ích, Nhật ký hành trình, Đánh giá, Tình trạng đường, Điểm thực địa POI, Lịch trình — 0 `window.confirm()`).
  - **Cổng Kiểm Duyệt BQT (`AdminDashboardView`)** & Telemetry thời gian thực (`GET /api/trails/stats/summary`, `GET /api/analytics/platform-pulse`).

---

## Công Nghệ Sử Dụng (Tech Stack)

### Frontend (`client/`)
- **Core**: React 19, TypeScript 6, Vite 8.1 (Rolldown code-splitting), ESLint 10 (**`--max-warnings=0`, 0 lỗi & 0 cảnh báo trên toàn bộ 244 tệp mã nguồn**).
- **Design System**: Field-Atlas **v4.3** Dual-Theme CSS Design Tokens (`[data-theme="dark"]` Obsidian Slate / `[data-theme="light"]` Field Paper đạt **100% chuẩn tương phản WCAG AA/AAA** toàn kho mã nguồn với `--color-error-text` `8.10:1` Dark / `7.18:1` Light và chữ nút nền đặc `--color-on-primary` / `--color-on-danger`), `color-mix()` surfaces, thang z-index 9 bậc (`--z-map-hud`..`--z-modal-nested`..`--z-toast`), khóa tiêu điểm modal LIFO (`useFocusTrap`) & bộ lọc IME tiếng Việt (`e.isComposing`), chế độ in ấn `@media print`, 1 font chữ duy nhất chuẩn tiếng Việt (**Plus Jakarta Sans**) và 100% Vector SVG thuần (0 emoji, 0 thư viện biểu đồ ngoài).
- **Map, PWA & Offline**: Leaflet 1.9, React-Leaflet 5, Marker Cluster, MapLibre GL 6.19 (3D WebGL DEM + Fly-Through), Installable PWA (`manifest.json` + Field-Atlas `favicon.svg` + Terrarium-safe `sw.js` `lost-static-v2`), CORS Polyline Offline Pack (`IndexedDB` + Cache API), Canvas PNG Share Card & ICE Lockscreen Generator ngoại tuyến (`1080×1920`).
- **Realtime & Media**: Socket.IO Client 4.8, Cloudinary CDN URL Transformer (`46/46` ảnh xác thực HTTP `200`).

### Backend (`server/`)
- **Runtime**: Node.js (`>= 18`), Express 5.2 (TypeScript 7 ESM).
- **Database**: MongoDB với Mongoose 9.8 ODM (`2dsphere` geospatial index, text search tiếng Việt `default_language: 'none'`, partial unique indexes, TTL indexes, 37 Mongoose models gồm `WeatherAlertSubModel`, `TrailPoiModel` & `UserModel.annualGoals`).
- **Security & Auth**: Custom HMAC JWT với `HttpOnly` Refresh Token rotation & tách biệt chặt `access`/`refresh`, PBKDF2-HMAC-SHA512 bất đồng bộ, xác thực Google OAuth (`aud` check), RBAC + Owner middleware, tách riêng rate-limiter đọc/ghi (`120/15m` vs `30/15m`) cho `/api/users/me/goals`, kiểm tra magic bytes ảnh upload, non-corrupting sanitization, fail-closed auth & Socket.IO, Cloudinary chống SSRF/LFI.
- **Integrations**: Cloudinary v2 SDK, Socket.IO 4.8, Nodemailer 9, Open-Meteo Weather, Elevation & **ERA5 3-Year Historical Archive API** (`archive-api.open-meteo.com`, 24h SWR + 45s cold-failure backoff), NASA EONET (Vietnam bbox), Gemini Multimodal API (tùy chọn).

---

## Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Yêu Cầu Tiền Đề
- Node.js `>= 18.0.0` (khuyến nghị Node 20+ / 22+).
- MongoDB đang chạy cục bộ (`mongodb://127.0.0.1:27017/lost`) hoặc MongoDB Atlas.

### 2. Cài Đặt Dependencies
```bash
git clone https://github.com/Hoang-124/LOST.git
cd LOST

npm install
npm --prefix client install
npm --prefix server install
```

### 3. Cấu Hình Biến Môi Trường (`server/.env`)
Tạo tệp `.env` trong thư mục `server/`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/lost
JWT_SECRET=thay-bang-chuoi-bi-mat-manh-cho-moi-truong-cua-ban
CLIENT_URL=http://localhost:5173

# Cloudinary CDN Credentials (tùy chọn khi chạy local, bắt buộc cho upload ảnh)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Tùy chọn nâng cao (Google OAuth, SMTP Email, Gemini AI)
GOOGLE_CLIENT_ID=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
GEMINI_API_KEY=
```

### 4. Khởi Chạy, Nạp Dữ Liệu & Kiểm Chứng
```bash
# Khởi chạy đồng thời Server (Port 5000) và Client (Port 5173)
# Server tự động seed idempotent: 36 cung DEM, 28 trạm VQG, 10 dẫn đường, 10 thử thách, kho tri thức AI
npm run dev

# Hoặc chạy script seed độc lập
npm --prefix server run seed

# Build TypeScript & Vite production cho cả Server và Client
npm run build

# Kiểm tra lint Frontend
npm run lint
```

Truy cập ứng dụng tại: `http://localhost:5173`

---

## Cấu Trúc Dự Án

```text
LOST/
├── client/                              # Frontend React 19 + Vite 8 App
│   ├── public/                          # PWA manifest.json, Field-Atlas favicon.svg & Service Worker (sw.js lost-static-v2)
│   └── src/
│       ├── components/
│       │   ├── admin/                   # AdminDashboardView & Moderation Modal
│       │   ├── ai-assistant/            # LOST Alpine AI 4-Mode Suite (SSE/TTS, Readiness Audit 0–100, Pace/Fuel, Photo Triage, Expedition Brief)
│       │   ├── auth/                    # Login / Register / OTP / Google OAuth Modals
│       │   ├── common/                  # SvgIcons, CommandPaletteModal (Ctrl+K), ShortcutsHelpModal (?), ExpeditionShareCardModal, OfflineStoragePanel
│       │   ├── contribution/            # 5-Step TrailContributionWizard (GPX & Route Planner handoff)
│       │   ├── forum/                   # Diễn đàn, Hoạt Động Cộng Đồng, AuthorProfileModal (Followers/Following), ThreadDetailModal
│       │   ├── hub/                     # 8 Flagship Hubs + SummitWeatherRadar + VietnamPeakQuizPanel (ICE Lockscreen & ISA Altimeter)
│       │   ├── incidents/               # Báo cáo & cảnh báo sự cố thực địa
│       │   ├── landing/                 # Editorial Hero, HubShowcaseStrip, SummitAltitudeLadder, BentoCommandHub, SeasonExpeditionRadar
│       │   ├── layout/                  # Navbar, Footer & Theme Switcher
│       │   ├── map/                     # Leaflet 2D (Proximity/Peak Filters) & MapLibre 3D DEM Terrain (Fly-Through)
│       │   ├── messages/                # Nhắn tin 1-1 & phòng chat đoàn realtime
│       │   ├── notifications/           # Trung tâm thông báo
│       │   ├── profile/                 # Passport 3D, Wishlist Collections + CSV Export, ProfileAnalyticsPanel (Cloud Annual Goals & 3 SVG Rings)
│       │   ├── safety/                  # LiveTrekTrackerModal, LiveBeaconViewerPage (/beacon/:token), SafetyTimerModal, EmergencyContactsModal
│       │   ├── search/                  # Bộ lọc nâng cao & tìm kiếm tiếng Việt không dấu
│       │   ├── trail/                   # TrailCard, TrailDetailView (Nearby Trails, TrailPoiSection & ERA5 Climate), TrailComparisonModal
│       │   ├── trip-reports/            # Nhật ký hành trình, TripReportDetailModal (Reading Time, LIFO Lightbox & Trail Jump) & Owner CRUD
│       │   ├── trips/                   # Ghép đoàn, ExpeditionCalendarGrid, SquadWorkspaceModal (Gear Matrix, 6-Step Gate, Ranger CSV & Debt)
│       │   └── weather/                 # SummitClimateChart (ERA5 3-Year Dual-Axis SVG) & WeatherAlertModal
│       ├── data/                        # seedData.ts (36 trails) & vietnamDirectory.ts (10 challenges, 28 rangers, 10 guides — synced SHA-256)
│       ├── hooks/                       # useFocusTrap (LIFO 40-portal stack), useSocket
│       ├── services/                    # REST API clients (ERA5 Climate, Cloud Goals), AI SSE/Pace/Fuel/Readiness service, Socket.IO
│       ├── utils/                       # storageScope.ts, iceLockscreenCard.ts, offlinePack.ts, routeMetrics.ts, expeditionShareCard.ts, solarMath.ts, qrMatrix.ts
│       └── App.tsx                      # Main Router, Hub Switcher, /beacon/:token, Logout Storage Wipe & Global Hotkeys (Ctrl+K, ?, Alt+A, Alt+T)
├── server/                              # Backend Express 5 + Mongoose 9 ESM Server
│   └── src/
│       ├── config/                      # MongoDB, Socket.IO & Cloudinary SDK Configuration
│       ├── controllers/                 # Domain Controllers (AI, ERA5 Weather Climate, User Annual Goals, WeatherAlert, TrailPoi, LiveBeacon, Directory...)
│       ├── data/                        # seedData.ts (36 trails), vietnamDirectory.ts, trekkerKnowledgeDataset.ts
│       ├── middleware/                  # Auth JWT, RBAC, Split Read/Write Rate Limiters, Input Sanitization
│       ├── models/                      # 37 Mongoose Schemas (User + annualGoals, Trail, WeatherAlertSub, TrailPoi, LiveBeacon, Guide, RangerStation...)
│       ├── routes/                      # Express API Routers
│       ├── scripts/                     # Standalone CLI Seeder (seed.ts)
│       ├── services/                    # AI Services (Readiness Audit, Pace, Fuel, SSE, Photo Triage, Expedition Brief, Go/No-Go)
│       ├── utils/                       # seedDatabase.ts (Idempotent Seeder), Auth Crypto, Notifications
│       └── app.ts                       # Express + Socket.IO Server Entry Point
├── DESIGN.md                            # LOST Field-Atlas Design System v4.3
├── ROADMAP.md                           # Lộ trình 13 Giai đoạn (Phase 0 – Phase 12)
└── README.md
```

---

## Tác Giả & Bản Quyền

- **Đơn vị phát triển**: LOST Expedition Team
- **GitHub Repository**: [https://github.com/Hoang-124/LOST](https://github.com/Hoang-124/LOST)
- **License**: MIT License
