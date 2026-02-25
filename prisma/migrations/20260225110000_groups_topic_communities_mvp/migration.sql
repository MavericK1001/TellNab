-- Add topic binding for discussion groups (topic communities MVP)
ALTER TABLE "DiscussionGroup" ADD COLUMN "topicCategoryId" TEXT;

-- Discovery index for topic-based listing
CREATE INDEX "DiscussionGroup_topicCategoryId_createdAt_idx"
ON "DiscussionGroup"("topicCategoryId", "createdAt");
