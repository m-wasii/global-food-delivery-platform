import { describe, expect, it } from 'vitest';
import type { PaymentProvider } from './payment-provider';
import { PAYMENT_PROVIDER, PAYMENT_STATUSES } from './payment-provider';
import { NoopPaymentProvider } from './noop-payment.provider';

/**
 * Shared lifecycle exercised against every PaymentProvider implementation.
 * Mirrors Stripe/Adyen auth→capture→refund / cancel verbs without a vendor SDK.
 */
async function authorizeCaptureRefund(provider: PaymentProvider) {
  const authorized = await provider.authorize({
    amountCents: 2599,
    currency: 'USD',
    orderId: 'order-1',
    customerId: 'user-1',
    idempotencyKey: 'auth-1',
  });
  expect(authorized.status).toBe('AUTHORIZED');
  expect(authorized.amountCents).toBe(2599);
  expect(authorized.amountCapturableCents).toBe(2599);
  expect(authorized.amountReceivedCents).toBe(0);
  expect(authorized.currency).toBe('USD');
  expect(authorized.provider).toBe(provider.name);
  expect(authorized.providerPaymentId.length).toBeGreaterThan(0);

  const captured = await provider.capture({
    providerPaymentId: authorized.providerPaymentId,
    amountCents: 2599,
    idempotencyKey: 'cap-1',
  });
  expect(captured.status).toBe('CAPTURED');
  expect(captured.amountReceivedCents).toBe(2599);
  expect(captured.amountCapturableCents).toBe(0);

  const refunded = await provider.refund({
    providerPaymentId: authorized.providerPaymentId,
    amountCents: 1000,
    idempotencyKey: 'ref-1',
    reason: 'requested_by_customer',
  });
  expect(refunded.status).toBe('PARTIALLY_REFUNDED');
  expect(refunded.refundedAmountCents).toBe(1000);

  const fullyRefunded = await provider.refund({
    providerPaymentId: authorized.providerPaymentId,
    amountCents: 1599,
    idempotencyKey: 'ref-2',
  });
  expect(fullyRefunded.status).toBe('REFUNDED');
  expect(fullyRefunded.refundedAmountCents).toBe(2599);

  const status = await provider.getStatus(authorized.providerPaymentId);
  expect(status.status).toBe('REFUNDED');
  expect(status.providerPaymentId).toBe(authorized.providerPaymentId);
}

