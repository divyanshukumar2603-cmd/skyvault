import prisma from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import {
  buildUserProfile,
  rankProducts,
  INTERACTION_WEIGHTS,
  decayFactor,
  type InteractionType,
  type Signal,
} from './ranking';

/** Interactions older than this contribute almost nothing after decay, so we ignore them. */
const HISTORY_WINDOW_DAYS = 90;

export interface ListOptions {
  category?: string;
  search?: string;
  limit?: number;
}

function toPlainProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    brand: p.brand,
    price: Number(p.price),
    rating: p.rating,
    ratingCount: p.ratingCount,
    imageS3Key: p.imageS3Key,
    inStock: p.inStock,
  };
}

/** Weighted, time-decayed engagement per product across every user. */
async function globalEngagement(): Promise<Record<string, number>> {
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86_400_000);
  const rows = await prisma.productInteraction.findMany({
    where: { createdAt: { gte: since } },
    select: { productId: true, type: true, createdAt: true },
  });

  const totals: Record<string, number> = {};
  for (const row of rows) {
    const weight = INTERACTION_WEIGHTS[row.type as InteractionType] * decayFactor(row.createdAt);
    totals[row.productId] = (totals[row.productId] ?? 0) + weight;
  }
  return totals;
}

/** This user's history, joined with the product attributes the engine needs. */
async function userSignals(userId: string): Promise<Signal[]> {
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86_400_000);
  const rows = await prisma.productInteraction.findMany({
    where: { userId, createdAt: { gte: since } },
    select: {
      type: true,
      createdAt: true,
      product: { select: { category: true, brand: true, price: true } },
    },
  });

  return rows.map((r) => ({
    type: r.type as InteractionType,
    createdAt: r.createdAt,
    category: r.product.category,
    brand: r.product.brand,
    price: Number(r.product.price),
  }));
}

/**
 * The catalogue, ordered for this specific user.
 * Filters narrow what is ranked; they never change how scoring works.
 */
export async function getRankedProducts(userId: string, options: ListOptions = {}) {
  const { category, search, limit = 60 } = options;

  const products = await prisma.product.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
              { brand: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    take: limit,
  });

  const [signals, engagement] = await Promise.all([userSignals(userId), globalEngagement()]);
  const profile = buildUserProfile(signals);
  const ranked = rankProducts(products.map(toPlainProduct), profile, engagement);

  return {
    personalized: profile.totalWeight > 0,
    signalCount: profile.signalCount,
    products: ranked.map((r, index) => ({
      ...r.product,
      rank: index + 1,
      score: Number(r.score.toFixed(4)),
      reason: r.reason,
      breakdown: {
        category: Number(r.breakdown.category.toFixed(4)),
        brand: Number(r.breakdown.brand.toFixed(4)),
        price: Number(r.breakdown.price.toFixed(4)),
        popularity: Number(r.breakdown.popularity.toFixed(4)),
        rating: Number(r.breakdown.rating.toFixed(4)),
      },
    })),
  };
}

export async function getProduct(userId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError(404, 'Product not found');

  const [signals, engagement] = await Promise.all([userSignals(userId), globalEngagement()]);
  const profile = buildUserProfile(signals);
  const [scored] = rankProducts([toPlainProduct(product)], profile, engagement);

  return {
    ...scored.product,
    score: Number(scored.score.toFixed(4)),
    reason: scored.reason,
    breakdown: scored.breakdown,
  };
}

const VALID_TYPES: InteractionType[] = ['VIEW', 'CLICK', 'CART', 'PURCHASE'];

/** Record a signal. Every call reshapes this user's future rankings. */
export async function recordInteraction(userId: string, productId: string, type: string, rank?: number) {
  if (!VALID_TYPES.includes(type as InteractionType)) {
    throw new AppError(400, `Invalid interaction type. Expected one of: ${VALID_TYPES.join(', ')}`);
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new AppError(404, 'Product not found');

  const rankAtInteraction = Number.isInteger(rank) && (rank as number) > 0 ? (rank as number) : null;

  await prisma.productInteraction.create({
    data: { userId, productId, type: type as any, rankAtInteraction },
  });

  logger.info('Product interaction recorded', { userId, productId, type, rankAtInteraction });
  return { recorded: true, type, rankAtInteraction };
}

/** The user's taste profile, exposed so the UI can show why ranking looks the way it does. */
export async function getUserInsights(userId: string) {
  const signals = await userSignals(userId);
  const profile = buildUserProfile(signals);

  const top = (affinity: Record<string, number>) =>
    Object.entries(affinity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, weight]) => ({ name, weight: Number(weight.toFixed(3)) }));

  const counts = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    personalized: profile.totalWeight > 0,
    signalCount: profile.signalCount,
    interactionCounts: counts,
    topCategories: top(profile.categoryAffinity),
    topBrands: top(profile.brandAffinity),
    preferredPrice: profile.preferredPrice === null ? null : Number(profile.preferredPrice.toFixed(2)),
    priceSpread: Number(profile.priceSpread.toFixed(2)),
  };
}

export async function getCategories() {
  const rows = await prisma.product.groupBy({ by: ['category'], _count: { category: true } });
  return rows
    .map((r) => ({ category: r.category, count: r._count.category }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

/** Wipe this user's history — lets a demo return to the cold-start path on command. */
export async function resetHistory(userId: string) {
  const { count } = await prisma.productInteraction.deleteMany({ where: { userId } });
  logger.info('Product interaction history reset', { userId, count });
  return { deleted: count };
}
