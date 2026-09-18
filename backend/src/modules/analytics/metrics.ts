/**
 * Analytical metric computations.
 *
 * Kept free of database access for the same reason the ranking engine is:
 * these are the numbers the platform reports about itself, so they need to be
 * verifiable in isolation.
 */

export type InteractionType = 'VIEW' | 'CLICK' | 'CART' | 'PURCHASE';

export const FUNNEL_ORDER: InteractionType[] = ['VIEW', 'CLICK', 'CART', 'PURCHASE'];

export interface FunnelStage {
  stage: InteractionType;
  count: number;
  /** Share of the stage above it — how many progressed one step further. */
  stepConversion: number;
  /** Share of the top of the funnel that reached this stage. */
  overallConversion: number;
}

/** Turn raw per-type counts into a funnel with both step and overall conversion. */
export function buildFunnel(counts: Partial<Record<InteractionType, number>>): FunnelStage[] {
  const top = counts[FUNNEL_ORDER[0]] ?? 0;
  return FUNNEL_ORDER.map((stage, i) => {
    const count = counts[stage] ?? 0;
    const previous = i === 0 ? count : counts[FUNNEL_ORDER[i - 1]] ?? 0;
    return {
      stage,
      count,
      stepConversion: previous > 0 ? count / previous : 0,
      overallConversion: top > 0 ? count / top : 0,
    };
  });
}

/**
 * Share of the catalogue that received any engagement at all.
 *
 * A recommender that only ever surfaces the same handful of products scores
 * poorly here even when its click-through looks healthy, so this is the
 * counterweight to the popularity signal.
 */
export function catalogueCoverage(engagedProductIds: string[], totalProducts: number): number {
  if (totalProducts === 0) return 0;
  return new Set(engagedProductIds).size / totalProducts;
}

/**
 * Share of all engagement captured by the top N products. High concentration
 * means the long tail is being starved.
 */
export function engagementConcentration(counts: number[], topN = 5): number {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total === 0) return 0;
  const top = [...counts].sort((a, b) => b - a).slice(0, topN).reduce((sum, c) => sum + c, 0);
  return top / total;
}

/**
 * Mean position at which an action occurred.
 *
 * This is the platform's headline measure of ranking quality: if purchases
 * happen at a markedly lower mean rank than views, the ordering is putting the
 * right products in front of people. Interactions recorded without a position
 * (for example through the API directly) are excluded rather than assumed.
 */
export function meanRank(ranks: (number | null)[]): number | null {
  const present = ranks.filter((r): r is number => typeof r === 'number');
  if (present.length === 0) return null;
  return present.reduce((sum, r) => sum + r, 0) / present.length;
}

/** Fill gaps in a daily series so charts show continuous time, not just days with data. */
export function fillDailySeries(
  rows: { day: string; count: number }[],
  days: number,
  now: Date = new Date()
): { day: string; count: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}
