import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import type { OrderStatusValue } from '../orders/order-transitions';
import type { PaymentSnapshot, PaymentStatusValue } from './payment-provider';
import { assertOrderPaymentConsistent } from './order-payment-consistency';
import {
  planPaymentCreate,
  planPaymentStatusChange,
  providerDivergesFromLocal,
} from './payment-reconciliation';

export interface CreatePaymentInput {
  orderId: string;
  snapshot: PaymentSnapshot;
  actorUserId?: string;
  reason?: string;
}

export interface TransitionPaymentInput {
  paymentId: string;
  toStatus: PaymentStatusValue;
  actorUserId?: string;
  reason?: string;
  /** Optional amount fields when capture/refund changes balances. */
  amounts?: Partial<{
    amountCents: number;
    amountCapturableCents: number;
    amountReceivedCents: number;
    refundedAmountCents: number;
  }>;
  providerPaymentId?: string;
  lastFailureReason?: string | null;
}

@Injectable()
export class PaymentsService {
  async create(input: CreatePaymentInput) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const status = input.snapshot.status;
    try {
      planPaymentCreate({
        orderStatus: order.status as OrderStatusValue,
        paymentStatus: status,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid payment create',
      );
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: input.snapshot.provider,
          providerPaymentId: input.snapshot.providerPaymentId,
          status,
          amountCents: input.snapshot.amountCents,
          currency: input.snapshot.currency,
          amountCapturableCents: input.snapshot.amountCapturableCents,
          amountReceivedCents: input.snapshot.amountReceivedCents,
          refundedAmountCents: input.snapshot.refundedAmountCents,
          attemptCount: 1,
        },
      });
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          fromStatus: null,
          toStatus: status,
          actorUserId: input.actorUserId,
          reason: input.reason ?? 'created',
        },
      });
      return payment;
    });
  }

  async transition(input: TransitionPaymentInput) {
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      include: { order: { select: { status: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const fromStatus = payment.status as PaymentStatusValue;
    let planned: { to: PaymentStatusValue; attemptCount: number };
    try {
      planned = planPaymentStatusChange({
        from: fromStatus,
        to: input.toStatus,
        orderStatus: payment.order.status as OrderStatusValue,
        attemptCount: payment.attemptCount,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid payment transition',
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: planned.to,
          attemptCount: planned.attemptCount,
          ...(input.amounts ?? {}),
          ...(input.providerPaymentId
            ? { providerPaymentId: input.providerPaymentId }
            : {}),
          ...(input.lastFailureReason !== undefined
            ? { lastFailureReason: input.lastFailureReason }
            : {}),
          ...(planned.to === 'FAILED' && input.reason
            ? { lastFailureReason: input.reason }
            : {}),
        },
      });
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          fromStatus,
          toStatus: planned.to,
          actorUserId: input.actorUserId,
          reason: input.reason ?? null,
        },
      });
      return updated;
    });
  }

  /**
   * Compare local status to a provider snapshot. Marks reconciliationNeeded
   * when they diverge; clears the flag when they match again.
   */
  async syncFromProviderSnapshot(
    paymentId: string,
    snapshot: PaymentSnapshot,
  ) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const local = payment.status as PaymentStatusValue;
    const diverges = providerDivergesFromLocal(local, snapshot.status);

    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        reconciliationNeeded: diverges,
        // Amounts always refresh from the rail; status only when aligned
        // or already marked for reconciliation (ops still owns the FSM move).
        amountCents: snapshot.amountCents,
        amountCapturableCents: snapshot.amountCapturableCents,
        amountReceivedCents: snapshot.amountReceivedCents,
        refundedAmountCents: snapshot.refundedAmountCents,
        currency: snapshot.currency,
      },
    });
  }

  /** Used by order transitions to refuse silent money/order drift. */
  async assertConsistentWithOrder(
    orderId: string,
    orderStatus: OrderStatusValue,
  ) {
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      select: { status: true },
    });
    if (!payment) return;
    try {
      assertOrderPaymentConsistent(
        orderStatus,
        payment.status as PaymentStatusValue,
      );
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Order and payment diverge',
      );
    }
  }
}
