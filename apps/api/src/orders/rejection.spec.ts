import { describe, expect, it } from 'vitest';
import { formatRejectHistoryReason, REJECT_REASONS } from './rejection';

describe('REJECT_REASONS', () => {
  it('exposes the locked partner reject enum', () => {
    expect([...REJECT_REASONS]).toEqual([
      'OUT_OF_STOCK',
      'TOO_BUSY',
      'CLOSING_SOON',
      'OTHER',
    ]);
  });
});

describe('formatRejectHistoryReason', () => {
  it('stores code alone or with optional note', () => {
    expect(formatRejectHistoryReason('OUT_OF_STOCK')).toBe('OUT_OF_STOCK');
    expect(formatRejectHistoryReason('OTHER', '  no chicken  ')).toBe(
      'OTHER: no chicken',
    );
  });
});
