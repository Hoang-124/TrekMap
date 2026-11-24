# DESIGN.md — LOST Field-Atlas Design System (v4.3)

> Ngôn ngữ thiết kế **Swiss Topographic Atlas × Field Guide** (cảm hứng Arc'teryx Veilance × National Geographic Interactive): đồng bộ **1 font chữ duy nhất** chuẩn Tiếng Việt (**Plus Jakarta Sans**), bảng màu kép đạt **100% chuẩn tương phản WCAG AA/AAA toàn kho mã nguồn** Obsidian Slate & Alpine Pine (Dark) / Field Paper & Forest Ink (Light) với token chữ cảnh báo `--color-error-text` (`8.10:1` Dark / `7.18:1` Light), bề mặt pha trộn `color-mix()`, thang `z-index` phân tầng **9 bậc** (`--z-map-hud`..`--z-modal-nested`..`--z-toast`, không còn `!important` trên `.modal-overlay`), ngăn xếp khóa tiêu điểm LIFO (`useFocusTrap` + `isTopmostFocusTrap` + bộ lọc IME `e.isComposing`) phủ toàn bộ **40 bề mặt modal/drawer/lightbox**, PWA cài đặt `standalone` (`manifest.json` + `favicon.svg` Pine Green + `sw.js` `lost-static-v2`), chế độ in ấn hồ sơ `@media print`, 100% đồ họa Vector SVG thuần & **0 cảnh báo ESLint (`--max-warnings=0` trên 244 tệp)**.

---

## 1. Bảng Màu Hai Chế Độ Sáng / Tối Chuẩn WCAG AA/AAA (`client/src/index.css`)

### Dark Mode — *Obsidian Slate & Alpine Pine* (`[data-theme="dark"]`, mặc định)
| Token | Giá trị | Vai trò |
| :--- | :--- | :--- |
| `--color-bg-main` | `#0c0f0d` | Nền đá đen ấm (obsidian charcoal) |
| `--color-bg-card` | `#141916` | Bề mặt thẻ, panel, modal |
| `--color-surface-elevated` | `#1c231f` | Thanh công cụ phụ, bề mặt nâng nhẹ |
| `--color-bg-hud` | `rgba(12, 15, 13, 0.88)` | Nền HUD phủ lên bản đồ / GPS tracker |
| `--color-bg-glass` | `rgba(14, 18, 15, 0.86)` | Bề mặt thanh điều hướng & glassmorphism trầm |
| `--overlay-bg` | `rgba(8, 11, 9, 0.82)` | Lớp phủ nền phía sau Modal / Drawer / Media scrim |
| `--color-text-main` | `#f4f3ee` | Chữ chính (trắng ngà chống lóa) |
| `--color-text-muted` | `#a8b0aa` | Mô tả phụ |
| `--color-text-dim` | `#8e9891` | Metadata, tọa độ, mốc thời gian (đã nâng chuẩn WCAG AA trên `#0c0f0d` / `#141916`) |
| `--color-on-primary` | `#07140d` | Chữ trên nút nền `--color-primary` |
| `--color-on-danger` | `#fdfcf9` | Chữ trên nút/thẻ khẩn cấp `--color-error` (>= 4.5:1) |
| `--color-on-media` | `#f6f5f0` | Chữ phủ trên ảnh thực địa (kèm scrim `--overlay-bg`) |
| `--color-primary` | `#52b788` | Xanh thông rừng trầm — hành động chính & trạng thái an toàn |
| `--color-sky` | `#6fa8c7` | Xanh sương núi — thông tin GPS, thời tiết & bản đồ |
| `--color-stream` | `#5ea8a7` | Xanh khe suối — nguồn nước, khí hậu & dữ liệu bổ trợ |
| `--color-earth` | `#d97742` | Đất đỏ Tây Nguyên — cảnh báo độ khó / địa hình |
| `--color-sun` | `#d4a348` | Vàng đồng la bàn — sao đánh giá, giờ vàng & săn mây |
| `--color-error` | `#c8473c` | Đỏ son cứu hộ chuẩn WCAG AA cho nút nền đặc / viền / đường nhấn với `--color-on-danger` |
| `--color-error-text` | `#f3968d` | Chữ & biểu tượng cảnh báo đỏ sáng trên nền tối (WCAG AA/AAA `8.10:1` trên `#141916`) |
| `--color-border` | `rgba(235, 240, 236, 0.09)` | Viền hairline tĩnh lặng |
| `--color-border-strong` | `rgba(235, 240, 236, 0.18)` | Viền nhấn cho input, card focus & đường chia cột |

### Light Mode — *Field Paper & Forest Ink* (`[data-theme="light"]`, WCAG AA/AAA)
| Token | Giá trị | Vai trò |
| :--- | :--- | :--- |
| `--color-bg-main` | `#f5f3ee` | Giấy bản đồ địa hình ấm (warm archival stone) |
| `--color-bg-card` | `#fdfcf9` | Nền thẻ trắng kem sắc nét |
| `--color-surface-elevated` | `#ece8df` | Vùng nhấn nhẹ, tab nền |
| `--color-bg-hud` | `rgba(253, 252, 249, 0.94)` | Nền HUD trên bản đồ sáng |
| `--color-bg-glass` | `rgba(253, 252, 249, 0.9)` | Bề mặt navbar kính mờ trên giấy sáng |
| `--overlay-bg` | `rgba(15, 20, 17, 0.58)` | Lớp phủ nền phía sau Modal / Drawer |
| `--color-text-main` | `#171c19` | Mực rừng đậm (tương phản WCAG AAA) |
| `--color-text-muted` | `#4a544e` | Nội dung phụ |
| `--color-text-dim` | `#5d6761` | Metadata, chỉ mục (nâng chuẩn tương phản WCAG AA trên giấy sáng) |
| `--color-on-primary` | `#fdfcf9` | Chữ sáng trên nút `--color-primary` đậm |
| `--color-primary` | `#1f6f4a` | Xanh thực vật đậm (WCAG AAA trên giấy sáng) |
| `--color-sky` | `#2c6a8e` | Xanh địa hình đậm |
| `--color-stream` | `#257a79` | Xanh suối sâu |
| `--color-earth` | `#a9461a` | Đất đỏ nung đậm (chuẩn WCAG AA trên nền sáng) |
| `--color-sun` | `#855a0d` | Vàng đồng cổ đậm (chuẩn WCAG AA trên nền sáng) |
| `--color-error` | `#b83c32` | Đỏ cứu hộ đậm cho nút nền đặc / viền / đường nhấn |
| `--color-error-text` | `#a3261d` | Chữ & biểu tượng cảnh báo đỏ đậm trên giấy sáng (WCAG AA/AAA `7.18:1` trên `#fdfcf9`) |
| `--color-border` | `rgba(23, 28, 25, 0.1)` | Viền mực hairline |
| `--color-border-strong` | `rgba(23, 28, 25, 0.2)` | Viền nhấn sắc nét |

---

## 2. Quy Tắc Bề Mặt Tương Thích Kép `color-mix()` (Zero Hardcoded Hex / Dark-Only `rgba`)
1. **Cấm tuyệt đối mã màu chết trong Component**: Mọi component React và inline style **không được phép** hardcode `#hex`, `rgb(...)` hay `rgba(...)` tĩnh (ngoại lệ duy nhất là lớp đồ họa map/canvas bên trong Leaflet/MapLibre nếu thư viện yêu cầu chuỗi màu thuần).
2. **Dùng `color-mix()` cho mọi bề mặt pha màu và trạng thái**:
   - Nền thẻ nhấn nhẹ / chip trạng thái: `color-mix(in srgb, var(--color-primary) 12%, transparent)` hoặc `color-mix(in srgb, var(--color-error) 10%, var(--color-bg-card))`.
   - Viền trạng thái tương thích 2 chế độ: `1px solid color-mix(in srgb, var(--color-sky) 32%, var(--color-border))`.
   - Bóng chữ phủ ảnh dùng `var(--overlay-bg)` thay vì `rgba(0,0,0,...)`.
3. **Không hào quang neon & không chữ gradient cầu vồng**: Tiêu đề dùng màu phẳng `var(--color-text-main)`; đổ bóng chỉ dùng token trung tính `--shadow-card` / `--shadow-3d`, bo góc gọn trong thang `--radius-md: 4px`, `--radius-lg: 6px`, `--radius-xl: 8px`.

---

## 3. Thang Phân Tầng Z-Index Chuẩn Hóa 9 Bậc (`client/src/index.css`)
Tuyệt đối **không dùng số `z-index` tùy tiện** (`9999`, `99999`, `99999999`) và **không dùng `!important`** trên `.modal-overlay` để các modal lồng nhau và ngăn kéo được phân tầng chuẩn xác. Mọi lớp nổi tuân theo đúng 9 bậc token sau:

| Token | Giá trị | Lớp UI áp dụng |
| :--- | :---: | :--- |
| `--z-map-hud` | `400` | Bảng điều khiển nổi trên Leaflet / MapLibre 3D, nút chuyển lớp, GPS HUD |
| `--z-navbar` | `1000` | Thanh điều hướng chính (sticky header) & thanh Expedition Hub dính |
| `--z-dropdown` | `1100` | Menu thả xuống, autocomplete gợi ý tìm kiếm, nút nổi AI FAB |
| `--z-grain` | `1200` | Lớp họa tiết giấy/hạt tinh tế (`pointer-events: none`) |
| `--z-drawer` | `2000` | Ngăn kéo trượt ngang (`Navbar` mobile drawer, `AdvancedFilterDrawer`, chat drawer) |
| `--z-modal` | `3000` | Mọi Modal hộp thoại chính (`CommandPaletteModal`, `ShortcutsHelpModal`, `WeatherAlertModal`, `EmergencyContactsModal`, `TrekAssistantModal`, `LiveTrekTrackerModal`, `SharedItineraryModal`, `SquadWorkspaceModal`, `TripReportDetailModal`, `ModalLoadingFallback`) — render qua `createPortal` kèm `role="dialog"`, `aria-modal="true"`, khóa tiêu điểm LIFO (`useFocusTrap`) và thoát `Escape` có `isTopmostFocusTrap` + `e.isComposing` + `stopImmediatePropagation()` |
| `--z-modal-nested` | `3100` | Hộp thoại lồng trên modal khác (`AuthModal`, `AuthorProfileModal`, `LogoutConfirmModal`, hộp thoại xác nhận quản trị lồng) |
| `--z-lightbox` | `4000` | Trình xem ảnh toàn màn hình, phóng to bản đồ & modal xuất thẻ PNG lồng trên GPS Tracker (`ExpeditionShareCardModal`) |
| `--z-toast` | `5000` | Thông báo Toast nổi trên cùng hệ thống |

---

## 4. Kiến Trúc 8 Flagship Field-Atlas Hubs, PWA, A11y & Responsive Layout
- **Thanh điều hướng 8 Hub (`ExpeditionHubBar`)**: Hợp nhất toàn bộ hệ sinh thái tác nghiệp theo bố cục Field-Atlas (số liệu hiển thị động từ danh mục 36 cung DEM / 10 thử thách / 28 trạm kiểm lâm / 10 đơn vị dẫn đường):
  `passport` (Hộ chiếu đỉnh, 10 thử thách & Thẻ PNG hành trình) · `almanac` (Lịch mùa 12 tháng, Biểu đồ Khí hậu ERA5 3 Năm, Radar thời tiết đỉnh trực tiếp & Cảnh báo thời tiết cá nhân) · `planner` (GIS Studio: GPX 1.1 `<wpt><sym>`, Đảo chiều tuyến, Phân tầng độ dốc 4 cấp, Leg Splits & Thẻ PNG) · `toolkit` (Công cụ sinh tồn 7 tab WAI-ARIA gồm Thẻ Y Tế ICE Màn Hình Khóa PNG `1080×1920`, Vật lý khí quyển ISA & Đường cong điểm sôi SVG, Học viện 8 kịch bản, Bộ nhớ Offline & Thử Tài Địa Hình DEM) · `directory` (28 Trạm Kiểm lâm, 10 HDV chính quy & Chi phí VND 36 cung) · `training` (Giáo án thể lực 4–8 tuần) · `gear` (Tối ưu balo, chia sẻ link & cầu nối Pace AI) · `radar` (Radar an toàn toàn quốc & Nhịp đập thực địa).
- **Nhịp điệu biên tập (Editorial Rhythm)**: Các khu vực chính mở đầu bằng nhãn chỉ mục nhỏ canh trái liên tiếp (`01 / ...` đến `06 / ...`), không lạm dụng pill viền dày; `HubShowcaseStrip` dùng bố cục Bento 4 thẻ trọng tâm + thanh phóng nhanh 4 hub + phím tắt `Ctrl+K`.
- **Khả Năng Tiếp Cận & Phím Tắt Chuẩn WAI-ARIA (Phủ 40 Bề Mặt Portal)**:
  - `useFocusTrap.ts` quản lý ngăn xếp LIFO để chỉ hộp thoại trên cùng khóa `Tab`/`Shift+Tab` và phản hồi `Escape` (`isTopmostFocusTrap` + `e.isComposing`), bỏ qua nhánh `[aria-hidden="true"]` / `[inert]` và khôi phục tiêu điểm an toàn khi đóng.
  - Không dùng `width: '100vw'` / `height: '100vh'` trên overlay modal (chỉ dùng `inset: 0`) và ưu tiên `100dvh` cho drawer di động để tránh lỗi thanh địa chỉ iOS/Android.
  - Quy tắc tương phản nút nền đặc: luôn cặp `--color-on-primary` trên nền `--color-primary` / `--color-sky` / `--color-earth` / `--color-sun`, chỉ dùng `--color-on-danger` trên nền đỏ `--color-error`, và dùng `--color-error-text` cho toàn bộ chữ/biểu tượng lỗi nhỏ.
  - Phím tắt toàn cục (`Ctrl+K` Bảng lệnh, `?` Bảng phím tắt, `Alt+A` Bật/tắt LOST AI, `Alt+T` Đổi giao diện Tối/Sáng đồng bộ qua `lost:toggle-theme`, `/` Tìm nhanh, `Esc` Đóng lớp trên cùng) sử dụng `e.code` tương thích Windows/macOS/Linux, chặn hoàn toàn khi đang gõ bộ gõ tiếng Việt (`e.isComposing`), trong ô nhập liệu hoặc khi modal đang mở.
  - Mọi thanh tab (`FieldToolkitView`, `UserProfileView`, v.v.) hỗ trợ roving `tabIndex`, `ArrowLeft`/`ArrowRight`/`Home`/`End` và liên kết `aria-controls` / `role="tabpanel"`.
- **Chống vỡ khung trên di động (Mobile-Safe Grid)**:
  - Mọi lưới thẻ đều áp dụng `grid-template-columns: repeat(auto-fit, minmax(min(Xpx, 100%), 1fr))` và `.route-planner-split` sập về 1 cột tại `<= 960px`, đảm bảo 0 tràn ngang trên màn hình 375px.
  - Bảng dữ liệu rộng (như ma trận 12 tháng, Bảng Phân Chặng Waypoint, bảng khẩu phần `fuel_plan_card`, biểu đồ `SummitClimateChart`) bọc trong vùng `overflow-x: auto` mượt; biểu đồ SVG đáp ứng dùng `height: 'auto'` hoặc `preserveAspectRatio="none"` (cho thanh tỷ trọng ngang).
- **Tương tác không hộp thoại trình duyệt**: Tuyệt đối **không dùng `window.confirm()` / `window.alert()` / `window.prompt()`**; mọi thao tác xác nhận đều dùng inline confirmation hoặc modal theo token hệ thống.
- **PWA Đồng Bộ Thương Hiệu & Đồ Họa Canvas Ngoại Tuyến Tương Thích Token (`manifest.json`, `favicon.svg`, `expeditionShareCard.ts`, `iceLockscreenCard.ts`)**:
  - `manifest.json` (`standalone`) và `favicon.svg` Pine Green đồng bộ tuyệt đối bảng màu Obsidian Slate `#0c0f0d` & Alpine Pine `#52b788` / `#1f6f4a`.
  - Thẻ PNG hành trình (`1080×1350` & `1200×630`) và **Thẻ Y Tế Khẩn Cấp ICE Màn Hình Khóa (`1080×1920`)** đọc bảng màu Dark/Light trực tiếp từ CSS custom properties của `index.css` (0 mã hex/rgba chết, fallback `hsl()`/`hsla()`) và tải trước `Plus Jakarta Sans` weights `600`/`700`/`800` để chữ tiếng Việt sắc nét không vỡ nét.
- **Cách Ly Lưu Trữ Theo Tài Khoản (`storageScope.ts`)**: Toàn bộ bộ đệm cá nhân (ICE medical card, AI threads, hướng dẫn viên đặt lịch, log GPS, mục tiêu năm, hộ chiếu) đều gắn hậu tố `userId` và được xóa sạch cùng xoay vòng `lost_client_session_id` khi đăng xuất/`401`/khóa tài khoản.

---

## 5. Typography Tiếng Việt 1 Font Duy Nhất & Pure SVG Mandate
1. **Unified Single-Font Vietnamese Typography**:
   - Toàn bộ ứng dụng sử dụng **1 font chữ duy nhất**: `--font-family` & `--font-display`: `'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', system-ui, -apple-system, sans-serif` (hỗ trợ đầy đủ Unicode tiếng Việt có dấu, không nhảy font).
   - Bật `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;`.
   - Bắt buộc áp dụng `font-variant-numeric: tabular-nums` cho cao độ, tọa độ GPS, khoảng cách, trọng lượng balo, chi phí VND và đồng hồ thực địa.
2. **Pure SVG Iconography, Charts, Compass & QR (Zero Emoji, Zero External Chart Libs)**:
   - **0 emoji Unicode** trong toàn bộ giao diện người dùng (UI controls, tiêu đề, badge, bảng, thông báo).
   - **100% Vector SVG thuần** ăn màu theo `currentColor` và CSS Design Tokens: `SvgIcons.tsx`, biểu đồ khí hậu 12 tháng ERA5 hai trục (`SummitClimateChart`), đường cong điểm sôi & oxy theo độ cao ISA (`FieldToolkitView`), biểu đồ sẵn sàng `0–100` (`readiness_audit_card` trong `AiRichCards` & `AiExpeditionBriefTab`), biểu đồ cao độ & chồng đường cong so sánh DEM (`TrailComparisonModal`, `RoutePlannerView`, `ElevationProfileSVG`), vòng Readiness Ring & 3 vòng Mục Tiêu Năm (`TrainingPlannerView`, `ProfileAnalyticsPanel`), biểu đồ tròn tỷ trọng balo (`GearOptimizerView`), cột chồng cơ cấu chi phí (`DirectoryCostView`), ma trận rủi ro (`SafetyRadarView`), La bàn Compass Rose & Cung Mặt Trời NOAA (`FieldToolkitView`), và mã QR chuẩn ISO/IEC 18004 (`qrMatrix.ts`).

---

## 6. Chế Độ In Ấn Hồ Sơ Thực Địa (`@media print` — Field-Atlas Expedition Dossiers)
- Định nghĩa tại cuối `client/src/index.css` với khổ trang `@page { size: auto; margin: 14mm 12mm; }` nhằm hỗ trợ in ấn trực tiếp **Hồ Sơ Chuyến Đi (`AiExpeditionBriefTab`)**, lịch trình và bảng phân chặng để mang theo giấy chống nước vào rừng.
- **Tự động chuyển sang bảng màu Mực trên Giấy độ tương phản cao**: ghi đè đồng loạt `:root`, `[data-theme="dark"]` và `[data-theme="light"]` về nền trắng `#ffffff`, chữ mực `#111613`, điểm nhấn xanh rừng `#14532d`, tắt `box-shadow` / `text-shadow` / `backdrop-filter` để bản in từ Dark Mode không tốn mực đen.
- **Tự động ẩn toàn bộ thanh điều khiển thừa**: ẩn `header`, `footer`, `nav`, `.lost-grain-overlay`, `.cyber-dock-bar`, `.toast-notification`, `.modal-overlay`, `.admin-sidebar`, `.editorial-tabs-bar`, `.no-print`, `.leaflet-control-container`, nút AI FAB và phần tử `position: fixed` (trừ vùng gắn `.print-keep`); hỗ trợ lớp `.print-only` chỉ hiện khi in.
- **Chống cắt đôi thẻ & bảng**: áp dụng `break-inside: avoid` cho thẻ, `svg`, `img`, `table`, `tr`, `blockquote` và `break-after: avoid` cho `h1`–`h4`.
