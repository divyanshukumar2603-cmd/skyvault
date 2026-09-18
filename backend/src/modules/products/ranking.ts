/**
 * Personalized product ranking.
 *
 * Scoring is deliberately kept as pure functions with no database or network
 * access: the engine can be unit-tested, explained, and re-tuned without
 * touching the rest of the application.
 *
 * A product's score blends five signals:
 *
 *   category affinity  how much this user engages with the product's category
 *   brand affinity     the same, per brand
 *   price fit          how close the price is to what this user usually engages with
 *   popularity         weighted engagement across all users (log-damped)
 *   rating             the product's own customer rating
 *
 * Personal signals need history. A brand-new user has none, so the weights
 * fall back to the signals that do not depend on the individual (popularity
 * and rating) — the classic cold-start path.
 */

export type InteractionType = 'VIEW' | 'CLICK' | 'CART' | 'PURCHASE';

/** How much each action says about intent. A purchase means far more than a glance. */
export const INTERACTION_WEIGHTS: Record<InteractionType, number> = {
  VIEW: 1,
  CLICK: 3,
  CART: 6,
  PURCHASE: 10,
};

/** Engagement loses half its influence every 7 days, so rankings track current taste. */
export const HALF_LIFE_DAYS = 7;

export const PERSONALIZED_WEIGHTS = {
  category: 0.4,
  brand: 0.15,
  price: 0.15,
  popularity: 0.2,
  rating: 0.1,
};

/** Without history the personal terms are all zero, so only these two carry weight. */
export const COLD_START_WEIGHTS = {
  category: 0,
  brand: 0,
  price: 0,
  popularity: 0.65,
  rating: 0.35,
};

export interface Signal {
  type: InteractionType;
  createdAt: Date;
  category: string;
  brand: string;
  price: number;
}

export interface UserProfile {
  categoryAffinity: Record<string, number>;
  brandAffinity: Record<string, number>;
  preferredPrice: number | null;
  priceSpread: number;
  totalWeight: number;
  signalCount: number;
}

export interface RankableProduct {
  id: string;
  category: string;
  brand: string;
  price: number;
  rating: number;
}

export interface ScoreBreakdown {
  category: number;
  brand: number;
  price: number;
  popularity: number;
  rating: number;
}

export interface ScoredProduct<T> {
  product: T;
  score: number;
  breakdown: ScoreBreakdown;
  reason: string;
  personalized: boolean;
}

/** Exponential time decay: an interaction's weight halves every HALF_LIFE_DAYS. */
export function decayFactor(createdAt: Date, now: number = Date.now()): number {
  const ageDays = Math.max(0, (now - createdAt.getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** Collapse a user's raw interaction history into taste affinities. */
export function buildUserProfile(signals: Signal[], now: number = Date.now()): UserProfile {
  const categoryWeights: Record<string, number> = {};
  const brandWeights: Record<string, number> = {};
  let totalWeight = 0;
  let priceWeightedSum = 0;

  for (const s of signals) {
    const weight = INTERACTION_WEIGHTS[s.type] * decayFactor(s.createdAt, now);
    if (weight <= 0) continue;
    categoryWeights[s.category] = (categoryWeights[s.category] ?? 0) + weight;
    brandWeights[s.brand] = (brandWeights[s.brand] ?? 0) + weight;
    priceWeightedSum += s.price * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return {
      categoryAffinity: {},
      brandAffinity: {},
      preferredPrice: null,
      priceSpread: 0,
      totalWeight: 0,
      signalCount: signals.length,
    };
  }

  const preferredPrice = priceWeightedSum / totalWeight;

  // Weighted standard deviation of engaged prices — how broad this user's range is.
  let varianceSum = 0;
  for (const s of signals) {
    const weight = INTERACTION_WEIGHTS[s.type] * decayFactor(s.createdAt, now);
    varianceSum += weight * Math.pow(s.price - preferredPrice, 2);
  }
  const priceSpread = Math.sqrt(varianceSum / totalWeight);

  // Normalise affinities against the strongest one, so each sits in 0..1.
  const normalise = (weights: Record<string, number>) => {
    const max = Math.max(...Object.values(weights));
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(weights)) out[key] = value / max;
    return out;
  };

  return {
    categoryAffinity: normalise(categoryWeights),
    brandAffinity: normalise(brandWeights),
    preferredPrice,
    priceSpread,
    totalWeight,
    signalCount: signals.length,
  };
}

/**
 * How well a price matches the user's habits, as a Gaussian around their
 * weighted average price. A user with a wide spread is judged leniently.
 */
export function priceFit(price: number, profile: UserProfile): number {
  if (profile.preferredPrice === null) return 0;
  const sigma = Math.max(profile.priceSpread, profile.preferredPrice * 0.5, 1);
  return Math.exp(-Math.pow(price - profile.preferredPrice, 2) / (2 * sigma * sigma));
}

/**
 * Global engagement, log-damped so a single runaway product cannot flatten
 * everything else, then normalised against the busiest product.
 */
export function popularityScores(
  weightedEngagement: Record<string, number>
): Record<string, number> {
  const damped: Record<string, number> = {};
  for (const [id, weight] of Object.entries(weightedEngagement)) damped[id] = Math.log1p(weight);
  const max = Math.max(0, ...Object.values(damped));
  if (max === 0) return {};
  const out: Record<string, number> = {};
  for (const [id, value] of Object.entries(damped)) out[id] = value / max;
  return out;
}

/** The single strongest reason a product ended up where it did. */
function explain(breakdown: ScoreBreakdown, product: RankableProduct, personalized: boolean): string {
  if (!personalized) {
    return breakdown.popularity >= breakdown.rating
      ? 'Popular with other shoppers'
      : `Highly rated (${product.rating.toFixed(1)}★)`;
  }
  const entries = Object.entries(breakdown) as [keyof ScoreBreakdown, number][];
  const [top] = entries.sort((a, b) => b[1] - a[1]);
  switch (top[0]) {
    case 'category':
      return `You browse ${product.category} often`;
    case 'brand':
      return `You engage with ${product.brand}`;
    case 'price':
      return 'Matches your usual price range';
    case 'popularity':
      return 'Trending across all shoppers';
    default:
      return `Highly rated (${product.rating.toFixed(1)}★)`;
  }
}

/** Score one product for one user. Contributions are weight × signal. */
export function scoreProduct<T extends RankableProduct>(
  product: T,
  profile: UserProfile,
  popularity: number
): ScoredProduct<T> {
  const personalized = profile.totalWeight > 0;
  const weights = personalized ? PERSONALIZED_WEIGHTS : COLD_START_WEIGHTS;

  const breakdown: ScoreBreakdown = {
    category: weights.category * (profile.categoryAffinity[product.category] ?? 0),
    brand: weights.brand * (profile.brandAffinity[product.brand] ?? 0),
    price: weights.price * priceFit(product.price, profile),
    popularity: weights.popularity * popularity,
    rating: weights.rating * (product.rating / 5),
  };

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return {
    product,
    score,
    breakdown,
    reason: explain(breakdown, product, personalized),
    personalized,
  };
}

/** Rank a catalogue for a user, highest score first. */
export function rankProducts<T extends RankableProduct>(
  products: T[],
  profile: UserProfile,
  weightedEngagement: Record<string, number>
): ScoredProduct<T>[] {
  const popularity = popularityScores(weightedEngagement);
  return products
    .map((p) => scoreProduct(p, profile, popularity[p.id] ?? 0))
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
}
