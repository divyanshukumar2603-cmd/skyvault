import { Response, NextFunction } from 'express';
import * as analyticsService from './analytics.service';
import { AuthenticatedRequest } from '../../types';

const windowDays = (req: AuthenticatedRequest, fallback = 30) => {
  const raw = parseInt(String(req.query.days ?? ''), 10);
  if (Number.isNaN(raw)) return fallback;
  return Math.min(Math.max(raw, 1), 365);
};

export async function getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const days = windowDays(req);
    const [overview, funnel, topProducts, categories, trend, effectiveness] = await Promise.all([
      analyticsService.getOverview(days),
      analyticsService.getFunnel(days),
      analyticsService.getTopProducts(days),
      analyticsService.getCategoryPerformance(days),
      analyticsService.getTrend(Math.min(days, 30)),
      analyticsService.getRankingEffectiveness(days),
    ]);
    res.json({ success: true, data: { overview, funnel, topProducts, categories, trend, effectiveness } });
  } catch (err) { next(err); }
}

export async function getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getOverview(windowDays(req)) });
  } catch (err) { next(err); }
}

export async function getFunnel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getFunnel(windowDays(req)) });
  } catch (err) { next(err); }
}

export async function getTopProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '10'), 10) || 10, 1), 50);
    res.json({ success: true, data: await analyticsService.getTopProducts(windowDays(req), limit) });
  } catch (err) { next(err); }
}

export async function getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getCategoryPerformance(windowDays(req)) });
  } catch (err) { next(err); }
}

export async function getTrend(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getTrend(windowDays(req, 14)) });
  } catch (err) { next(err); }
}

export async function getEffectiveness(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getRankingEffectiveness(windowDays(req)) });
  } catch (err) { next(err); }
}
