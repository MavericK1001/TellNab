-- AlterTable
ALTER TABLE "Advice" ADD COLUMN "isBoostActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Advice" ADD COLUMN "boostActivatedAt" DATETIME;
ALTER TABLE "Advice" ADD COLUMN "boostExpiresAt" DATETIME;

-- CreateTable
CREATE TABLE "AdviceBoostOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'MOCK',
    "providerRef" TEXT,
    "boostDays" INTEGER NOT NULL,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "adviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "AdviceBoostOrder_adviceId_fkey" FOREIGN KEY ("adviceId") REFERENCES "Advice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdviceBoostOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdviceBoostOrder_adviceId_createdAt_idx" ON "AdviceBoostOrder"("adviceId", "createdAt");

-- CreateIndex
CREATE INDEX "AdviceBoostOrder_userId_createdAt_idx" ON "AdviceBoostOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdviceBoostOrder_status_createdAt_idx" ON "AdviceBoostOrder"("status", "createdAt");
