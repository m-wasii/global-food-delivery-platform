import { describe, expect, it } from 'vitest';
import { planSettlementClawback, settleOrder } from './commission';

describe('settleOrder', () => {
  it('splits restaurant net, commission, and platform revenue from customer fees', () => {
    // items 1000 - discount 100 = 900 base; 15% commission; fees stay with platform
    const result = settleOrder({
      itemsSubtotal: 1000,
      discount: 100,
      serviceFee: 50,
      deliveryFee: 150,
      commissionRateBps: 1500,
    });

    expect(result).toEqual({
      commissionBase: 900,
      commissionRateBps: 1500,
      commission: 135, // floor(900 * 1500 / 10000)
      restaurantNet: 765, // 900 - 135
      platformRevenue: 335, // 135 + 50 + 150
    });
  });

  it('uses integer floor for commission and rejects invalid inputs', () => {
    expect(
      settleOrder({
        itemsSubtotal: 100,
        discount: 0,
        serviceFee: 0,
        deliveryFee: 0,
        commissionRateBps: 3333,
      }).commission,
    ).toBe(33); // floor(100 * 3333 / 10000)

    expect(() =>
      settleOrder({
        itemsSubtotal: 100,
        discount: 0,
        serviceFee: 0,
        deliveryFee: 0,
        commissionRateBps: -1,
      }),
    ).toThrow(/commissionRateBps/);
  });

  it('clamps discount to items subtotal so restaurant net never goes negative from discount alone', () => {
    const result = settleOrder({
      itemsSubtotal: 200,
      discount: 500,
      serviceFee: 10,
      deliveryFee: 0,
      commissionRateBps: 1000,
    });
    expect(result.commissionBase).toBe(0);
    expect(result.commission).toBe(0);
    expect(result.restaurantNet).toBe(0);
    expect(result.platformRevenue).toBe(10);
  });
});

describe('planSettlementClawback', () => {
  it('scales restaurant net and platform take with the refunded share of the order total', () => {
    const settlement = settleOrder({
      itemsSubtotal: 1000,
      discount: 0,
      serviceFee: 50,
      deliveryFee: 150,
      commissionRateBps: 1500,
    });
    // Full food+fees+tax path: total 1200 → half refund 600
    const clawback = planSettlementClawback({
      settlement,
      orderTotal: 1200,
      refundAmount: 600,
    });
    expect(clawback).toEqual({
      commission: 75,
      restaurantNet: 425,
      platformRevenue: 175, // floor(350 * 600 / 1200)
    });
  });

  it('returns zeros when order total is zero', () => {
    const settlement = settleOrder({
      itemsSubtotal: 0,
      discount: 0,
      serviceFee: 0,
      deliveryFee: 0,
      commissionRateBps: 1500,
    });
    expect(
      planSettlementClawback({
        settlement,
        orderTotal: 0,
        refundAmount: 0,
      }),
    ).toEqual({ commission: 0, restaurantNet: 0, platformRevenue: 0 });
  });
});
