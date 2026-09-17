import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../types';

export function authenticate(req: any, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.userId, email: payload.email };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
