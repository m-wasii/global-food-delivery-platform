import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InMemoryIdempotencyStore,
  runWithIdempotency,
} from '../common/idempotency';
import type {
  AuthorizePaymentInput,
  CancelPaymentInput,
  CapturePaymentInput,
  NormalizedRefundWebhook,
  PaymentProvider,
  PaymentSnapshot,
  PaymentStatusValue,
  RefundPaymentInput,
} from './payment-provider';
import { parseNoopRefundWebhook } from './refund-webhook-parse';

interface StoredPayment {
  amountCents: number;
  currency: string;
  status: PaymentStatusValue;
  refundedAmountCents: number;
  amountCapturableCents: number;
  amountReceivedCents: number;
  orderId: string;
  customerId: string;
}

/**
 * In-memory provider for local/dev/tests. No network, no vendor SDK.
 * Mutating verbs are wrapped in idempotency store/replay (EAT-47).
 */
@Injectable()
export class NoopPaymentProvider implements PaymentProvider {
  readonly name = 'noop';
  private readonly store = new Map<string, StoredPayment>();
  private readonly idempotency = new InMemoryIdempotencyStore();
  private seq = 0;

  async authorize(input: AuthorizePaymentInput): Promise<PaymentSnapshot> {
    requireIdempotencyKey(input.idempotencyKey);
    assertPositiveCents('amountCents', input.amountCents);
    return runWithIdempotency({
      store: this.idempotency,
      scope: 'noop.authorize',
      key: input.idempotencyKey,
      request: {
        amountCents: input.amountCents,
        currency: input.currency,
        orderId: input.orderId,
        customerId: input.customerId,
      },
      execute: async () => {
        const providerPaymentId = `noop_${++this.seq}`;
        const row: StoredPayment = {
          amountCents: input.amountCents,
          currency: input.currency,
          status: 'AUTHORIZED',
          refundedAmountCents: 0,
          amountCapturableCents: input.amountCents,
          amountReceivedCents: 0,
          orderId: input.orderId,
          customerId: input.customerId,
        };
        this.store.set(providerPaymentId, row);
        return this.toSnapshot(providerPaymentId, row);
      },
    });
  }

  async capture(input: CapturePaymentInput): Promise<PaymentSnapshot> {
    requireIdempotencyKey(input.idempotencyKey);
    return runWithIdempotency({
      store: this.idempotency,
      scope: 'noop.capture',
      key: input.idempotencyKey,
      request: {
        providerPaymentId: input.providerPaymentId,
        amountCents: input.amountCents ?? null,
      },
      execute: async () => {
        const row = this.require(input.providerPaymentId);
        if (row.status !== 'AUTHORIZED') {
          throw new Error(`Cannot capture payment in status ${row.status}`);
        }
        const amount = input.amountCents ?? row.amountCapturableCents;
        assertPositiveCents('amountCents', amount);
        if (amount > row.amountCapturableCents) {
          throw new Error('Capture amount exceeds capturable amount');
        }
        // Partial capture releases the uncaptured remainder (Stripe behavior).
        row.amountCents = amount;
        row.amountReceivedCents = amount;
        row.amountCapturableCents = 0;
        row.status = 'CAPTURED';
        return this.toSnapshot(input.providerPaymentId, row);
      },
    });
  }

  async cancel(input: CancelPaymentInput): Promise<PaymentSnapshot> {
    requireIdempotencyKey(input.idempotencyKey);
    return runWithIdempotency({
      store: this.idempotency,
      scope: 'noop.cancel',
      key: input.idempotencyKey,
      request: {
        providerPaymentId: input.providerPaymentId,
        reason: input.reason ?? null,
      },
      execute: async () => {
        const row = this.require(input.providerPaymentId);
        if (row.status !== 'AUTHORIZED' && row.status !== 'REQUIRES_ACTION') {
          throw new Error(`Cannot cancel payment in status ${row.status}`);
        }
        row.status = 'CANCELED';
        row.amountCapturableCents = 0;
        return this.toSnapshot(input.providerPaymentId, row);
      },
    });
  }

  async refund(input: RefundPaymentInput): Promise<PaymentSnapshot> {
    requireIdempotencyKey(input.idempotencyKey);
    return runWithIdempotency({
      store: this.idempotency,
      scope: 'noop.refund',
      key: input.idempotencyKey,
      request: {
        providerPaymentId: input.providerPaymentId,
        amountCents: input.amountCents,
        reason: input.reason ?? null,
      },
      execute: async () => {
        const row = this.require(input.providerPaymentId);
        assertPositiveCents('amountCents', input.amountCents);
        if (row.status !== 'CAPTURED' && row.status !== 'PARTIALLY_REFUNDED') {
          throw new Error(`Cannot refund payment in status ${row.status}`);
        }
        const nextRefunded = row.refundedAmountCents + input.amountCents;
        if (nextRefunded > row.amountReceivedCents) {
          throw new Error('Refund amount exceeds captured amount');
        }
        row.refundedAmountCents = nextRefunded;
        row.status =
          nextRefunded >= row.amountReceivedCents
            ? 'REFUNDED'
            : 'PARTIALLY_REFUNDED';
        return this.toSnapshot(input.providerPaymentId, row);
      },
    });
  }

  async getStatus(providerPaymentId: string): Promise<PaymentSnapshot> {
    const row = this.require(providerPaymentId);
    return this.toSnapshot(providerPaymentId, row);
  }

  async parseWebhook(
    payload: unknown,
  ): Promise<NormalizedRefundWebhook | null> {
    return parseNoopRefundWebhook(payload);
  }

  private require(providerPaymentId: string): StoredPayment {
    const row = this.store.get(providerPaymentId);
    if (!row) {
      throw new NotFoundException(`Unknown payment: ${providerPaymentId}`);
    }
    return row;
  }

  private toSnapshot(
    providerPaymentId: string,
    row: StoredPayment,
  ): PaymentSnapshot {
    return {
      provider: this.name,
      providerPaymentId,
      status: row.status,
      amountCents: row.amountCents,
      currency: row.currency,
      amountCapturableCents: row.amountCapturableCents,
      amountReceivedCents: row.amountReceivedCents,
      refundedAmountCents: row.refundedAmountCents,
    };
  }
}

function requireIdempotencyKey(key: string) {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('idempotencyKey is required');
  }
}

function assertPositiveCents(name: string, value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer (minor units)`);
  }
}
