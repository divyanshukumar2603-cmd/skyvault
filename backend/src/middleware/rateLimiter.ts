import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many OAuth requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
