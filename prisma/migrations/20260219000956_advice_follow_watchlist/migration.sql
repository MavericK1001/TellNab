-- CreateTable
CREATE TABLE "AdviceFollow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "AdviceFollow_adviceId_fkey" FOREIGN KEY ("adviceId") REFERENCES "Advice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdviceFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AdviceFollow_adviceId_userId_key" ON "AdviceFollow"("adviceId", "userId");
