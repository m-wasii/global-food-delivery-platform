import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import {
  IdempotencyConflictError,
  runWithIdempotency,
  type IdempotencyStore,
} from '../common/idempotency';
import {
  normalizeIdempotencyKey,
  toHttpIdempotencyError,
} from '../common/idempotency-http';
import { IDEMPOTENCY_STORE } from '../common/idempotency.tokens';
import type { OrderStatusValue } from '../orders/order-transitions';
import {
  PAYMENT_PROVIDER,
  type NormalizedRefundWebhook,
  type PaymentProvider,
  type PaymentStatusValue,
} from './payment-provider';
import {
  createRefundDraft,
  type RefundStatusValue,
} from './refund-record';
import {
  refundIssueRequest,
  refundIssueScope,
  toRefundHttpResponse,
} from './refund-http';
import { planRefund } from './refund-rules';
import { planRefundWebhookApply } from './refund-webhook';

export interface IssueRefundInput {
  paymentId: string;
  amountCents: number;
  /** Raw Idempotency-Key header; normalized inside issue(). */
  idempotencyKey?: string;
  reason?: string;
  actorUserId?: string;
}

@Injectable()
export class RefundsService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotencyStore: IdempotencyStore,
  ) {}

  /**
   * Issues a full or partial refund: rail call → Refund row → Payment FSM bump.
   * Platform idempotency replays the HTTP body so retries do not double-refund (EAT-79).
   */
  async issue(input: IssueRefundInput) {
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
    try {
      return await runWithIdempotency({
        store: this.idempotencyStore,
        scope: refundIssueScope(input.paymentId),
        key: idempotencyKey,
        request: refundIssueRequest(input),
        execute: async () => {
          const result = await this.executeIssue({
            paymentId: input.paymentId,
            amountCents: input.amountCents,
            reason: input.reason,
            actorUserId: input.actorUserId,
            idempotencyKey,
          });
          return toRefundHttpResponse(result);
        },
      });
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        throw toHttpIdempotencyError(err);
      }
      throw err;
    }
  }

  private async executeIssue(
    input: Omit<IssueRefundInput, 'idempotencyKey'> & { idempotencyKey: string },
  ) {
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      include: { order: { select: { id: true, status: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    let planned;
    try {
      planned = planRefund({
        paymentStatus: payment.status as PaymentStatusValue,
        orderStatus: payment.order.status as OrderStatusValue,
        amountReceivedCents: payment.amountReceivedCents,
        refundedAmountCents: payment.refundedAmountCents,
        refundAmountCents: input.amountCents,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid refund',
      );
    }

    const snapshot = await this.provider.refund({
      providerPaymentId: payment.providerPaymentId,
      amountCents: input.amountCents,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
    });

    const draft = createRefundDraft({
      payment: {
        id: payment.id,
        orderId: payment.orderId,
        currency: payment.currency,
      },
      amountCents: input.amountCents,
      reason: input.reason,
      actorUserId: input.actorUserId,
      // Noop/sync rails settle immediately; async PSP webhooks can flip later.
      status: 'SUCCEEDED',
      providerRefundId: `${snapshot.providerPaymentId}:r:${planned.nextRefundedAmountCents}`,
    });

    return prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({ data: draft });
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: planned.nextPaymentStatus,
          refundedAmountCents: planned.nextRefundedAmountCents,
          amountCapturableCents: snapshot.amountCapturableCents,
          amountReceivedCents: snapshot.amountReceivedCents,
        },
      });
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          fromStatus: payment.status,
          toStatus: planned.nextPaymentStatus,
          actorUserId: input.actorUserId,
          reason:
            input.reason ??
            (planned.kind === 'full' ? 'full_refund' : 'partial_refund'),
        },
      });
      return { refund, payment: updatedPayment };
    });
  }

  async listForOrder(orderId: string) {
    return prisma.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listForPayment(paymentId: string) {
    return prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * PSP ingress: provider.parseWebhook → Refund.status (+ payment amount unwind).
   * Duplicate deliveries that already match the target status are no-ops (EAT-80).
   */
  async applyProviderWebhook(payload: unknown) {
    const event = await this.provider.parseWebhook(payload);
    if (!event) {
      return { handled: false as const, reason: 'ignored' as const };
    }
    return this.applyRefundWebhook(event);
  }

  async applyRefundWebhook(event: NormalizedRefundWebhook) {
    const refund = await prisma.refund.findFirst({
      where: { providerRefundId: event.providerRefundId },
      include: {
        payment: {
          include: { order: { select: { status: true } } },
        },
      },
    });
    if (!refund) {
      return {
        handled: false as const,
        reason: 'refund_not_found' as const,
        providerRefundId: event.providerRefundId,
      };
    }

    let planned;
    try {
      planned = planRefundWebhookApply({
        currentRefundStatus: refund.status as RefundStatusValue,
        nextRefundStatus: event.status,
        paymentStatus: refund.payment.status as PaymentStatusValue,
        orderStatus: refund.payment.order.status as OrderStatusValue,
        amountReceivedCents: refund.payment.amountReceivedCents,
        refundedAmountCents: refund.payment.refundedAmountCents,
        refundAmountCents: refund.amountCents,
      });
    } catch (err) {
      // Surface drift for ops instead of leaving money wrong silently.
      await prisma.payment.update({
        where: { id: refund.paymentId },
        data: { reconciliationNeeded: true },
      });
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid refund webhook',
      );
    }

    if (planned.noop) {
      return {
        handled: true as const,
        noop: true as const,
        refundId: refund.id,
        status: planned.refundStatus,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextRefund = await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: planned.refundStatus,
          ...(event.failureReason
            ? { reason: event.failureReason }
            : {}),
        },
      });

      if (planned.payment) {
        await tx.payment.update({
          where: { id: refund.paymentId },
          data: {
            status: planned.payment.nextStatus,
            refundedAmountCents: planned.payment.nextRefundedAmountCents,
            reconciliationNeeded: false,
          },
        });
        await tx.paymentStatusHistory.create({
          data: {
            paymentId: refund.paymentId,
            fromStatus: refund.payment.status,
            toStatus: planned.payment.nextStatus,
            reason: planned.payment.reverseAmounts
              ? 'refund_webhook_failed'
              : 'refund_webhook_succeeded',
          },
        });
      }

      return nextRefund;
    });

    return {
      handled: true as const,
      noop: false as const,
      refundId: updated.id,
      status: updated.status,
    };
  }
}
