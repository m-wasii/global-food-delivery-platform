import { describe, expect, it } from 'vitest';
import {
  areaFromPathname,
  hasPartnerCapability,
  PARTNER_NAV_AREAS,
  partnerPath,
} from './partner-nav';

describe('PARTNER_NAV_AREAS', () => {
  it('lists the operational shell areas in order', () => {
    expect(PARTNER_NAV_AREAS.map((a) => a.slug)).toEqual([
      'orders',
      'menu',
      'hours',
      'branches',
      'team',
    ]);
    expect(PARTNER_NAV_AREAS.map((a) => a.label)).toEqual([
      'Orders',
      'Menu',
      'Hours/Availability',
      'Branches',
      'Team',
    ]);
  });
});

describe('partnerPath', () => {
  it('builds /r/:restaurantId/b/:branchId/:area', () => {
    expect(partnerPath('rest-1', 'branch-9', 'menu')).toBe(
      '/r/rest-1/b/branch-9/menu',
    );
  });

  it('defaults area to orders', () => {
    expect(partnerPath('rest-1', 'branch-9')).toBe('/r/rest-1/b/branch-9/orders');
  });
});

describe('areaFromPathname', () => {
  it('reads the nav area from a partner shell path', () => {
    expect(areaFromPathname('/r/rest-1/b/branch-9/hours')).toBe('hours');
  });

  it('defaults to orders when area segment is missing', () => {
    expect(areaFromPathname('/r/rest-1/b/branch-9')).toBe('orders');
  });
});

describe('hasPartnerCapability', () => {
  it('requires the partner capability', () => {
    expect(hasPartnerCapability({ capabilities: ['customer', 'partner'] })).toBe(
      true,
    );
    expect(hasPartnerCapability({ capabilities: ['customer'] })).toBe(false);
    expect(hasPartnerCapability({})).toBe(false);
  });
});
