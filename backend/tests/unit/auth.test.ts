import { describe, it, expect } from 'vitest';
import argon2 from 'argon2';

describe('Auth Password Hashing (Argon2id)', () => {
  it('should hash and verify passwords correctly', async () => {
    const password = 'SuperSecretSecurePassword123!';
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const isValid = await argon2.verify(hash, password);
    expect(isValid).toBe(true);

    const isWrong = await argon2.verify(hash, 'wrongpassword');
    expect(isWrong).toBe(false);
  });
});
