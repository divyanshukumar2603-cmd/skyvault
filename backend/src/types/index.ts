import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
