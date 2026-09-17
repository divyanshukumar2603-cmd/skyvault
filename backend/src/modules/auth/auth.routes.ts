import { Router } from 'express';
import passport from 'passport';
import { body } from 'express-validator';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { authLimiter, oauthLimiter } from '../../middleware/rateLimiter';
import { AuthenticatedRequest } from '../../types';
import { env } from '../../config/env';

const router = Router();

// ─── Email / Password ─────────────────────────────────────────────
router.post('/register', authLimiter, authController.registerValidation, authController.register);
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  authController.login
);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate as any, (req: any, res: any, next: any) =>
  authController.me(req as AuthenticatedRequest, res, next)
);

// ─── Google OAuth ────────────────────────────────────────────────
router.get(
  '/google',
  oauthLimiter,
  (req, res, next) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=google_not_configured`);
    }
    passport.authenticate('google', { session: false, scope: ['profile', 'email'] })(req, res, next);
  }
);
router.get(
  '/google/callback',
  (req, res, next) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=google_not_configured`);
    }
    passport.authenticate('google', { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=google_failed` })(req, res, next);
  },
  authController.oauthCallback
);

// ─── GitHub OAuth ────────────────────────────────────────────────
router.get(
  '/github',
  oauthLimiter,
  (req, res, next) => {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=github_not_configured`);
    }
    passport.authenticate('github', { session: false, scope: ['user:email'] })(req, res, next);
  }
);
router.get(
  '/github/callback',
  (req, res, next) => {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=github_not_configured`);
    }
    passport.authenticate('github', { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=github_failed` })(req, res, next);
  },
  authController.oauthCallback
);

export default router;
