import { Request, Response, NextFunction } from 'express';

/**
 * Validates request body fields
 */
export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const { email, password, fullName } = req.body;

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ.' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Mật khẩu phải chứa ít nhất 6 ký tự.' });
  }

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Họ và tên không được để trống.' });
  }

  next();
};

export const validateLogin = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ email và mật khẩu.' });
  }

  next();
};

export const validateIncidentReport = (req: Request, res: Response, next: NextFunction) => {
  const { description, severity } = req.body;

  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Vui lòng mô tả chi tiết sự cố (ít nhất 5 ký tự).' });
  }

  const validSeverities = ['low', 'medium', 'high', 'critical'];
  if (severity && !validSeverities.includes(severity)) {
    return res.status(400).json({ success: false, message: 'Mức độ nghiêm trọng không hợp lệ.' });
  }

  next();
};
