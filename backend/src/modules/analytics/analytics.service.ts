import prisma from '../../config/db';
import {
  buildFunnel,
  catalogueCoverage,
  engagementConcentration,
  meanRank,
  fillDailySeries,
  FUNNEL_ORDER,
  type InteractionType,
} from './metrics';
import { INTERACTION_WEIGHTS, decayFactor } from '../products/ranking';

const DEFAULT_WINDOW_DAYS = 30;

function windowStart(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

/**
 * Platform-wide snapshot: catalogue size, audience, engagement and the
 * storage tier the analytics sit on top of.
 */
export async function getOverview(days = DEFAULT_WINDOW_DAYS) {
  const since = windowStart(days);

  const [productCount, interactionCount, distinctShoppers, fileAgg, versionCount, backupCount, personalizedUsers] =
    await Promise.all([
      prisma.product.count(),
      prisma.productInteraction.count({ where: { createdAt: { gte: since } } }),
      prisma.productInteraction.findMany({
        where: { createdAt: { gte: since } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.file.aggregate({ where: { isDeleted: false }, _count: true, _sum: { sizeBytes: true } }),
      prisma.fileVersion.count(),
      prisma.backupRecord.count(),
      prisma.productInteraction.groupBy({ by: ['userId'] }),
    ]);

  return {
    windowDays: days,
    catalogue: { products: productCount },
    audience: {
      activeShoppers: distinctShoppers.length,
      shoppersWithHistory: personalizedUsers.length,
    },
    engagement: { interactions: interactionCount },
    storage: {
      files: fileAgg._count,
      bytes: Number(fileAgg._sum.sizeBytes ?? 0n),
      versions: versionCount,
      backups: backupCount,
    },
  };
}

/** Conversion funnel across the window, plus revenue realised at the bottom of it. */
export async function getFunnel(days = DEFAULT_WINDOW_DAYS) {
  const since = windowStart(days);

  const grouped = await prisma.productInteraction.groupBy({
    by: ['type'],
    where: { createdAt: { gte: since } },
    _count: { type: true },
  });

  const counts = grouped.reduce<Partial<Record<InteractionType, number>>>((acc, row) => {
    acc[row.type as InteractionType] = row._count.type;
    return acc;
  }, {});

  // Revenue is the sum of list prices over completed purchases in the window.
  const purchases = await prisma.productInteraction.findMany({
    where: { type: 'PURCHASE', createdAt: { gte: since } },
    select: { product: { select: { price: true } } },
  });
  const revenue = purchases.reduce((sum, p) => sum + Number(p.product.price), 0);

  return {
    windowDays: days,
    stages: buildFunnel(counts),
    revenue: Number(revenue.toFixed(2)),
    orders: purchases.length,
    averageOrderValue: purchases.length ? Number((revenue / purchases.length).toFixed(2)) : 0,
  };
}

/** Products ordered by weighted, time-decayed engagement — what the catalogue is actually doing. */
export async function getTopProducts(days = DEFAULT_WINDOW_DAYS, limit = 10) {
  const since = windowStart(days);

  const rows = await prisma.productInteraction.findMany({
    where: { createdAt: { gte: since } },
    select: {
      productId: true,
      type: true,
      createdAt: true,
      product: { select: { name: true, category: true, brand: true, price: true } },
    },
  });

  const acc = new Map<string, any>();
  for (const row of rows) {
    const entry = acc.get(row.productId) ?? {
      id: row.productId,
      name: row.product.name,
      category: row.product.category,
      brand: row.product.brand,
      price: Number(row.product.price),
      weighted: 0,
      views: 0,
      clicks: 0,
      carts: 0,
      purchases: 0,
    };
    entry.weighted += INTERACTION_WEIGHTS[row.type as InteractionType] * decayFactor(row.createdAt);
    if (row.type === 'VIEW') entry.views++;
    else if (row.type === 'CLICK') entry.clicks++;
    else if (row.type === 'CART') entry.carts++;
    else if (row.type === 'PURCHASE') entry.purchases++;
    acc.set(row.productId, entry);
  }

  const products = [...acc.values()]
    .map((e) => ({
      ...e,
      weighted: Number(e.weighted.toFixed(2)),
      revenue: Number((e.purchases * e.price).toFixed(2)),
      conversion: e.views > 0 ? Number((e.purchases / e.views).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.weighted - a.weighted);

  return products.slice(0, limit);
}

/** Per-category performance, so merchandising decisions have numbers behind them. */
export async function getCategoryPerformance(days = DEFAULT_WINDOW_DAYS) {
  const since = windowStart(days);

  const rows = await prisma.productInteraction.findMany({
    where: { createdAt: { gte: since } },
    select: { type: true, product: { select: { category: true, price: true } } },
  });

  const acc = new Map<string, any>();
  for (const row of rows) {
    const key = row.product.category;
    const entry = acc.get(key) ?? { category: key, interactions: 0, views: 0, purchases: 0, revenue: 0 };
    entry.interactions++;
    if (row.type === 'VIEW') entry.views++;
    if (row.type === 'PURCHASE') {
      entry.purchases++;
      entry.revenue += Number(row.product.price);
    }
    acc.set(key, entry);
  }

  return [...acc.values()]
    .map((e) => ({
      ...e,
      revenue: Number(e.revenue.toFixed(2)),
      conversion: e.views > 0 ? Number((e.purchases / e.views).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.interactions - a.interactions);
}

/** Daily engagement series, split by signal type. */
export async function getTrend(days = 14) {
  const since = windowStart(days);
  const rows = await prisma.productInteraction.findMany({
    where: { createdAt: { gte: since } },
    select: { type: true, createdAt: true },
  });

  const byType: Record<string, Map<string, number>> = {};
  for (const type of FUNNEL_ORDER) byType[type] = new Map();

  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const map = byType[row.type];
    map.set(day, (map.get(day) ?? 0) + 1);
  }

  const series: Record<string, { day: string; count: number }[]> = {};
  for (const type of FUNNEL_ORDER) {
    series[type] = fillDailySeries(
      [...byType[type].entries()].map(([day, count]) => ({ day, count })),
      days
    );
  }
  return { windowDays: days, series };
}

/**
 * Does the ranking actually work?
 *
 * Mean rank per action is the key line: purchases occurring at a lower mean
 * rank than views means the ordering is putting the right things on top.
 * Coverage and concentration guard against a model that wins by showing
 * everyone the same few products.
 */
export async function getRankingEffectiveness(days = DEFAULT_WINDOW_DAYS) {
  const since = windowStart(days);

  const [rows, productCount] = await Promise.all([
    prisma.productInteraction.findMany({
      where: { createdAt: { gte: since } },
      select: { productId: true, type: true, rankAtInteraction: true },
    }),
    prisma.product.count(),
  ]);

  const ranksByType: Record<string, (number | null)[]> = {};
  const countsByProduct = new Map<string, number>();
  for (const row of rows) {
    (ranksByType[row.type] ??= []).push(row.rankAtInteraction);
    countsByProduct.set(row.productId, (countsByProduct.get(row.productId) ?? 0) + 1);
  }

  const meanRankByType = FUNNEL_ORDER.reduce<Record<string, number | null>>((acc, type) => {
    acc[type] = meanRank(ranksByType[type] ?? []);
    return acc;
  }, {});

  const measured = rows.filter((r) => typeof r.rankAtInteraction === 'number').length;

  return {
    windowDays: days,
    meanRankByType,
    /** Share of interactions that carried a position, i.e. came through the ranked UI. */
    measuredShare: rows.length ? Number((measured / rows.length).toFixed(4)) : 0,
    catalogueCoverage: Number(catalogueCoverage([...countsByProduct.keys()], productCount).toFixed(4)),
    top5Concentration: Number(engagementConcentration([...countsByProduct.values()], 5).toFixed(4)),
    totalInteractions: rows.length,
  };
}
