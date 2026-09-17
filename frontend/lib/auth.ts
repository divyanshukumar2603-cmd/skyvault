'use client';
import { setAccessToken, getAccessToken, authApi } from './api';

export async function loginAndStore(email: string, password: string) {
  const res = await authApi.login(email, password);
  setAccessToken(res.data.accessToken);
  return res;
}

export async function registerAndStore(email: string, password: string, displayName?: string) {
  const res = await authApi.register(email, password, displayName);
  setAccessToken(res.data.accessToken);
  return res;
}

export function storeOAuthToken(token: string) {
  setAccessToken(token);
}

export async function logout() {
  await authApi.logout().catch(() => {});
  setAccessToken(null);
  window.location.href = '/login';
}

export function isAuthenticated() {
  return !!getAccessToken();
}
