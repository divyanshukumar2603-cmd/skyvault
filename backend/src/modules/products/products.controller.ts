import { Response, NextFunction } from 'express';
import * as productsService from './products.service';
import { AuthenticatedRequest } from '../../types';

export async function listProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { category, search, limit } = req.query;
    const data = await productsService.getRankedProducts(req.user!.id, {
      category: typeof category === 'string' && category ? category : undefined,
      search: typeof search === 'string' && search ? search : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await productsService.getCategories() });
  } catch (err) { next(err); }
}

export async function getInsights(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await productsService.getUserInsights(req.user!.id) });
  } catch (err) { next(err); }
}

export async function getProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await productsService.getProduct(req.user!.id, req.params.id) });
  } catch (err) { next(err); }
}

export async function recordInteraction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await productsService.recordInteraction(req.user!.id, req.params.id, req.body.type, req.body.rank);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function resetHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await productsService.resetHistory(req.user!.id) });
  } catch (err) { next(err); }
}
