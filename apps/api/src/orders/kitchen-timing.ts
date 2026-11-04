import type { OrderStatusValue } from './order-transitions';

/**
 * Kitchen / ops timestamps derived from the first transition into each status
 * (OrderStatusHistory.createdAt). No denormalized columns — see ADR 0012.
 */
export interface KitchenTiming {
  /** First transition to PENDING (usually order creation). */
  pendingAt: string | null;
  /** First transition to CONFIRMED (partner accept). */
  acceptedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
}

export interface HistoryTimingEvent {
  toStatus: string;
  createdAt: Date;
}

const STATUS_TO_FIELD: Record<OrderStatusValue, keyof KitchenTiming> = {
  PENDING: 'pendingAt',
  CONFIRMED: 'acceptedAt',
  PREPARING: 'preparingAt',
  READY: 'readyAt',
  COMPLETED: 'completedAt',
  CANCELLED: 'cancelledAt',
  REJECTED: 'rejectedAt',
};

function emptyTiming(): KitchenTiming {
  return {
    pendingAt: null,
    acceptedAt: null,
    preparingAt: null,
    readyAt: null,
    completedAt: null,
    cancelledAt: null,
    rejectedAt: null,
  };
}

/**
 * Derive nullable ISO timestamps from history.
 * First occurrence of each `toStatus` wins (callers should pass ascending createdAt).
 */
export function deriveKitchenTiming(
  history: ReadonlyArray<HistoryTimingEvent>,
): KitchenTiming {
  const timing = emptyTiming();
  for (const entry of history) {
    const field = STATUS_TO_FIELD[entry.toStatus as OrderStatusValue];
    if (!field) continue;
    if (timing[field] == null) {
      timing[field] = entry.createdAt.toISOString();
    }
  }
  return timing;
}

/**
 * Partner queue "new" heuristic: still awaiting accept/reject.
 * Clients may also use createdAt for age-based highlighting.
 */
export function isNewPartnerOrder(status: string): boolean {
  return status === 'PENDING';
}
