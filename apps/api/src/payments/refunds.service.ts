import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import type { OrderStatusValue } from '../orders/order-transitions';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type PaymentStatusValue,
} from './payment-provider';
import { createRefundDraft } from './refund-record';
import { planRefund } from './refund-rules';

export interface IssueRefundInput {
  paymentId: string;
  amountCents: number;
  idempotencyKey: string;
  reason?: string;
  actorUserId?: string;
}

@Injectable()
export class RefundsService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Issues a full or partial refund: rail call → Refund row → Payment FSM bump.
   * Refund rows are always FK'd to both payment and order (EAT-48).
   */
  async issue(input: IssueRefundInput) {
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
}
