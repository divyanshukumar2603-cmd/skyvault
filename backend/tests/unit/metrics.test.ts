import { describe, it, expect } from 'vitest';
import {
  buildFunnel,
  catalogueCoverage,
  engagementConcentration,
  meanRank,
  fillDailySeries,
} from '../../src/modules/analytics/metrics';

describe('Analytics — conversion funnel', () => {
  it('computes step and overall conversion at each stage', () => {
    const funnel = buildFunnel({ VIEW: 1000, CLICK: 400, CART: 100, PURCHASE: 25 });

    expect(funnel.map((s) => s.stage)).toEqual(['VIEW', 'CLICK', 'CART', 'PURCHASE']);
    expect(funnel[0].overallConversion).toBe(1);
    expect(funnel[1].stepConversion).toBeCloseTo(0.4, 6);   // 400/1000
    expect(funnel[2].stepConversion).toBeCloseTo(0.25, 6);  // 100/400
    expect(funnel[3].stepConversion).toBeCloseTo(0.25, 6);  // 25/100
    expect(funnel[3].overallConversion).toBeCloseTo(0.025, 6); // 25/1000
  });

  it('does not divide by zero on an empty funnel', () => {
    const funnel = buildFunnel({});
    for (const stage of funnel) {
      expect(stage.count).toBe(0);
      expect(stage.stepConversion).toBe(0);
      expect(stage.overallConversion).toBe(0);
    }
  });

  it('reports every stage even when some are missing', () => {
    const funnel = buildFunnel({ VIEW: 10, PURCHASE: 1 });
    expect(funnel).toHaveLength(4);
    expect(funnel[1].count).toBe(0);
    expect(funnel[3].overallConversion).toBeCloseTo(0.1, 6);
  });
});

describe('Analytics — catalogue coverage', () => {
  it('measures the share of the catalogue that saw engagement', () => {
    expect(catalogueCoverage(['a', 'b', 'a', 'c'], 10)).toBeCloseTo(0.3, 6);
  });

  it('counts each product once regardless of interaction volume', () => {
    expect(catalogueCoverage(['a', 'a', 'a', 'a'], 4)).toBeCloseTo(0.25, 6);
  });

  it('returns zero for an empty catalogue rather than dividing by zero', () => {
    expect(catalogueCoverage([], 0)).toBe(0);
  });
});

describe('Analytics — engagement concentration', () => {
  it('detects engagement captured by a handful of products', () => {
    expect(engagementConcentration([100, 1, 1, 1, 1, 1, 1], 1)).toBeCloseTo(100 / 106, 6);
  });

  it('approaches an even share when engagement is uniform', () => {
    expect(engagementConcentration([10, 10, 10, 10, 10, 10, 10, 10, 10, 10], 5)).toBeCloseTo(0.5, 6);
  });

  it('returns zero when there is no engagement', () => {
    expect(engagementConcentration([], 5)).toBe(0);
    expect(engagementConcentration([0, 0, 0], 5)).toBe(0);
  });
});

describe('Analytics — mean rank', () => {
  it('averages only the positions that were actually recorded', () => {
    expect(meanRank([1, 3, null, 5, null])).toBeCloseTo(3, 6);
  });

  it('returns null when nothing carried a position', () => {
    expect(meanRank([null, null])).toBeNull();
    expect(meanRank([])).toBeNull();
  });

  it('shows a lower mean rank for actions concentrated at the top', () => {
    const purchases = meanRank([1, 2, 1, 3])!;
    const views = meanRank([12, 20, 8, 15])!;
    expect(purchases).toBeLessThan(views);
  });
});

describe('Analytics — daily series', () => {
  const NOW = new Date('2026-01-10T12:00:00Z');

  it('fills days that have no data with zero', () => {
    const series = fillDailySeries([{ day: '2026-01-10', count: 5 }], 3, NOW);
    expect(series).toHaveLength(3);
    expect(series.map((s) => s.day)).toEqual(['2026-01-08', '2026-01-09', '2026-01-10']);
    expect(series.map((s) => s.count)).toEqual([0, 0, 5]);
  });

  it('returns days in chronological order ending today', () => {
    const series = fillDailySeries([], 7, NOW);
    expect(series[0].day).toBe('2026-01-04');
    expect(series[series.length - 1].day).toBe('2026-01-10');
  });

  it('ignores data outside the requested window', () => {
    const series = fillDailySeries([{ day: '2025-12-01', count: 99 }], 2, NOW);
    expect(series.every((s) => s.count === 0)).toBe(true);
  });
});
