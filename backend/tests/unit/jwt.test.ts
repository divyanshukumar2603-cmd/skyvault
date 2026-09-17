import { describe, it, expect } from 'vitest';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../src/utils/jwt';

describe('JWT Utilities', () => {
  it('should sign and verify an access token', () => {
    const payload = { userId: 'user_123', email: 'test@example.com' };
    const token = signAccessToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('should sign and verify a refresh token', () => {
    const payload = { userId: 'user_456', familyId: 'fam_789' };
    const token = signRefreshToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.familyId).toBe(payload.familyId);
  });

  it('should reject invalid or tampered tokens', () => {
    const token = signAccessToken({ userId: 'u1', email: 'u1@test.com' });
    const tampered = token + 'tampered';

    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
