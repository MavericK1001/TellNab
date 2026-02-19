-- DropIndex
DROP INDEX IF EXISTS "Category_isActive_sortOrder_idx";

-- DropIndex
DROP INDEX IF EXISTS "DiscussionGroup_visibility_createdAt_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Advice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "isBoostActive" BOOLEAN NOT NULL DEFAULT false,
    "boostActivatedAt" DATETIME,
    "boostExpiresAt" DATETIME,
    "holdReason" TEXT,
    "categoryId" TEXT,
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "moderatedAt" DATETIME,
    "authorId" TEXT NOT NULL,
    "moderatedById" TEXT,
    CONSTRAINT "Advice_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Advice_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Advice_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Advice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DiscussionGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Advice" ("authorId", "body", "boostActivatedAt", "boostExpiresAt", "categoryId", "createdAt", "groupId", "holdReason", "id", "isBoostActive", "isFeatured", "isLocked", "moderatedAt", "moderatedById", "status", "title", "updatedAt") SELECT "authorId", "body", "boostActivatedAt", "boostExpiresAt", "categoryId", "createdAt", "groupId", "holdReason", "id", "isBoostActive", "isFeatured", "isLocked", "moderatedAt", "moderatedById", "status", "title", "updatedAt" FROM "Advice";
DROP TABLE "Advice";
ALTER TABLE "new_Advice" RENAME TO "Advice";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
