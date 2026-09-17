import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import * as authService from './auth.service';
import { issueTokenPair } from './auth.service';
import { AuthenticatedRequest } from '../../types';
import prisma from '../../config/db';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('displayName').optional().trim().isLength({ max: 100 }),
];

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }
    const { email, password, displayName } = req.body;
    const user = await authService.registerUser(email, password, displayName);
    const tokens = await issueTokenPair(user.id, user.email);
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ success: true, data: { user, accessToken: tokens.accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }
    const { email, password } = req.body;
    const tokens = await authService.loginUser(email, password);
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ success: true, data: { accessToken: tokens.accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      res.status(401).json({ success: false, error: 'No refresh token' });
      return;
    }
    const tokens = await authService.refreshTokens(rawToken);
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ success: true, data: { accessToken: tokens.accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) await authService.logoutUser(rawToken);
    res.clearCookie('refreshToken', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        storageUsed: true,
        storageQuota: true,
        createdAt: true,
        oauthAccounts: { select: { provider: true } },
      },
    });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

// OAuth callback handler — called after Passport succeeds
export async function oauthCallback(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    }
    const tokens = await issueTokenPair(user.id, user.email);
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    // Redirect frontend with access token in URL fragment
    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${tokens.accessToken}`);
  } catch (err) {
    logger.error('OAuth callback error', { error: err });
    res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
  }
}
