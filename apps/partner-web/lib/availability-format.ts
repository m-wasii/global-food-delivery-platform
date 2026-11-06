import type { MenuTree, StockRow } from './availability-types';

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Join active menu catalog with per-branch stock opt-ins. */
export function buildStockRows(
  tree: MenuTree,
  offerings: ReadonlyArray<{ menuItemId: string; isAvailable: boolean }>,
): StockRow[] {
  const offeringByItem = new Map(
    offerings.map((row) => [row.menuItemId, row] as const),
  );

  const rows: StockRow[] = [];
  for (const category of [...tree.categories].sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const item of [...category.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const offer = offeringByItem.get(item.id);
      rows.push({
        menuItemId: item.id,
        name: item.name,
        categoryName: category.name,
        priceCents: item.priceCents,
        currency: item.currency,
        catalogAvailable: item.isAvailable,
        isOffered: Boolean(offer),
        inStock: offer?.isAvailable === true,
      });
    }
  }
  return rows;
}
