-- Add threaded debug request communication, archive state, and per-user read state.

-- CreateEnum
CREATE TYPE "DebugIssueMessageAuthorRole" AS ENUM ('ADMIN', 'STAFF');

-- AlterTable
ALTER TABLE "debug_issues"
ADD COLUMN "archived_by_id" TEXT,
ADD COLUMN "archived_by_name" TEXT,
ADD COLUMN "archived_at" TIMESTAMP(3),
ADD COLUMN "last_admin_activity_at" TIMESTAMP(3),
ADD COLUMN "last_reporter_activity_at" TIMESTAMP(3);

-- Backfill reporter activity from existing request timestamps.
UPDATE "debug_issues"
SET "last_reporter_activity_at" = "created_at"
WHERE "last_reporter_activity_at" IS NULL;

-- CreateTable
CREATE TABLE "debug_issue_messages" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "author_user_id" TEXT,
    "author_name" TEXT,
    "author_email" TEXT,
    "author_role" "DebugIssueMessageAuthorRole" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debug_issue_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debug_issue_view_states" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debug_issue_view_states_pkey" PRIMARY KEY ("id")
);

-- Backfill one initial reporter message per existing issue.
INSERT INTO "debug_issue_messages" (
  "id",
  "issue_id",
  "author_user_id",
  "author_name",
  "author_email",
  "author_role",
  "body",
  "created_at"
)
SELECT
  gen_random_uuid(),
  "id",
  "reporter_user_id",
  "reporter_name",
  "reporter_email",
  'STAFF'::"DebugIssueMessageAuthorRole",
  "description",
  "created_at"
FROM "debug_issues"
WHERE "description" IS NOT NULL AND length(trim("description")) > 0;

-- CreateIndex
CREATE INDEX "debug_issues_archived_at_idx" ON "debug_issues"("archived_at");

-- CreateIndex
CREATE INDEX "debug_issues_reporter_user_id_last_admin_activity_at_idx" ON "debug_issues"("reporter_user_id", "last_admin_activity_at");

-- CreateIndex
CREATE INDEX "debug_issue_messages_issue_id_created_at_idx" ON "debug_issue_messages"("issue_id", "created_at");

-- CreateIndex
CREATE INDEX "debug_issue_messages_author_user_id_created_at_idx" ON "debug_issue_messages"("author_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "debug_issue_view_states_issue_id_user_id_key" ON "debug_issue_view_states"("issue_id", "user_id");

-- CreateIndex
CREATE INDEX "debug_issue_view_states_user_id_updated_at_idx" ON "debug_issue_view_states"("user_id", "updated_at");

-- AddForeignKey
ALTER TABLE "debug_issues" ADD CONSTRAINT "debug_issues_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debug_issue_messages" ADD CONSTRAINT "debug_issue_messages_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "debug_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debug_issue_messages" ADD CONSTRAINT "debug_issue_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debug_issue_view_states" ADD CONSTRAINT "debug_issue_view_states_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "debug_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debug_issue_view_states" ADD CONSTRAINT "debug_issue_view_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
