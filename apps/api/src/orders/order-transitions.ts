export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

/** Who is allowed to request a transition (authorization is enforced in the service). */
export type TransitionActorRole = 'customer' | 'partner' | 'admin';

const ALLOWED: Record<OrderStatusValue, readonly OrderStatusValue[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

const ACTOR_ALLOWED: Record<TransitionActorRole, readonly OrderStatusValue[]> = {
  customer: ['CANCELLED'],
  partner: ['CONFIRMED', 'REJECTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
  admin: ORDER_STATUSES,
};

export function canTransition(
  from: OrderStatusValue,
  to: OrderStatusValue,
): boolean {
  if (from === to) return false;
  return ALLOWED[from].includes(to);
}

export function assertCanTransition(from: OrderStatusValue, to: OrderStatusValue): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid order transition: ${from} → ${to}`);
  }
}

export function actorMayRequestTransition(
  role: TransitionActorRole,
  to: OrderStatusValue,
): boolean {
  return ACTOR_ALLOWED[role].includes(to);
}

export function allowedTargets(from: OrderStatusValue): readonly OrderStatusValue[] {
  return ALLOWED[from];
}
