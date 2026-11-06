import { describe, expect, it } from 'vitest';
import { NoopPaymentProvider } from './noop-payment.provider';
import {
  parseAdyenRefundWebhook,
  parseStripeRefundWebhook,
} from './refund-webhook-parse';

describe('parseStripeRefundWebhook', () => {
  it('maps refund.updated with succeeded status', () => {
    const event = parseStripeRefundWebhook({
      id: 'evt_1',
      type: 'refund.updated',
      data: {
        object: {
          id: 're_abc',
          object: 'refund',
          amount: 1500,
          currency: 'usd',
          payment_intent: 'pi_xyz',
          status: 'succeeded',
        },
      },
    });

    expect(event).toEqual({
      kind: 'refund',
      provider: 'stripe',
      providerEventId: 'evt_1',
      providerRefundId: 're_abc',
      providerPaymentId: 'pi_xyz',
      status: 'SUCCEEDED',
      amountCents: 1500,
      failureReason: null,
    });
  });

  it('maps refund.failed to FAILED', () => {
    const event = parseStripeRefundWebhook({
      id: 'evt_2',
      type: 'refund.failed',
      data: {
        object: {
          id: 're_abc',
          object: 'refund',
          amount: 1500,
          payment_intent: 'pi_xyz',
          status: 'failed',
          failure_reason: 'expired_or_canceled_card',
        },
      },
    });

    expect(event?.status).toBe('FAILED');
    expect(event?.failureReason).toBe('expired_or_canceled_card');
  });

  it('ignores non-refund Stripe events', () => {
    expect(
      parseStripeRefundWebhook({
        id: 'evt_3',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1' } },
      }),
    ).toBeNull();
  });
});

describe('parseAdyenRefundWebhook', () => {
  it('maps REFUND success=true to SUCCEEDED', () => {
    const event = parseAdyenRefundWebhook({
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            eventCode: 'REFUND',
            success: 'true',
            pspReference: 'REFUND_PSP_1',
            originalReference: 'AUTH_PSP_1',
            amount: { currency: 'EUR', value: 4000 },
            reason: '',
          },
        },
      ],
    });

    expect(event).toEqual({
      kind: 'refund',
      provider: 'adyen',
      providerEventId: 'REFUND:REFUND_PSP_1',
      providerRefundId: 'REFUND_PSP_1',
      providerPaymentId: 'AUTH_PSP_1',
      status: 'SUCCEEDED',
      amountCents: 4000,
      failureReason: null,
    });
  });

  it('maps REFUND_FAILED and REFUND success=false to FAILED', () => {
    const failed = parseAdyenRefundWebhook({
      notificationItems: [
        {
          NotificationRequestItem: {
            eventCode: 'REFUND_FAILED',
            success: 'true',
            pspReference: 'REFUND_PSP_2',
            originalReference: 'AUTH_PSP_1',
            amount: { value: 4000 },
            reason: 'Not enough balance',
          },
        },
      ],
    });
    expect(failed?.status).toBe('FAILED');
    expect(failed?.failureReason).toBe('Not enough balance');

    const validationFailed = parseAdyenRefundWebhook({
      notificationItems: [
        {
          NotificationRequestItem: {
            eventCode: 'REFUND',
            success: 'false',
            pspReference: 'REFUND_PSP_3',
            originalReference: 'AUTH_PSP_1',
            amount: { value: 4000 },
            reason: 'Requested refund amount too high',
          },
        },
      ],
    });
    expect(validationFailed?.status).toBe('FAILED');
  });

  it('ignores non-refund Adyen event codes', () => {
    expect(
      parseAdyenRefundWebhook({
        notificationItems: [
          {
            NotificationRequestItem: {
              eventCode: 'AUTHORISATION',
              success: 'true',
              pspReference: 'AUTH_1',
            },
          },
        ],
      }),
    ).toBeNull();
  });
});

describe('NoopPaymentProvider.parseWebhook', () => {
  it('normalizes a noop refund envelope', async () => {
    const provider = new NoopPaymentProvider();
    const parsed = await provider.parseWebhook({
      id: 'noop_evt_1',
      type: 'refund.updated',
      data: {
        providerRefundId: 'noop_1:r:1000',
        providerPaymentId: 'noop_1',
        status: 'succeeded',
        amountCents: 1000,
      },
    });

    expect(parsed).toEqual({
      kind: 'refund',
      provider: 'noop',
      providerEventId: 'noop_evt_1',
      providerRefundId: 'noop_1:r:1000',
      providerPaymentId: 'noop_1',
      status: 'SUCCEEDED',
      amountCents: 1000,
      failureReason: null,
    });
  });

  it('returns null for unrelated payloads', async () => {
    const provider = new NoopPaymentProvider();
    expect(await provider.parseWebhook({ type: 'ping' })).toBeNull();
  });
});
