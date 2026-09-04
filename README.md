# 🏔️ TrekMap — Nền Tảng Bản Đồ Địa Hình & Thám Hiểm Núi Rừng Việt Nam 3D

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-purple.svg)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-brightgreen.svg)](https://www.mongodb.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-CDN-orange.svg)](https://cloudinary.com/)

**TrekMap** là nền tảng bản đồ thám hiểm núi rừng và trekking chuyên sâu hàng đầu tại Việt Nam. Ứng dụng tích hợp bản đồ địa hình 3D, tọa độ GPS thời gian thực, hệ thống đóng góp cung đường thám hiểm mới, cổng kiểm duyệt Ban Quản Trị BQT chuyên nghiệp, cùng diễn đàn thảo luận và thẻ xác nhận nhà thám hiểm Passport 3D.

---

## ✨ Tính Năng Nổi Bật

### 🗺️ 1. Bản Đồ Tương Tác 3D & Tọa Độ GPS Thời Gian Thực
- Trực quan hóa tọa độ **Điểm Xuất Phát (Start Pin)** và **Điểm Kết Thúc (End Pin)** trên nền bản đồ vệ tinh / địa hình Leaflet.
- Đo độ dài đường đi (km), tích lũy cao độ (+m), đỉnh cao nhất (m) và mô phỏng tuyến đường GPX.

### 📝 2. Hệ Thống Đóng Góp Cung Đường Mới (Contribution Wizard)
- Quy trình 3 bước chuyên nghiệp: **Thông số cơ bản $\rightarrow$ Tọa độ & Tuyến đường $\rightarrow$ Mô tả & Ảnh bìa**.
- Trích xuất tự động vị trí từ tệp GPX tải lên từ thiết bị.
- **Tự động tải và tối ưu hóa hình ảnh trên Cloudinary CDN** (`trekmap/trails`).

### 🛡️ 3. Trung Tâm Kiểm Duyệt Ban Quản Trị Admin (Admin Portal)
- Màn hình kiểm duyệt BQT độc quyền với **Modal soi chi tiết 6 khu vực thông tin**:
  1. *Thông tin tổng quan & Địa danh hành chính (Miền/Tỉnh/Huyện/Thôn bản)*.
  2. *Thông số kỹ thuật thám hiểm (Độ dài, độ cao nâng, độ khó, thời gian)*.
  3. *Tọa độ GPS Xuất phát & Kết thúc*.
  4. *Mô tả chi tiết & Hướng dẫn di chuyển*.
  5. *Quy định giấy phép & Tiện ích trên tuyến (Bãi cắm trại, nguồn nước, đánh giá trẻ em)*.
  6. *Thông tin chính chủ thành viên đóng góp (Tên, Email, Avatar đại diện)*.
- Phê duyệt 1 chạm: Bài viết được duyệt sẽ **tự động công khai lên Trang chủ và đồng bộ trực tiếp vào MongoDB**.

### 👤 4. Thẻ Thám Hiểm Passport 3D & Hồ Sơ Cá Nhân
- Hồ sơ thành viên tích hợp thẻ **TrekMap Official Expedition Passport**.
- Lịch sử đóng góp cung đường mới, theo dõi trạng thái bài đăng (*Chờ BQT Duyệt* / *Đã Duyệt Công Khai*).
- Quản lý danh mục trang bị sinh tồn và bộ sưu tập huy hiệu danh dự.

### 🎨 5. Tối Ưu Hóa Giao Diện Chống Mỏi Mắt (UX/UI Excellence)
- Chế độ hiển thị linh hoạt: **Dạng Lưới (Grid View)** và **Danh Sách Tóm Tắt (Compact View)** giảm 70% chiều cao màn hình.
- Phân trang thông minh với nút *Xem Thêm Cung Đường Khác*, đảm bảo trải nghiệm người xem mượt mà, không mỏi mắt.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### Frontend (Client)
- **Framework**: React 18, TypeScript, Vite.
- **Styling**: Vanilla CSS (CSS Modules / Token System), Lucide Icons.
- **Map Engine**: Leaflet, React-Leaflet.
- **Image Optimization**: Cloudinary SDK / CDN URL Transformer.

### Backend (Server)
- **Runtime**: Node.js, Express.js (TypeScript ESM).
- **Database**: MongoDB (Mongoose ODM) với chỉ mục địa lý 2D Spatial GIS (`2dsphere`).
- **Media CDN**: Cloudinary v2 Official SDK.
- **Security & Mailer**: JWT Auth, bcrypt, Nodemailer (Gmail SMTP Transporter).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Yêu Cầu Tiền Đề
- Node.js version `>= 18.0.0`
- MongoDB đang chạy tại địa phương (`mongodb://localhost:27017`) hoặc MongoDB Atlas.

### 2. Cài Đặt Mã Nguồn
```bash
# Clone dự án từ GitHub
git clone https://github.com/Hoang-124/TrekMap.git
cd TrekMap

# Cài đặt dependencies cho Client & Server
npm install
npm --prefix client install
npm --prefix server install
```

### 3. Cấu Hình Biến Môi Trường (`server/.env`)
Tạo tệp `.env` trong thư mục `server/`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/trekmap
JWT_SECRET=trekmap-jwt-secret-key-2026

# Cloudinary CDN Credentials
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### 4. Khởi Chạy Dự Án
```bash
# Chạy đồng thời cả Client Frontend (Port 5173) và Server Backend (Port 5000)
npm run dev
```

Truy cập ứng dụng tại: `http://localhost:5173`

---

## 📂 Cấu Trúc Dự Án

```
TrekMap/
├── client/                     # Frontend React Vite App
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/          # Admin Dashboard & Inspection Modal
│   │   │   ├── auth/           # Login / Register / OTP Modals
│   │   │   ├── contribution/   # 3-Step Trail Contribution Wizard
│   │   │   ├── forum/          # Diễn đàn & Live Trekker Chatroom
│   │   │   ├── layout/         # Navbar & Footer
│   │   │   ├── map/            # 3D Leaflet Map Engine
│   │   │   ├── profile/        # Passport 3D & User Profile
│   │   │   └── trail/          # Trail Cards & Detail Views
│   │   ├── services/           # REST API & Cloudinary Client
│   │   ├── types.ts            # TypeScript Definitions
│   │   └── App.tsx             # Main App Router & State
├── server/                     # Backend Node.js Express Server
│   ├── src/
│   │   ├── config/             # DB & Cloudinary SDK Configuration
│   │   ├── controllers/        # Auth, Trail, Contribution & Upload Controllers
│   │   ├── models/             # Mongoose Schemas (Contribution, Trail, User...)
│   │   ├── routes/             # Express Routers
│   │   └── app.ts              # Express Server Entry Point
└── README.md
```

---

## 👤 Tác Giả & Bản Quyền

- **Đơn vị phát triển**: TrekMap Expedition Team
- **GitHub Repository**: [https://github.com/Hoang-124/TrekMap](https://github.com/Hoang-124/TrekMap)
- **License**: MIT License
