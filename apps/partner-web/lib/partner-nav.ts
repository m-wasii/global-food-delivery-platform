export const PARTNER_NAV_AREAS = [
  { slug: 'orders', label: 'Orders' },
  { slug: 'menu', label: 'Menu' },
  { slug: 'hours', label: 'Hours/Availability' },
  { slug: 'branches', label: 'Branches' },
  { slug: 'team', label: 'Team' },
] as const;

export type PartnerNavSlug = (typeof PARTNER_NAV_AREAS)[number]['slug'];

export function partnerPath(
  restaurantId: string,
  branchId: string,
  area: string = 'orders',
): string {
  return `/r/${restaurantId}/b/${branchId}/${area}`;
}

/** `/r/:restaurantId/b/:branchId/:area` → area (defaults to orders). */
export function areaFromPathname(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  // r, restaurantId, b, branchId, area?
  return parts[4] ?? 'orders';
}

export function hasPartnerCapability(user: {
  capabilities?: string[];
}): boolean {
  return (user.capabilities ?? []).includes('partner');
}
