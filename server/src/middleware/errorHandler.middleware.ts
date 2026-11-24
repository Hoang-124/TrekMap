import { Request, Response, NextFunction } from 'express';

/**
 * Global Error Handler Middleware
 * Maps Mongoose / Express parsing errors to safe 4xx responses and never leaks internal 5xx details outside development.
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  const timestamp = new Date().toISOString();
  console.error(`[Error ${timestamp}] ${req.method} ${req.originalUrl}:`, err);

  let statusCode = Number(err?.statusCode || err?.status) || 500;
  let clientMessage = 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.';

  if (err?.type === 'entity.parse.failed') {
    statusCode = 400;
    clientMessage = 'Dữ liệu JSON gửi lên không đúng định dạng.';
  } else if (err?.type === 'entity.too.large' || statusCode === 413) {
    statusCode = 413;
    clientMessage = 'Kích thước dữ liệu vượt quá giới hạn cho phép.';
  } else if (err?.name === 'CastError') {
    statusCode = 400;
    clientMessage = 'Định dạng mã định danh hoặc tham số truy vấn không hợp lệ.';
  } else if (err?.name === 'ValidationError') {
    statusCode = 400;
    clientMessage = 'Dữ liệu gửi lên không thỏa mãn điều kiện kiểm tra.';
  } else if (err?.code === 11000) {
    statusCode = 409;
    clientMessage = 'Dữ liệu bị trùng lặp trên hệ thống.';
  } else if (statusCode >= 400 && statusCode < 500 && typeof err?.message === 'string' && err.message.trim()) {
    clientMessage = err.message;
  } else if (process.env.NODE_ENV === 'development' && typeof err?.message === 'string' && err.message.trim()) {
    clientMessage = err.message;
  }

  return res.status(statusCode).json({
    success: false,
    message: clientMessage,
    timestamp,
    ...(process.env.NODE_ENV === 'development' ? { stack: err?.stack } : {}),
  });
};
