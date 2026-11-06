import { Injectable } from '@nestjs/common';
import { Prisma, prisma } from '@food-delivery/database';
import {
  IdempotencyConflictError,
  type IdempotencyRecordView,
  type IdempotencyStore,
} from './idempotency';

@Injectable()
export class PrismaIdempotencyStore implements IdempotencyStore {
  async get(scope: string, key: string): Promise<IdempotencyRecordView | null> {
    const row = await prisma.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key } },
    });
    if (!row) return null;
    return {
      requestHash: row.requestHash,
      responseJson: row.responseJson,
      expiresAt: row.expiresAt,
    };
  }

  async begin(
    scope: string,
    key: string,
    requestHash: string,
    expiresAt: Date,
  ): Promise<void> {
    try {
      await prisma.idempotencyRecord.create({
        data: { scope, key, requestHash, responseJson: null, expiresAt },
      });
      return;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }

    const existing = await prisma.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key } },
    });
    if (!existing) {
      // Lost a delete race; one retry.
      await prisma.idempotencyRecord.create({
        data: { scope, key, requestHash, responseJson: null, expiresAt },
      });
      return;
    }

    if (existing.expiresAt.getTime() > Date.now()) {
      throw new IdempotencyConflictError(
        existing.responseJson == null ? 'in_progress' : 'request_mismatch',
      );
    }

    await prisma.idempotencyRecord.delete({
      where: { scope_key: { scope, key } },
    });
    await prisma.idempotencyRecord.create({
      data: { scope, key, requestHash, responseJson: null, expiresAt },
    });
  }

  async complete(scope: string, key: string, responseJson: string): Promise<void> {
    await prisma.idempotencyRecord.update({
      where: { scope_key: { scope, key } },
      data: { responseJson },
    });
  }

  async abandon(scope: string, key: string): Promise<void> {
    const existing = await prisma.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key } },
    });
    if (existing && existing.responseJson == null) {
      await prisma.idempotencyRecord.delete({
        where: { scope_key: { scope, key } },
      });
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}
