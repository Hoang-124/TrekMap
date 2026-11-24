import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let cachedTransporter: nodemailer.Transporter | null = null;
let transporterInitPromise: Promise<nodemailer.Transporter> | null = null;

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitizeHeaderValue(str: string, maxLen = 180): string {
  return String(str || '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (cachedTransporter) return cachedTransporter;
  if (transporterInitPromise) return transporterInitPromise;

  transporterInitPromise = (async () => {
    const host = (process.env.SMTP_HOST || '').trim();
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').trim();
    const hasRealCredentials =
      Boolean(user && pass) && !user.includes('dien_email') && !pass.includes('dien_mat_khau');

    // 1. Custom SMTP Host takes precedence if configured
    if (host && host !== 'smtp.gmail.com' && hasRealCredentials) {
      const port = Number(process.env.SMTP_PORT) || 465;
      cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        pool: true,
        auth: { user, pass },
      });
      return cachedTransporter;
    }

    // 2. Gmail Pooled SMTP Transporter
    if (hasRealCredentials) {
      cachedTransporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5,
        auth: { user, pass },
      });
      return cachedTransporter;
    }

    // 3. Fail fast in production if SMTP credentials are not configured
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP credentials (SMTP_USER / SMTP_PASS) must be configured in production.');
    }

    // 4. Development / Test Ethereal Fallback
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    return cachedTransporter;
  })().finally(() => {
    transporterInitPromise = null;
  });

  return transporterInitPromise;
};

export const sendAccountActivationEmail = async (toEmail: string, fullName: string, activationCode: string) => {
  try {
    const transporter = await getTransporter();
    const senderEmail =
      process.env.SMTP_USER && !process.env.SMTP_USER.includes('dien_email')
        ? process.env.SMTP_USER
        : 'no-reply@lost.vn';

    const rawName = fullName && fullName.trim() !== '' && fullName.trim() !== 'o' ? fullName : toEmail.split('@')[0];
    const safeName = escapeHtml(rawName);
    const safeEmail = escapeHtml(toEmail);
    const safeCode = escapeHtml(activationCode);

    const mailOptions = {
      from: `"LOST" <${senderEmail}>`,
      to: toEmail,
      subject: 'Mã xác thực kích hoạt tài khoản LOST',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1319; color: #e2e8f0; padding: 48px 20px; line-height: 1.6;">
          <div style="max-width: 520px; margin: 0 auto; background-color: #111c24; border: 1px solid #1e2d3d; border-radius: 12px; padding: 40px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
            <div style="border-bottom: 1px solid #1e2d3d; padding-bottom: 24px; margin-bottom: 28px; text-align: left;">
              <div style="display: inline-block; font-size: 18px; font-weight: 800; color: #10b981; letter-spacing: 1.5px;">LOST</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Hệ thống Bản đồ &amp; Dữ liệu Địa hình 3D</div>
            </div>
            <div style="margin-bottom: 32px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 16px 0;">Kích hoạt tài khoản của bạn</h1>
              <p style="font-size: 14px; color: #94a3b8; margin: 0 0 16px 0;">
                Xin chào <strong style="color: #f1f5f9;">${safeName}</strong>,
              </p>
              <p style="font-size: 14px; color: #94a3b8; margin: 0 0 20px 0;">
                Cảm ơn bạn đã đăng ký tài khoản với địa chỉ email <strong style="color: #10b981;">${safeEmail}</strong>. Vui lòng nhập mã xác thực 6 chữ số dưới đây vào ứng dụng để kích hoạt tài khoản của bạn:
              </p>
              <div style="background-color: #0b1319; border: 1px dashed #10b981; border-radius: 10px; padding: 22px; text-align: center; margin: 24px 0;">
                <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Mã kích hoạt tài khoản của bạn</div>
                <div style="font-size: 34px; font-weight: 800; color: #10b981; letter-spacing: 8px; margin-top: 8px; font-family: monospace;">${safeCode}</div>
              </div>
              <p style="font-size: 13px; color: #64748b; margin: 24px 0 0 0; border-top: 1px solid #1a2634; padding-top: 16px;">
                Mã xác thực này có hiệu lực trong vòng 15 phút. Nếu bạn không thực hiện yêu cầu này, bạn có thể an tâm bỏ qua email này.
              </p>
            </div>
            <div style="border-top: 1px solid #1e2d3d; padding-top: 24px; font-size: 12px; color: #475569; text-align: left;">
              © 2026 LOST. Email này được gửi tự động từ hệ thống xác thực.
            </div>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Activation SMTP Mailer Error]:', error);
    cachedTransporter = null;
    return { success: false, error };
  }
};

