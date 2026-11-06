-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM (
  'REQUIRES_ACTION',
  'PROCESSING',
  'AUTHORIZED',
  'CAPTURED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'CANCELED'
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "amountCapturableCents" INTEGER NOT NULL DEFAULT 0,
    "amountReceivedCents" INTEGER NOT NULL DEFAULT 0,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "reconciliationNeeded" BOOLEAN NOT NULL DEFAULT false,
    "lastFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentStatusHistory" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "fromStatus" "PaymentStatus",
    "toStatus" "PaymentStatus" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_reconciliationNeeded_idx" ON "Payment"("reconciliationNeeded");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentStatusHistory_paymentId_createdAt_idx" ON "PaymentStatusHistory"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentStatusHistory_actorUserId_idx" ON "PaymentStatusHistory"("actorUserId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentStatusHistory" ADD CONSTRAINT "PaymentStatusHistory_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentStatusHistory" ADD CONSTRAINT "PaymentStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
