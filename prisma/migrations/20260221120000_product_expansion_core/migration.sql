-- Product expansion core (non-breaking, additive)

ALTER TABLE "Advice" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "Advice" ADD COLUMN "isCrisisFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Advice" ADD COLUMN "crisisKeywords" TEXT;
ALTER TABLE "Advice" ADD COLUMN "helpfulCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Advice" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Advice" ADD COLUMN "priorityTier" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Advice" ADD COLUMN "priorityScore" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AdviceComment" ADD COLUMN "messageType" TEXT NOT NULL DEFAULT 'TEXT';
ALTER TABLE "AdviceComment" ADD COLUMN "audioUrl" TEXT;
ALTER TABLE "AdviceComment" ADD COLUMN "audioDurationSec" INTEGER;
ALTER TABLE "AdviceComment" ADD COLUMN "transcript" TEXT;

CREATE TABLE "AdviceReaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL DEFAULT 'HELPFUL',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "adviceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "AdviceReaction_adviceId_fkey" FOREIGN KEY ("adviceId") REFERENCES "Advice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdviceReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdviceReaction_adviceId_userId_type_key" ON "AdviceReaction"("adviceId", "userId", "type");
CREATE INDEX "AdviceReaction_adviceId_type_idx" ON "AdviceReaction"("adviceId", "type");

CREATE TABLE "SavedAdvice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "adviceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "SavedAdvice_adviceId_fkey" FOREIGN KEY ("adviceId") REFERENCES "Advice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SavedAdvice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SavedAdvice_adviceId_userId_key" ON "SavedAdvice"("adviceId", "userId");
CREATE INDEX "SavedAdvice_userId_createdAt_idx" ON "SavedAdvice"("userId", "createdAt");

CREATE TABLE "AdvisorProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "bio" TEXT,
  "specialties" TEXT NOT NULL DEFAULT '[]',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "responseTimeMins" INTEGER NOT NULL DEFAULT 1440,
  "totalReplies" INTEGER NOT NULL DEFAULT 0,
  "ratingAvg" REAL NOT NULL DEFAULT 0,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "followersCount" INTEGER NOT NULL DEFAULT 0,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AdvisorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdvisorProfile_userId_key" ON "AdvisorProfile"("userId");

CREATE TABLE "AdvisorFollow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "followerId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  CONSTRAINT "AdvisorFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdvisorFollow_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdvisorFollow_followerId_advisorId_key" ON "AdvisorFollow"("followerId", "advisorId");
CREATE INDEX "AdvisorFollow_advisorId_createdAt_idx" ON "AdvisorFollow"("advisorId", "createdAt");

CREATE TABLE "AdvicePriorityOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL DEFAULT 'PENDING_GATEWAY',
  "providerRef" TEXT,
  "queueTier" TEXT NOT NULL DEFAULT 'PRIORITY',
  "paidAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "adviceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "AdvicePriorityOrder_adviceId_fkey" FOREIGN KEY ("adviceId") REFERENCES "Advice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdvicePriorityOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AdvicePriorityOrder_adviceId_createdAt_idx" ON "AdvicePriorityOrder"("adviceId", "createdAt");
CREATE INDEX "AdvicePriorityOrder_userId_createdAt_idx" ON "AdvicePriorityOrder"("userId", "createdAt");
CREATE INDEX "AdvicePriorityOrder_status_createdAt_idx" ON "AdvicePriorityOrder"("status", "createdAt");

CREATE INDEX "Advice_status_visibility_createdAt_idx" ON "Advice"("status", "visibility", "createdAt");
CREATE INDEX "Advice_status_categoryId_createdAt_idx" ON "Advice"("status", "categoryId", "createdAt");
CREATE INDEX "Advice_priorityTier_createdAt_idx" ON "Advice"("priorityTier", "createdAt");
