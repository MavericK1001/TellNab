-- Phase 1 core differentiators (non-breaking, additive only)
-- Safe for existing production data: nullable columns + default values, no drops.

ALTER TABLE "Advice" ADD COLUMN "tags" TEXT;
ALTER TABLE "Advice" ADD COLUMN "targetAudience" TEXT;
ALTER TABLE "Advice" ADD COLUMN "isUrgent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Advice" ADD COLUMN "identityMode" TEXT NOT NULL DEFAULT 'ANONYMOUS';

ALTER TABLE "AdvisorProfile" ADD COLUMN "helpfulCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdvisorProfile" ADD COLUMN "level" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "AdvisorProfile" ADD COLUMN "levelScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdvisorProfile" ADD COLUMN "statsUpdatedAt" DATETIME;
ALTER TABLE "AdvisorProfile" ADD COLUMN "lastActiveAt" DATETIME;

CREATE TABLE "AdviceAdvisorMatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "score" REAL NOT NULL DEFAULT 0,
  "reason" TEXT,
  "isUrgent" BOOLEAN NOT NULL DEFAULT false,
  "notifiedAt" DATETIME,
  "expiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "adviceId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  CONSTRAINT "AdviceAdvisorMatch_adviceId_fkey" FOREIGN KEY ("adviceId") REFERENCES "Advice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdviceAdvisorMatch_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AdviceAdvisorMatch_adviceId_advisorId_key" ON "AdviceAdvisorMatch"("adviceId", "advisorId");
CREATE INDEX "AdviceAdvisorMatch_advisorId_createdAt_idx" ON "AdviceAdvisorMatch"("advisorId", "createdAt");
CREATE INDEX "AdviceAdvisorMatch_expiresAt_idx" ON "AdviceAdvisorMatch"("expiresAt");
CREATE INDEX "Advice_isUrgent_createdAt_idx" ON "Advice"("isUrgent", "createdAt");
CREATE INDEX "Advice_isUrgent_status_idx" ON "Advice"("isUrgent", "status");
CREATE INDEX "Advice_identityMode_createdAt_idx" ON "Advice"("identityMode", "createdAt");
