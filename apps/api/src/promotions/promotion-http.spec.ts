import { describe, expect, it } from 'vitest';
import { promotionRejectionMessage } from './promotion-http';

describe('promotionRejectionMessage', () => {
  it('maps server rejection reasons to stable client messages', () => {
    expect(promotionRejectionMessage('NOT_FOUND')).toBe('Promotion code is invalid');
    expect(promotionRejectionMessage('MAX_REDEMPTIONS')).toBe(
      'Promotion code has reached its redemption limit',
    );
    expect(promotionRejectionMessage('MAX_REDEMPTIONS_PER_USER')).toBe(
      'You have already used this promotion code the maximum number of times',
    );
    expect(promotionRejectionMessage('EXPIRED')).toBe('Promotion code has expired');
  });
});