export const sendResetPasswordEmail = async (toEmail: string, resetLink: string) => {
  try {
    const transporter = await getTransporter();
    const senderEmail =
      process.env.SMTP_USER && !process.env.SMTP_USER.includes('dien_email')
        ? process.env.SMTP_USER
        : 'no-reply@lost.vn';

    const safeEmail = escapeHtml(toEmail);
    const safeLink = escapeHtml(resetLink);

    const mailOptions = {
      from: `"LOST Security" <${senderEmail}>`,
      to: toEmail,
      subject: 'Yêu cầu khôi phục mật khẩu tài khoản LOST',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1319; color: #e2e8f0; padding: 48px 20px; line-height: 1.6;">
          <div style="max-width: 520px; margin: 0 auto; background-color: #111c24; border: 1px solid #1e2d3d; border-radius: 12px; padding: 40px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
            <div style="border-bottom: 1px solid #1e2d3d; padding-bottom: 24px; margin-bottom: 28px; text-align: left;">
              <div style="display: inline-block; font-size: 18px; font-weight: 800; color: #10b981; letter-spacing: 1.5px;">LOST</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Trung tâm Bảo mật Tài khoản</div>
            </div>
            <div style="margin-bottom: 32px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 16px 0;">Yêu cầu đặt lại mật khẩu</h1>
              <p style="font-size: 14px; color: #94a3b8; margin: 0 0 16px 0;">
                Xin chào <strong style="color: #f1f5f9;">${safeEmail}</strong>,
              </p>
              <p style="font-size: 14px; color: #94a3b8; margin: 0 0 24px 0;">
                Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấn vào nút bên dưới để tiến hành thiết lập mật khẩu mới:
              </p>
              <div style="margin: 32px 0; text-align: left;">
                <a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="background-color: #059669; color: #ffffff; padding: 13px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">
                  Đặt lại mật khẩu
                </a>
              </div>
              <p style="font-size: 13px; color: #64748b; margin: 24px 0 0 0; border-top: 1px solid #1a2634; padding-top: 16px;">
                Liên kết này có hiệu lực trong vòng 15 phút. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email.
              </p>
            </div>
            <div style="border-top: 1px solid #1e2d3d; padding-top: 24px; font-size: 12px; color: #475569; text-align: left;">
              © 2026 LOST. Email này được gửi tự động từ hệ thống bảo mật.
            </div>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Reset SMTP Mailer Error]:', error);
    cachedTransporter = null;
    return { success: false, error };
  }
};

