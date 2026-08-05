# 📖 Thư Viện Prompt Copy & Paste: GStack + Impeccable + Superpowers

Tài liệu này được thiết kế theo dạng **Khu vực Copy & Paste Nhanh**. Mỗi khi muốn sử dụng bất kỳ vai trò hay lệnh nào, bạn chỉ cần **nút Copy** khung lệnh mẫu bên dưới, dán vào chat và thay đổi phần nội dung trong ngoặc vuông `[...]`.

---

## 🚀 1. KHU VỰC COPY & PASTE NHANH (MẪU LỆNH CHUẨN)

### 1. Phản biện & Lên chiến lược sản phẩm (CEO / YC Partner)
* **Ý tưởng mới (Hỏi phản biện 5 câu hỏi):**
```text
/office-hours Tôi muốn phát triển tính năng [nhập ý tưởng của bạn vào đây]
```

* **Cắt giảm tính năng cồng kềnh (Làm bản MVP nhỏ nhất):**
```text
/plan-ceo-review Hãy cắt giảm scope của tính năng [tên tính năng] để làm bản MVP nhỏ nhất trong 1 ngày.
```

---

### 2. Thiết kế Kiến trúc & TDD (Lead Architect & Superpowers)
* **Khóa thiết kế API Contract & TypeScript Types:**
```text
/plan-eng-review Thiết kế API contract và các TypeScript interfaces cho tính năng [tên tính năng].
```

* **Viết code chuẩn TDD (Test-Driven Development):**
```text
Dùng skill superpowers-eng áp dụng quy trình TDD (Red-Green-Refactor) để viết module [tên module/chức năng].
```

* **Xử lý dữ liệu bản đồ GIS (GeoJSON / GPS / Tiles):**
```text
Dùng skill gis-map-expert để xử lý [vẽ tuyến đường GeoJSON / tính khoảng cách GPS / lưu offline tiles].
```

---

### 3. Thiết kế Giao diện UI/UX (Paul Bakaus Impeccable)
* **Tạo / Làm đẹp giao diện (Chống AI Slop):**
```text
Dùng skill impeccable-design để thiết kế giao diện [tên màn hình / component] theo chuẩn Dark Mode glassmorphism, lưới 8px.
```

* **Tối ưu tốc độ tải trang & hiệu năng (Performance):**
```text
Dùng skill performance-engineer để tối ưu tốc độ render và giảm lag cho [tên file / component].
```

---

### 4. Kiểm thử, Bảo mật & Audit Code (CSO & QA)
* **Soi lỗi an ninh mạng OWASP Top 10 (Chống XSS / Injection / Auth):**
```text
/cso Kiểm tra an ninh mạng cho file [đường dẫn file, ví dụ: server/src/routes/user.ts].
```

* **Review chất lượng code (Chống memory leak, async safety):**
```text
/review Kiểm tra chất lượng code và async safety cho file [đường dẫn file, ví dụ: client/src/components/Map.tsx].
```

* **Test giao diện & trải nghiệm người dùng (E2E QA):**
```text
/qa Kiểm tra giao diện và luồng người dùng trên di động cho màn hình [tên màn hình].
```

---

### 5. Ship hàng & Viết tài liệu (Release Manager & Tech Writer)
* **Kiểm tra build & lint trước khi Commit / Deploy:**
```text
/ship
```

* **Tự động tạo CHANGELOG & cập nhật README:**
```text
/document-release Tự động cập nhật CHANGELOG.md và README.md cho bản phát hành mới.
```

* **Tạo cấu hình Docker & CI/CD:**
```text
Dùng skill devops-cloud để tạo [Dockerfile / GitHub Actions deploy pipeline] cho dự án.
```

---

## ⚡ 2. CÁC MẪU KẾT HỢP NHANH (COMBO PROMPTS)

* **Combo 1: Phát triển tính năng mới trọn gói (Full Pipeline):**
```text
/office-hours /plan-eng-review Thiết kế trọn gói tính năng [tên tính năng mới] bao gồm cả MVP scope và TypeScript types.
```

* **Combo 2: Cấp cứu sửa Bug khẩn cấp (Emergency Hotfix):**
```text
/review /cso Tìm nguyên nhân và sửa ngay lỗi [mô tả lỗi hoặc dán log lỗi vào đây].
```

* **Combo 3: Thiết kế UI xịn + Tối ưu hiệu năng bản đồ:**
```text
Dùng skill impeccable-design và gis-map-expert để xây dựng giao diện [tên màn hình bản đồ].
```

---

## 🏛️ 3. BẢNG TRA CỨU MA TRẬN 9 VAI TRÒ & SKILLS

| Slash Command / Skill | Framework | Vai trò chuyên gia | Nhiệm vụ chính |
| :--- | :--- | :--- | :--- |
| **`/office-hours`** | GStack | 👔 **YC Founder Partner** | Phỏng vấn ép buộc 5 câu hỏi chiến lược trước khi viết code |
| **`/plan-ceo-review`**| GStack | 👔 **CEO (Brian Chesky Mode)** | Cắt giảm tính năng thừa, giữ trải nghiệm đơn giản |
| **`/plan-eng-review`**| GStack | 🏗️ **Lead Architect** | Khóa thiết kế hệ thống, phân tách Client/Server, định nghĩa TypeScript types |
| **`/review`** | GStack | 🏗️ **Senior Code Reviewer** | Review chất lượng code, async safety, phát hiện memory leak |
| **`/cso`** | GStack | 🛡️ **Chief Security Officer** | Audit an ninh mạng theo chuẩn **OWASP Top 10 & STRIDE** |
| **`/qa` / `/qa-only`** | GStack | 🛡️ **QA Automation Lead** | Test giao diện, nút bấm, mobile responsiveness & console errors |
| **`/ship`** | GStack | 🚀 **Release Manager** | Kiểm tra pre-flight (`npm run build`, `npm run lint`, env audit) |
| **`/document-release`**| GStack | ✍️ **Technical Writer** | Tự động tạo `CHANGELOG.md`, cập nhật `README.md` & API docs |
| **`impeccable-design`** | **Impeccable** | 🎨 **UI/UX Specialist** | Lưới 8px, HSL colors, micro-animations, chống AI slop |
| **`superpowers-eng`** | **Superpowers** | ⚡ **TDD & Execution Engine** | Lập trình TDD (Red-Green-Refactor), kỷ luật phát triển |
| *(Dữ liệu bản đồ)* | GStack | 🗺️ **GIS Specialist** | GeoJSON, Mapbox/Leaflet rendering, GPS tracking & offline tiles |
| *(Tối ưu)* | GStack | ⚡ **Performance Engineer** | Core Web Vitals, code-splitting, giảm re-render, nén API |
| *(Hạ tầng)* | GStack | ⚙️ **DevOps Cloud Lead** | Cấu hình Docker multi-stage & CI/CD GitHub Actions pipeline |
