import type { PartnerOrderSummary } from './types';

/**
 * Anchor timestamp for "waiting Xm" on the partner queue.
 * New (PENDING): since created/pending. In-progress: since entered current status.
 */
export function waitAnchorIso(order: PartnerOrderSummary): string {
  const { status, timing, createdAt } = order;
  if (status === 'PENDING') return timing.pendingAt ?? createdAt;
  if (status === 'CONFIRMED') return timing.acceptedAt ?? createdAt;
  if (status === 'PREPARING') return timing.preparingAt ?? createdAt;
  if (status === 'READY') return timing.readyAt ?? createdAt;
  return createdAt;
}

export function formatWaitAge(anchorIso: string, nowMs: number): string {
  const start = Date.parse(anchorIso);
  if (Number.isNaN(start)) return '';
  const seconds = Math.max(0, Math.floor((nowMs - start) / 1000));
  if (seconds < 60) return `waiting ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `waiting ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `waiting ${hours}h ${rem}m` : `waiting ${hours}h`;
}
