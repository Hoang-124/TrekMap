import { Request, Response, NextFunction } from 'express';

/**
 * Global Error Handler Middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const timestamp = new Date().toISOString();
  console.error(`🔴 [Error ${timestamp}] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.';

  return res.status(statusCode).json({
    success: false,
    message,
    timestamp,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
