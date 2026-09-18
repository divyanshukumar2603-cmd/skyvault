import argon2 from 'argon2';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/db';
import { signAccessToken } from '../../utils/jwt';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function registerUser(email: string, password: string, displayName?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'Email already registered');

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName: displayName ?? email.split('@')[0] },
    select: { id: true, email: true, displayName: true, storageUsed: true, storageQuota: true, createdAt: true },
  });
  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw new AppError(401, 'Invalid email or password');

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) throw new AppError(401, 'Invalid email or password');

  return issueTokenPair(user.id, user.email);
}

export async function refreshTokens(rawToken: string) {
  // Refresh tokens are opaque (see issueTokenPair), not JWTs: they carry no
  // payload, so the stored row is the sole source of identity and family.
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) throw new AppError(401, 'Invalid refresh token');

  // Reuse detection: revoke entire family
  if (stored.isUsed) {
    await prisma.refreshToken.deleteMany({ where: { familyId: stored.familyId } });
    logger.warn('Refresh token reuse detected — revoked family', { familyId: stored.familyId });
    throw new AppError(401, 'Refresh token reuse detected. Please log in again.');
  }

  if (new Date() > stored.expiresAt) {
    await prisma.refreshToken.delete({ where: { tokenHash } });
    throw new AppError(401, 'Refresh token expired');
  }

  // Mark old token as used
  await prisma.refreshToken.update({ where: { tokenHash }, data: { isUsed: true } });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw new AppError(401, 'User not found');

  return issueTokenPair(user.id, user.email, stored.familyId);
}

export async function logoutUser(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (stored) {
    await prisma.refreshToken.deleteMany({ where: { familyId: stored.familyId } });
  }
}

export async function issueTokenPair(userId: string, email: string, existingFamilyId?: string) {
  const familyId = existingFamilyId ?? uuidv4();
  const rawRefresh = uuidv4() + '-' + uuidv4();
  const tokenHash = hashToken(rawRefresh);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.refreshToken.create({
    data: { userId, tokenHash, familyId, expiresAt },
  });

  const accessToken = signAccessToken({ userId, email });
  return { accessToken, refreshToken: rawRefresh };
}

export async function findOrCreateOAuthUser(profile: {
  provider: string;
  providerUserId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}) {
  // 1. Check existing OAuth link
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider: profile.provider, providerUserId: profile.providerUserId } },
    include: { user: true },
  });
  if (existing) return existing.user;

  // 2. Link to existing user with same email
  let user = await prisma.user.findUnique({ where: { email: profile.email } });

  // 3. Create new user if no match
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        displayName: profile.displayName ?? profile.email.split('@')[0],
        avatarUrl: profile.avatarUrl,
      },
    });
  }

  // Create the OAuth link
  await prisma.oAuthAccount.create({
    data: {
      userId: user.id,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
    },
  });

  return user;
}