describe('PaymentProvider contract', () => {
  it('exposes PaymentIntent-aligned status vocabulary', () => {
    expect(PAYMENT_STATUSES).toEqual([
      'REQUIRES_ACTION',
      'PROCESSING',
      'AUTHORIZED',
      'CAPTURED',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
      'FAILED',
      'CANCELED',
    ]);
  });

  it('binds Nest DI through a symbol token', () => {
    expect(typeof PAYMENT_PROVIDER).toBe('symbol');
  });

  it('noop provider completes authorize → capture → refund without a vendor SDK', async () => {
    await authorizeCaptureRefund(new NoopPaymentProvider());
  });

  it('noop cancel releases an authorization hold', async () => {
    const provider = new NoopPaymentProvider();
    const authorized = await provider.authorize({
      amountCents: 1500,
      currency: 'USD',
      orderId: 'order-cancel',
      customerId: 'user-1',
      idempotencyKey: 'auth-cancel',
    });
    const canceled = await provider.cancel({
      providerPaymentId: authorized.providerPaymentId,
      idempotencyKey: 'cancel-1',
      reason: 'abandoned',
    });
    expect(canceled.status).toBe('CANCELED');
    expect(canceled.amountCapturableCents).toBe(0);
  });

  it('noop partial capture releases the uncaptured remainder', async () => {
    const provider = new NoopPaymentProvider();
    const authorized = await provider.authorize({
      amountCents: 3000,
      currency: 'USD',
      orderId: 'order-partial',
      customerId: 'user-1',
      idempotencyKey: 'auth-partial',
    });
    const captured = await provider.capture({
      providerPaymentId: authorized.providerPaymentId,
      amountCents: 2000,
      idempotencyKey: 'cap-partial',
    });
    expect(captured.status).toBe('CAPTURED');
    expect(captured.amountReceivedCents).toBe(2000);
    expect(captured.amountCapturableCents).toBe(0);
    expect(captured.amountCents).toBe(2000);
  });

  it('alternate provider satisfies the same caller path (provider-neutral)', async () => {
    class AlternatePaymentProvider implements PaymentProvider {
      readonly name = 'alternate';
      private store = new Map<
        string,
        {
          amountCents: number;
          currency: string;
          status:
            | 'AUTHORIZED'
            | 'CAPTURED'
            | 'PARTIALLY_REFUNDED'
            | 'REFUNDED'
            | 'CANCELED';
          refundedAmountCents: number;
          amountCapturableCents: number;
          amountReceivedCents: number;
        }
      >();
      private seq = 0;

      async authorize(input: {
        amountCents: number;
        currency: string;
        orderId: string;
        customerId: string;
        idempotencyKey: string;
      }) {
        const providerPaymentId = `alt_${++this.seq}`;
        this.store.set(providerPaymentId, {
          amountCents: input.amountCents,
          currency: input.currency,
          status: 'AUTHORIZED',
          refundedAmountCents: 0,
          amountCapturableCents: input.amountCents,
          amountReceivedCents: 0,
        });
        return {
          provider: this.name,
          providerPaymentId,
          status: 'AUTHORIZED' as const,
          amountCents: input.amountCents,
          currency: input.currency,
          refundedAmountCents: 0,
          amountCapturableCents: input.amountCents,
          amountReceivedCents: 0,
        };
      }

      async capture(input: {
        providerPaymentId: string;
        amountCents?: number;
        idempotencyKey: string;
      }) {
        const row = this.store.get(input.providerPaymentId);
        if (!row) throw new Error('not found');
        const amount = input.amountCents ?? row.amountCapturableCents;
        row.amountCents = amount;
        row.amountReceivedCents = amount;
        row.amountCapturableCents = 0;
        row.status = 'CAPTURED';
        return {
          provider: this.name,
          providerPaymentId: input.providerPaymentId,
          status: 'CAPTURED' as const,
          amountCents: row.amountCents,
          currency: row.currency,
          refundedAmountCents: 0,
          amountCapturableCents: 0,
          amountReceivedCents: amount,
        };
      }

      async cancel(input: {
        providerPaymentId: string;
        idempotencyKey: string;
        reason?: string;
      }) {
        const row = this.store.get(input.providerPaymentId);
        if (!row) throw new Error('not found');
        row.status = 'CANCELED';
        row.amountCapturableCents = 0;
        return {
          provider: this.name,
          providerPaymentId: input.providerPaymentId,
          status: 'CANCELED' as const,
          amountCents: row.amountCents,
          currency: row.currency,
          refundedAmountCents: 0,
          amountCapturableCents: 0,
          amountReceivedCents: 0,
        };
      }

      async refund(input: {
        providerPaymentId: string;
        amountCents: number;
        idempotencyKey: string;
        reason?: string;
      }) {
        const row = this.store.get(input.providerPaymentId);
        if (!row) throw new Error('not found');
        row.refundedAmountCents += input.amountCents;
        row.status =
          row.refundedAmountCents >= row.amountCents
            ? 'REFUNDED'
            : 'PARTIALLY_REFUNDED';
        return {
          provider: this.name,
          providerPaymentId: input.providerPaymentId,
          status: row.status,
          amountCents: row.amountCents,
          currency: row.currency,
          refundedAmountCents: row.refundedAmountCents,
          amountCapturableCents: 0,
          amountReceivedCents: row.amountReceivedCents,
        };
      }

      async getStatus(providerPaymentId: string) {
        const row = this.store.get(providerPaymentId);
        if (!row) throw new Error('not found');
        return {
          provider: this.name,
          providerPaymentId,
          status: row.status,
          amountCents: row.amountCents,
          currency: row.currency,
          refundedAmountCents: row.refundedAmountCents,
          amountCapturableCents: row.amountCapturableCents,
          amountReceivedCents: row.amountReceivedCents,
        };
      }

      async parseWebhook() {
        return null;
      }
    }

    await authorizeCaptureRefund(new AlternatePaymentProvider());
  });

  it('noop getStatus fails for unknown provider payment id', async () => {
    const provider = new NoopPaymentProvider();
    await expect(provider.getStatus('missing')).rejects.toThrow(
      /unknown payment/i,
    );
  });

  it('noop authorize replays the same snapshot for a matching idempotency key', async () => {
    const provider = new NoopPaymentProvider();
    const input = {
      amountCents: 2599,
      currency: 'USD',
      orderId: 'order-replay',
      customerId: 'user-1',
      idempotencyKey: 'auth-replay-1',
    };
    const first = await provider.authorize(input);
    const second = await provider.authorize(input);
    expect(second).toEqual(first);
  });

  it('noop authorize rejects idempotency key reuse with different params', async () => {
    const provider = new NoopPaymentProvider();
    await provider.authorize({
      amountCents: 2599,
      currency: 'USD',
      orderId: 'order-mismatch',
      customerId: 'user-1',
      idempotencyKey: 'auth-mismatch-1',
    });
    await expect(
      provider.authorize({
        amountCents: 100,
        currency: 'USD',
        orderId: 'order-mismatch',
        customerId: 'user-1',
        idempotencyKey: 'auth-mismatch-1',
      }),
    ).rejects.toThrow(/idempotency key was reused/i);
  });
});
