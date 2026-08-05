import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let cachedTransporter: nodemailer.Transporter | null = null;

// Create Pooled SMTP Transporter for Lightning Fast Delivery (< 1 sec)
const getTransporter = async () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Check if valid Gmail SMTP credentials provided
  if (user && pass && !user.includes('dien_email_gmail') && !pass.includes('dien_mat_khau')) {
    console.log(`⚡ [Gmail Pooled Transporter Active]: Account ${user} (Instant Delivery Mode)`);
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      pool: true, // Keep connections alive for instant delivery
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
      auth: { user, pass },
    });
    return cachedTransporter;
  }

  if (host && user && pass && !user.includes('dien_email') && !pass.includes('dien_mat_khau')) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT) === 465,
      pool: true,
      auth: { user, pass },
    });
    return cachedTransporter;
  }

  // Fallback to real Ethereal SMTP test account
  const testAccount = await nodemailer.createTestAccount();
  console.log(`[SMTP Mailer Notice]: Created real test SMTP transport (${testAccount.user})`);
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
};

export const sendAccountActivationEmail = async (toEmail: string, fullName: string, activationCode: string) => {
  try {
    const transporter = await getTransporter();
    const senderEmail = process.env.SMTP_USER && !process.env.SMTP_USER.includes('dien_email') ? process.env.SMTP_USER : 'no-reply@trekmap.vn';

    const displayName = fullName && fullName.trim() !== '' && fullName.trim() !== 'o' ? fullName : toEmail.split('@')[0];

    const mailOptions = {
      from: `"TrekMap" <${senderEmail}>`,
      to: toEmail,
      subject: 'Mã xác thực kích hoạt tài khoản TrekMap',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1319; color: #e2e8f0; padding: 48px 20px; line-height: 1.6;">
          <div style="max-width: 520px; margin: 0 auto; background-color: #111c24; border: 1px solid #1e2d3d; border-radius: 12px; padding: 40px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
            
            <!-- Corporate Clean Header -->
            <div style="border-bottom: 1px solid #1e2d3d; padding-bottom: 24px; margin-bottom: 28px; text-align: left;">
              <div style="display: inline-block; font-size: 18px; font-weight: 800; tracking: 1px; color: #10b981; letter-spacing: 1.5px;">TREKMAP</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Hệ thống Bản đồ & Dữ liệu Địa hình 3D</div>
            </div>

            <!-- Body -->
            <div style="margin-bottom: 32px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 16px 0;">Kích hoạt tài khoản của bạn</h1>
              
              <p style="font-size: 14px; color: #94a3b8; margin: 0 0 16px 0;">
                Xin chào <strong style="color: #f1f5f9;">${displayName}</strong>,
              </p>
              
              <p style="font-size: 14px; color: #94a3b8; margin: 0 0 20px 0;">
                Cảm ơn bạn đã đăng ký tài khoản TrekMap với địa chỉ email <strong style="color: #10b981;">${toEmail}</strong>. Vui lòng nhập mã xác thực 6 chữ số dưới đây vào ứng dụng để kích hoạt tài khoản của bạn:
              </p>

              <!-- 6-Digit OTP Box -->
              <div style="background-color: #0b1319; border: 1px dashed #10b981; border-radius: 10px; padding: 22px; text-align: center; margin: 24px 0;">
                <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Mã kích hoạt tài khoản của bạn</div>
                <div style="font-size: 34px; font-weight: 800; color: #10b981; letter-spacing: 8px; margin-top: 8px; font-family: monospace;">${activationCode}</div>
              </div>

              <p style="font-size: 13px; color: #64748b; margin: 24px 0 0 0; border-top: 1px solid #1a2634; padding-top: 16px;">
                Mã xác thực này có hiệu lực trong vòng 24 giờ. Nếu bạn không thực hiện yêu cầu này, bạn có thể an tâm bỏ qua email này.
              </p>
            </div>

            <!-- Clean Footer -->
            <div style="border-top: 1px solid #1e2d3d; padding-top: 24px; font-size: 12px; color: #475569; text-align: left;">
              © 2026 TrekMap Inc. Tất cả các quyền được bảo lưu.<br />
              Email này được gửi tự động từ hệ thống xác thực TrekMap.
            </div>

          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ [PROFESSIONAL ACTIVATION EMAIL SENT]: Message ID: ${info.messageId} -> Delivered to ${toEmail}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ [Activation SMTP Mailer Error]:', error);
    return { success: false, error };
  }
};

export const sendResetPasswordEmail = async (toEmail: string, resetLink: string) => {
  try {
    const transporter = await getTransporter();
    const senderEmail = process.env.SMTP_USER && !process.env.SMTP_USER.includes('dien_email') ? process.env.SMTP_USER : 'no-reply@trekmap.vn';

    const mailOptions = {
      from: `"TrekMap Security" <${senderEmail}>`,
      to: toEmail,
      subject: 'Yêu cầu khôi phục mật khẩu tài khoản TrekMap',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1319; color: #e2e8f0; padding: 48px 20px; line-height: 1.6;">
          <div style="max-width: 520px; margin: 0 auto; background-color: #111c24; border: 1px solid #1e2d3d; border-radius: 12px; padding: 40px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
            
            <!-- Corporate Clean Header -->
            <div style="border-bottom: 1px solid #1e2d3d; padding-bottom: 24px; margin-bottom: 28px; text-align: left;">
              <div style="display: inline-block; font-size: 18px; font-weight: 800; tracking: 1px; color: #10b981; letter-spacing: 1.5px;">TREKMAP</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Trung tâm Bảo mật Tài khoản</div>
            </div>

            <!-- Body -->
            <div style="margin-bottom: 32px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 16px 0;">Yêu cầu đặt lại mật khẩu</h1>
              
              <p style="font-size: 14px; color: #94a3b8; margin: 0 0 16px 0;">
                Xin chào <strong style="color: #f1f5f9;">${toEmail}</strong>,
              </p>
              
              <p style="font-size: 14px; color: #94a3b8; margin: 0 0 24px 0;">
                Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản TrekMap của bạn. Vui lòng nhấn vào nút bên dưới để tiến hành thiết lập mật khẩu mới:
              </p>
              
              <!-- Clean Corporate Button -->
              <div style="margin: 32px 0; text-align: left;">
                <a href="${resetLink}" target="_blank" style="background-color: #059669; color: #ffffff; padding: 13px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">
                  Đặt lại mật khẩu
                </a>
              </div>

              <p style="font-size: 13px; color: #64748b; margin: 24px 0 0 0; border-top: 1px solid #1a2634; padding-top: 16px;">
                Liên kết này có hiệu lực trong vòng 15 phút. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email.
              </p>
            </div>

            <!-- Clean Footer -->
            <div style="border-top: 1px solid #1e2d3d; padding-top: 24px; font-size: 12px; color: #475569; text-align: left;">
              © 2026 TrekMap Inc. Tất cả các quyền được bảo lưu.<br />
              Email này được gửi tự động từ hệ thống bảo mật TrekMap.
            </div>

          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ [PROFESSIONAL RESET EMAIL SENT]: Message ID: ${info.messageId} -> Delivered to ${toEmail}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ [Reset SMTP Mailer Error]:', error);
    return { success: false, error };
  }
};
