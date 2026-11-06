import { createHash } from 'node:crypto';

export interface IdempotencyRecordView {
  requestHash: string;
  /** Null while the first attempt is still executing. */
  responseJson: string | null;
  expiresAt: Date;
}

export type IdempotencyDecision =
  | { action: 'execute' }
  | { action: 'replay'; responseJson: string }
  | { action: 'conflict'; reason: 'request_mismatch' | 'in_progress' };

/** Stripe-aligned retention window for replay keys. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Stable SHA-256 of a request payload. Object keys are sorted so field order
 * does not create false mismatches (Stripe compares logical params).
 */
export function hashIdempotencyRequest(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

export function decideIdempotency(input: {
  existing: IdempotencyRecordView | null;
  requestHash: string;
  now?: Date;
}): IdempotencyDecision {
  const now = input.now ?? new Date();
  if (!input.existing || input.existing.expiresAt.getTime() <= now.getTime()) {
    return { action: 'execute' };
  }
  if (input.existing.requestHash !== input.requestHash) {
    return { action: 'conflict', reason: 'request_mismatch' };
  }
  if (input.existing.responseJson == null) {
    return { action: 'conflict', reason: 'in_progress' };
  }
  return { action: 'replay', responseJson: input.existing.responseJson };
}

export class IdempotencyConflictError extends Error {
  readonly reason: 'request_mismatch' | 'in_progress';

  constructor(reason: 'request_mismatch' | 'in_progress') {
    super(
      reason === 'in_progress'
        ? 'Idempotency key is already in use by an in-progress request'
        : 'Idempotency key was reused with different request parameters',
    );
    this.name = 'IdempotencyConflictError';
    this.reason = reason;
  }
}

export interface IdempotencyStore {
  get(scope: string, key: string): Promise<IdempotencyRecordView | null>;
  /** Reserve the key for execution. Throws if another caller won the race. */
  begin(
    scope: string,
    key: string,
    requestHash: string,
    expiresAt: Date,
  ): Promise<void>;
  complete(scope: string, key: string, responseJson: string): Promise<void>;
  /** Drop a started row so a retry can execute (e.g. after a crash mid-flight). */
  abandon(scope: string, key: string): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly rows = new Map<string, IdempotencyRecordView>();

  async get(scope: string, key: string): Promise<IdempotencyRecordView | null> {
    return this.rows.get(rowKey(scope, key)) ?? null;
  }

  async begin(
    scope: string,
    key: string,
    requestHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const id = rowKey(scope, key);
    const existing = this.rows.get(id);
    if (existing && existing.expiresAt.getTime() > Date.now()) {
      throw new IdempotencyConflictError(
        existing.responseJson == null ? 'in_progress' : 'request_mismatch',
      );
    }
    this.rows.set(id, { requestHash, responseJson: null, expiresAt });
  }

  async complete(scope: string, key: string, responseJson: string): Promise<void> {
    const id = rowKey(scope, key);
    const existing = this.rows.get(id);
    if (!existing) throw new Error('Idempotency record missing on complete');
    this.rows.set(id, { ...existing, responseJson });
  }

  async abandon(scope: string, key: string): Promise<void> {
    const id = rowKey(scope, key);
    const existing = this.rows.get(id);
    if (existing && existing.responseJson == null) this.rows.delete(id);
  }
}

export async function runWithIdempotency<T>(input: {
  store: IdempotencyStore;
  scope: string;
  key: string;
  request: unknown;
  execute: () => Promise<T>;
  now?: Date;
  ttlMs?: number;
}): Promise<T> {
  const now = input.now ?? new Date();
  const requestHash = hashIdempotencyRequest(input.request);
  const existing = await input.store.get(input.scope, input.key);
  const decision = decideIdempotency({ existing, requestHash, now });

  if (decision.action === 'replay') {
    return JSON.parse(decision.responseJson) as T;
  }
  if (decision.action === 'conflict') {
    throw new IdempotencyConflictError(decision.reason);
  }

  const ttlMs = input.ttlMs ?? IDEMPOTENCY_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttlMs);
  try {
    await input.store.begin(input.scope, input.key, requestHash, expiresAt);
  } catch (err) {
    // Lost the race: re-read and decide again (replay / conflict).
    if (!(err instanceof IdempotencyConflictError)) throw err;
    const raced = await input.store.get(input.scope, input.key);
    const again = decideIdempotency({ existing: raced, requestHash, now });
    if (again.action === 'replay') return JSON.parse(again.responseJson) as T;
    if (again.action === 'conflict') throw new IdempotencyConflictError(again.reason);
    throw err;
  }

  try {
    const result = await input.execute();
    await input.store.complete(input.scope, input.key, JSON.stringify(result));
    return result;
  } catch (err) {
    await input.store.abandon(input.scope, input.key);
    throw err;
  }
}

function rowKey(scope: string, key: string) {
  return `${scope}\0${key}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortValue(obj[key]);
    }
    return sorted;
  }
  return value;
}
