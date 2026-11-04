import { getApiBaseUrl } from './config';
import type { AuthUser, BranchSummary, MembershipRestaurant } from './types';

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function login(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rememberMe }),
  });

  if (!res.ok) {
    const body = await parseJson<{ message?: string | string[] }>(res);
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? 'Login failed');
    return { ok: false, message };
  }

  const data = await parseJson<{ user: AuthUser }>(res);
  if (!data?.user) return { ok: false, message: 'Login failed' };
  return { ok: true, user: data.user };
}

export async function logout(): Promise<void> {
  await fetch(`${getApiBaseUrl()}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
    credentials: 'include',
  });
  if (!res.ok) return null;
  const data = await parseJson<{ user: AuthUser }>(res);
  return data?.user ?? null;
}

export function hasPartnerCapability(user: AuthUser): boolean {
  return (user.capabilities ?? []).includes('partner');
}

export async function fetchMyRestaurants(): Promise<MembershipRestaurant[]> {
  const res = await fetch(`${getApiBaseUrl()}/restaurants/mine`, {
    credentials: 'include',
  });
  if (!res.ok) return [];
  const data = await parseJson<MembershipRestaurant[]>(res);
  return data ?? [];
}

export async function fetchBranches(restaurantId: string): Promise<BranchSummary[]> {
  const res = await fetch(`${getApiBaseUrl()}/restaurants/${restaurantId}/branches`, {
    credentials: 'include',
  });
  if (!res.ok) return [];
  const data = await parseJson<BranchSummary[]>(res);
  return data ?? [];
}

export function partnerPath(
  restaurantId: string,
  branchId: string,
  area: string = 'orders',
): string {
  return `/r/${restaurantId}/b/${branchId}/${area}`;
}
