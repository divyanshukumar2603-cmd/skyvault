import { describe, it, expect } from 'vitest';
import {
  buildUserProfile,
  rankProducts,
  scoreProduct,
  priceFit,
  popularityScores,
  decayFactor,
  INTERACTION_WEIGHTS,
  HALF_LIFE_DAYS,
  type Signal,
  type RankableProduct,
} from '../../src/modules/products/ranking';

const NOW = new Date('2026-01-15T12:00:00Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000);

const CATALOGUE: RankableProduct[] = [
  { id: 'laptop', category: 'Electronics', brand: 'Aurora', price: 1299, rating: 4.6 },
  { id: 'earbuds', category: 'Electronics', brand: 'Aurora', price: 179, rating: 4.4 },
  { id: 'skillet', category: 'Home', brand: 'Hearth', price: 69, rating: 4.8 },
  { id: 'duvet', category: 'Home', brand: 'Drift', price: 269, rating: 4.7 },
  { id: 'coat', category: 'Fashion', brand: 'Meridian', price: 389, rating: 4.3 },
];

const signal = (over: Partial<Signal> = {}): Signal => ({
  type: 'VIEW',
  createdAt: daysAgo(1),
  category: 'Electronics',
  brand: 'Aurora',
  price: 200,
  ...over,
});

describe('Ranking — time decay', () => {
  it('halves an interaction\'s weight after exactly one half-life', () => {
    expect(decayFactor(daysAgo(HALF_LIFE_DAYS), NOW)).toBeCloseTo(0.5, 6);
    expect(decayFactor(daysAgo(HALF_LIFE_DAYS * 2), NOW)).toBeCloseTo(0.25, 6);
  });

  it('gives a brand-new interaction full weight', () => {
    expect(decayFactor(new Date(NOW), NOW)).toBe(1);
  });

  it('never returns a negative weight for a future timestamp', () => {
    expect(decayFactor(new Date(NOW + 86_400_000), NOW)).toBe(1);
  });
});

describe('Ranking — interaction weights', () => {
  it('values a purchase far above a view', () => {
    expect(INTERACTION_WEIGHTS.PURCHASE).toBeGreaterThan(INTERACTION_WEIGHTS.CART);
    expect(INTERACTION_WEIGHTS.CART).toBeGreaterThan(INTERACTION_WEIGHTS.CLICK);
    expect(INTERACTION_WEIGHTS.CLICK).toBeGreaterThan(INTERACTION_WEIGHTS.VIEW);
  });

  it('lets one purchase outweigh several stale views', () => {
    const profile = buildUserProfile(
      [
        signal({ type: 'PURCHASE', category: 'Home', brand: 'Hearth', createdAt: daysAgo(0) }),
        signal({ type: 'VIEW', category: 'Fashion', brand: 'Meridian', createdAt: daysAgo(21) }),
        signal({ type: 'VIEW', category: 'Fashion', brand: 'Meridian', createdAt: daysAgo(21) }),
        signal({ type: 'VIEW', category: 'Fashion', brand: 'Meridian', createdAt: daysAgo(21) }),
      ],
      NOW
    );
    expect(profile.categoryAffinity.Home).toBeGreaterThan(profile.categoryAffinity.Fashion);
  });
});

describe('Ranking — user profile', () => {
  it('reports a cold start when there is no history', () => {
    const profile = buildUserProfile([], NOW);
    expect(profile.totalWeight).toBe(0);
    expect(profile.preferredPrice).toBeNull();
    expect(profile.categoryAffinity).toEqual({});
  });

  it('normalises the strongest affinity to 1', () => {
    const profile = buildUserProfile(
      [
        signal({ category: 'Electronics', type: 'PURCHASE' }),
        signal({ category: 'Home', brand: 'Hearth', type: 'VIEW' }),
      ],
      NOW
    );
    expect(Math.max(...Object.values(profile.categoryAffinity))).toBeCloseTo(1, 6);
    expect(profile.categoryAffinity.Home).toBeLessThan(1);
  });

  it('derives a preferred price from engaged products', () => {
    const profile = buildUserProfile(
      [
        signal({ price: 100, type: 'VIEW', createdAt: new Date(NOW) }),
        signal({ price: 200, type: 'VIEW', createdAt: new Date(NOW) }),
      ],
      NOW
    );
    expect(profile.preferredPrice).toBeCloseTo(150, 6);
  });
});

describe('Ranking — price fit', () => {
  it('peaks at the user\'s preferred price and falls off with distance', () => {
    const profile = buildUserProfile([signal({ price: 200, createdAt: new Date(NOW) })], NOW);
    const atPreferred = priceFit(200, profile);
    const farAway = priceFit(2000, profile);
    expect(atPreferred).toBeCloseTo(1, 4);
    expect(farAway).toBeLessThan(atPreferred);
    expect(farAway).toBeGreaterThanOrEqual(0);
  });

  it('is neutral when the user has no price history', () => {
    expect(priceFit(500, buildUserProfile([], NOW))).toBe(0);
  });
});

describe('Ranking — popularity', () => {
  it('normalises the busiest product to 1 and damps runaway counts', () => {
    const scores = popularityScores({ a: 1000, b: 10, c: 0 });
    expect(scores.a).toBeCloseTo(1, 6);
    expect(scores.b).toBeGreaterThan(0);
    expect(scores.b).toBeLessThan(scores.a);
    // log damping: 100x the engagement must not mean 100x the score
    expect(scores.b).toBeGreaterThan(scores.a / 100);
  });

  it('returns no scores when nothing has been engaged with', () => {
    expect(popularityScores({})).toEqual({});
  });
});

describe('Ranking — end to end', () => {
  it('ranks a cold-start user by popularity and rating only', () => {
    const profile = buildUserProfile([], NOW);
    const ranked = rankProducts(CATALOGUE, profile, { coat: 100 });

    expect(ranked[0].personalized).toBe(false);
    expect(ranked[0].product.id).toBe('coat'); // the only product with engagement
    for (const r of ranked) {
      expect(r.breakdown.category).toBe(0);
      expect(r.breakdown.brand).toBe(0);
      expect(r.breakdown.price).toBe(0);
    }
  });

  it('promotes the category a user actually engages with', () => {
    const profile = buildUserProfile(
      [
        signal({ category: 'Home', brand: 'Hearth', price: 69, type: 'PURCHASE', createdAt: daysAgo(1) }),
        signal({ category: 'Home', brand: 'Drift', price: 269, type: 'CART', createdAt: daysAgo(2) }),
      ],
      NOW
    );
    const ranked = rankProducts(CATALOGUE, profile, {});

    expect(ranked[0].personalized).toBe(true);
    expect(ranked[0].product.category).toBe('Home');
    expect(ranked[0].reason).toContain('Home');
  });

  it('ranks the same catalogue differently for two different users', () => {
    const techie = buildUserProfile(
      [signal({ category: 'Electronics', brand: 'Aurora', price: 1299, type: 'PURCHASE', createdAt: daysAgo(1) })],
      NOW
    );
    const homebody = buildUserProfile(
      [signal({ category: 'Home', brand: 'Hearth', price: 69, type: 'PURCHASE', createdAt: daysAgo(1) })],
      NOW
    );

    const forTechie = rankProducts(CATALOGUE, techie, {}).map((r) => r.product.id);
    const forHomebody = rankProducts(CATALOGUE, homebody, {}).map((r) => r.product.id);

    expect(forTechie).not.toEqual(forHomebody);
    expect(forTechie[0]).toBe('laptop');
    expect(forHomebody[0]).toBe('skillet');
  });

  it('produces a deterministic order for identical scores', () => {
    const profile = buildUserProfile([], NOW);
    const a = rankProducts(CATALOGUE, profile, {}).map((r) => r.product.id);
    const b = rankProducts(CATALOGUE, profile, {}).map((r) => r.product.id);
    expect(a).toEqual(b);
  });

  it('keeps every score within 0..1', () => {
    const profile = buildUserProfile(
      [signal({ category: 'Electronics', type: 'PURCHASE', createdAt: new Date(NOW) })],
      NOW
    );
    for (const r of rankProducts(CATALOGUE, profile, { laptop: 500, skillet: 20 })) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it('explains every ranked product', () => {
    const profile = buildUserProfile([signal({ type: 'CLICK' })], NOW);
    for (const r of rankProducts(CATALOGUE, profile, {})) {
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});
