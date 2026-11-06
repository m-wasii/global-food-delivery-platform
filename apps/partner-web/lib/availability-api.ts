import { getApiBaseUrl } from './config';
import { buildStockRows } from './availability-format';
import type {
  BranchAvailabilitySnapshot,
  BranchMenuOfferingsResponse,
  MenuListEntry,
  MenuTree,
  StockRow,
} from './availability-types';

export {
  WEEKDAY_LABELS,
  formatMinutes,
  formatMoney,
} from './availability-format';

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function errorMessage(body: { message?: string | string[] } | null, fallback: string): string {
  if (!body?.message) return fallback;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

export async function fetchBranchAvailability(
  restaurantId: string,
  branchId: string,
): Promise<BranchAvailabilitySnapshot | null> {
  const res = await fetch(
    `${getApiBaseUrl()}/restaurants/${restaurantId}/branches/${branchId}/availability`,
    { credentials: 'include' },
  );
  if (!res.ok) return null;
  return parseJson<BranchAvailabilitySnapshot>(res);
}

/**
 * Pause / unpause ordering via temporarilyClosed.
 * Owner-only on the API (STAFF receives 403).
 */
export async function setBranchTemporarilyClosed(
  restaurantId: string,
  branchId: string,
  temporarilyClosed: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(
    `${getApiBaseUrl()}/restaurants/${restaurantId}/branches/${branchId}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temporarilyClosed }),
    },
  );

  if (!res.ok) {
    const body = await parseJson<{ message?: string | string[] }>(res);
    return {
      ok: false,
      message: errorMessage(
        body,
        temporarilyClosed
          ? 'Could not pause branch (owner role required).'
          : 'Could not resume branch (owner role required).',
      ),
    };
  }

  return { ok: true };
}

export async function fetchBranchMenuOfferings(
  restaurantId: string,
  branchId: string,
): Promise<BranchMenuOfferingsResponse | null> {
  const res = await fetch(
    `${getApiBaseUrl()}/restaurants/${restaurantId}/branches/${branchId}/menu-items/availability`,
    { credentials: 'include' },
  );
  if (!res.ok) return null;
  return parseJson<BranchMenuOfferingsResponse>(res);
}

export async function setMenuItemInStock(
  restaurantId: string,
  branchId: string,
  menuItemId: string,
  isAvailable: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(
    `${getApiBaseUrl()}/restaurants/${restaurantId}/branches/${branchId}/menu-items/${menuItemId}/availability`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable }),
    },
  );

  if (!res.ok) {
    const body = await parseJson<{ message?: string | string[] }>(res);
    return {
      ok: false,
      message: errorMessage(body, 'Could not update item availability.'),
    };
  }

  return { ok: true };
}

async function fetchMenus(restaurantId: string): Promise<MenuListEntry[]> {
  const res = await fetch(`${getApiBaseUrl()}/restaurants/${restaurantId}/menus`, {
    credentials: 'include',
  });
  if (!res.ok) return [];
  return (await parseJson<MenuListEntry[]>(res)) ?? [];
}

async function fetchMenuTree(restaurantId: string, menuId: string): Promise<MenuTree | null> {
  const res = await fetch(`${getApiBaseUrl()}/restaurants/${restaurantId}/menus/${menuId}`, {
    credentials: 'include',
  });
  if (!res.ok) return null;
  return parseJson<MenuTree>(res);
}

/**
 * Active menu catalog joined with per-branch stock opt-ins.
 * No dedicated list-all endpoint — composed from menus + offerings.
 */
export async function fetchBranchStockRows(
  restaurantId: string,
  branchId: string,
): Promise<StockRow[]> {
  const [menus, offerings] = await Promise.all([
    fetchMenus(restaurantId),
    fetchBranchMenuOfferings(restaurantId, branchId),
  ]);

  const active = menus.find((m) => m.isActive) ?? menus[0];
  if (!active) return [];

  const tree = await fetchMenuTree(restaurantId, active.id);
  if (!tree) return [];

  return buildStockRows(tree, offerings?.offerings ?? []);
}
