import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types';

export function signAccessToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as any,
    algorithm: 'HS256',
  });
}

export function signRefreshToken(payload: { userId: string; familyId: string }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as any,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
}

export function verifyRefreshToken(token: string): { userId: string; familyId: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as {
    userId: string;
    familyId: string;
  };
}