export const sendSafetyOverdueAlertEmail = async (params: {
  toEmail: string;
  contactName: string;
  trekkerName: string;
  trailName: string;
  expectedReturnAt: Date;
  lastKnownLat?: number;
  lastKnownLng?: number;
  notes?: string;
}) => {
  try {
    const transporter = await getTransporter();
    const senderEmail =
      process.env.SMTP_USER && !process.env.SMTP_USER.includes('dien_email')
        ? process.env.SMTP_USER
        : 'no-reply@lost.vn';

    const safeContact = escapeHtml(params.contactName || 'Người thân');
    const safeTrekker = escapeHtml(params.trekkerName || 'Thành viên');
    const safeTrail = escapeHtml(params.trailName);
    const safeTime = escapeHtml(new Date(params.expectedReturnAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const safeNotes = escapeHtml(params.notes || 'Không có ghi chú thêm.');
    const hasCoords =
      typeof params.lastKnownLat === 'number' &&
      typeof params.lastKnownLng === 'number' &&
      Number.isFinite(params.lastKnownLat) &&
      Number.isFinite(params.lastKnownLng);
    const coordsText = hasCoords
      ? `${params.lastKnownLat!.toFixed(5)}, ${params.lastKnownLng!.toFixed(5)}`
      : 'Chưa cập nhật tọa độ gần nhất';
    const mapsLink = hasCoords
      ? `https://www.google.com/maps?q=${params.lastKnownLat!.toFixed(6)},${params.lastKnownLng!.toFixed(6)}`
      : '';

    const subjectTrekker = sanitizeHeaderValue(params.trekkerName || 'Thành viên', 60);
    const subjectTrail = sanitizeHeaderValue(params.trailName || 'Cung đường', 80);

    const mailOptions = {
      from: `"LOST Safety Beacon" <${senderEmail}>`,
      to: params.toEmail,
      subject: `[KHẨN CẤP] Quá hạn báo bình an: ${subjectTrekker} - ${subjectTrail}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #0b1319; color: #e2e8f0; padding: 36px 20px; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #111c24; border: 2px solid #ef4444; border-radius: 14px; padding: 32px;">
            <div style="color: #ef4444; font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">CẢNH BÁO AN TOÀN HÀNH TRÌNH TREKKING</div>
            <h1 style="font-size: 20px; color: #ffffff; margin: 8px 0 16px 0;">${safeTrekker} đã quá giờ báo bình an</h1>
            <p style="font-size: 14px; color: #cbd5e1;">Kính gửi <strong>${safeContact}</strong>,</p>
            <p style="font-size: 14px; color: #cbd5e1;">
              Hệ thống Hẹn Giờ Báo Bình An ghi nhận <strong>${safeTrekker}</strong> chưa xác nhận ra khỏi rừng đúng hạn trên cung đường <strong>${safeTrail}</strong>.
            </p>
            <div style="background: #0b1319; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin: 18px 0; font-size: 14px;">
              <div><strong>Thời gian hẹn báo an toàn:</strong> ${safeTime}</div>
              <div><strong>Tọa độ gần nhất:</strong> ${escapeHtml(coordsText)}</div>
              ${mapsLink ? `<div style="margin-top: 6px;"><a href="${escapeHtml(mapsLink)}" style="color: #38bdf8;">Mở vị trí trên Google Maps</a></div>` : ''}
              <div style="margin-top: 6px;"><strong>Ghi chú:</strong> ${safeNotes}</div>
            </div>
            <p style="font-size: 13px; color: #fca5a5;">
              Vui lòng liên lạc trực tiếp với người đi rừng. Nếu không liên lạc được, hãy báo ngay Tổng đài Tìm kiếm Cứu nạn <strong>112</strong>, Cảnh sát PCCC &amp; CNCH <strong>114</strong> hoặc Ban Quản lý Vườn Quốc gia khu vực.
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Safety Overdue Mailer Error]:', error);
    cachedTransporter = null;
    return { success: false, error };
  }
};

export const sendSafetyAllClearEmail = async (params: {
  toEmail: string;
  contactName: string;
  trekkerName: string;
  trailName: string;
  checkedInSafeAt: Date;
}) => {
  try {
    const transporter = await getTransporter();
    const senderEmail =
      process.env.SMTP_USER && !process.env.SMTP_USER.includes('dien_email')
        ? process.env.SMTP_USER
        : 'no-reply@lost.vn';

    const safeContact = escapeHtml(params.contactName || 'Người thân');
    const safeTrekker = escapeHtml(params.trekkerName || 'Thành viên');
    const safeTrail = escapeHtml(params.trailName);
    const safeTime = escapeHtml(new Date(params.checkedInSafeAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));

    const subjectTrekker = sanitizeHeaderValue(params.trekkerName || 'Thành viên', 60);
    const subjectTrail = sanitizeHeaderValue(params.trailName || 'Cung đường', 80);

    const info = await transporter.sendMail({
      from: `"LOST Safety Beacon" <${senderEmail}>`,
      to: params.toEmail,
      subject: `[ĐÃ AN TOÀN] ${subjectTrekker} đã xác nhận ra khỏi rừng - ${subjectTrail}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #0b1319; color: #e2e8f0; padding: 36px 20px; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #111c24; border: 2px solid #10b981; border-radius: 14px; padding: 32px;">
            <div style="color: #10b981; font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">THÔNG BÁO BÌNH AN (ALL CLEAR)</div>
            <h1 style="font-size: 20px; color: #ffffff; margin: 8px 0 16px 0;">${safeTrekker} đã xác nhận an toàn</h1>
            <p style="font-size: 14px; color: #cbd5e1;">Kính gửi <strong>${safeContact}</strong>,</p>
            <p style="font-size: 14px; color: #cbd5e1;">
              Thành viên <strong>${safeTrekker}</strong> vừa bấm xác nhận <strong>Đã ra khỏi rừng an toàn</strong> trên cung đường <strong>${safeTrail}</strong> lúc <strong>${safeTime}</strong>. Cảnh báo quá hạn trước đó đã được hủy bỏ.
            </p>
          </div>
        </div>
      `,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Safety All-Clear Mailer Error]:', error);
    cachedTransporter = null;
    return { success: false, error };
  }
};
