-- Baseline schema generated from prisma/schema.prisma.
-- Existing production databases that already contain this schema should be
-- baselined with `prisma migrate resolve --applied 20260628181000_baseline_org_readiness_schema`
-- after a backup and schema verification, rather than applying this migration
-- on top of existing tables.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "ActionHistoryStatus" AS ENUM ('SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "WorkshopVisibility" AS ENUM ('PRIVATE', 'STAFF_COMMONS');

-- CreateEnum
CREATE TYPE "DebugIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FIXED');

-- CreateTable
CREATE TABLE "contributors" (
    "id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_import_batches" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'spreadsheet',
    "imported_by" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "row_count" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "course_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "source_import_batch_id" UUID NOT NULL,
    "external_source" TEXT NOT NULL,
    "external_id" TEXT,
    "course_code" TEXT,
    "course_name" TEXT NOT NULL,
    "description" TEXT,
    "hours" DOUBLE PRECISION,
    "year" INTEGER,
    "quarter" INTEGER,
    "syllabus_url" TEXT,
    "canvas_shell_url" TEXT,
    "physical_inventory_url" TEXT,
    "curriculum_url" TEXT,
    "certs_url" TEXT,
    "amatrol_url" TEXT,
    "tooling_u_url" TEXT,
    "electude_url" TEXT,
    "development_status" TEXT,
    "timeline_start" TIMESTAMP(3),
    "timeline_end" TIMESTAMP(3),
    "enrollment_tracker_url" TEXT,
    "raw_import_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_outcomes" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "outcome_code" TEXT,
    "description" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "raw_import_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_assets" (
    "id" UUID NOT NULL,
    "course_id" UUID,
    "asset_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "input_json" JSONB NOT NULL,
    "output_json" JSONB NOT NULL,
    "rich_text_output" TEXT NOT NULL,
    "html_output" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_context_links" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "context_type" TEXT NOT NULL,
    "course_id" UUID,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_context_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_history" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" TEXT,
    "actor_email" TEXT,
    "action_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "affected_type" TEXT,
    "affected_id" TEXT,
    "status" "ActionHistoryStatus" NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "action_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debug_issues" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "page_url" TEXT,
    "status" "DebugIssueStatus" NOT NULL DEFAULT 'OPEN',
    "admin_response" TEXT,
    "reporter_user_id" TEXT,
    "reporter_name" TEXT,
    "reporter_email" TEXT,
    "resolved_by_id" TEXT,
    "resolved_by_name" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debug_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_workspaces" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "home_page_input_json" JSONB NOT NULL,
    "home_page_html" TEXT NOT NULL,
    "image_package_version" TEXT NOT NULL DEFAULT 'mi-canvas-image-package-v1',
    "visibility" "WorkshopVisibility" NOT NULL DEFAULT 'STAFF_COMMONS',
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "course_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshops" (
    "id" UUID NOT NULL,
    "course_workspace_id" UUID,
    "title" TEXT NOT NULL,
    "course_label" TEXT NOT NULL,
    "term_code" TEXT NOT NULL,
    "summary" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "input_json" JSONB NOT NULL,
    "template_version" TEXT NOT NULL DEFAULT 'workshop-template-v1',
    "visibility" "WorkshopVisibility" NOT NULL DEFAULT 'STAFF_COMMONS',
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_units" (
    "id" UUID NOT NULL,
    "workshop_id" UUID NOT NULL,
    "unit_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "input_json" JSONB NOT NULL,
    "html_output" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateIndex
CREATE UNIQUE INDEX "contributors_display_name_key" ON "contributors"("display_name");

-- CreateIndex
CREATE INDEX "courses_course_code_idx" ON "courses"("course_code");

-- CreateIndex
CREATE INDEX "courses_course_name_idx" ON "courses"("course_name");

-- CreateIndex
CREATE INDEX "courses_development_status_idx" ON "courses"("development_status");

-- CreateIndex
CREATE INDEX "course_outcomes_course_id_idx" ON "course_outcomes"("course_id");

-- CreateIndex
CREATE INDEX "curriculum_assets_course_id_idx" ON "curriculum_assets"("course_id");

-- CreateIndex
CREATE INDEX "curriculum_assets_asset_type_idx" ON "curriculum_assets"("asset_type");

-- CreateIndex
CREATE INDEX "curriculum_assets_status_idx" ON "curriculum_assets"("status");

-- CreateIndex
CREATE INDEX "curriculum_assets_created_at_idx" ON "curriculum_assets"("created_at");

-- CreateIndex
CREATE INDEX "asset_context_links_asset_id_idx" ON "asset_context_links"("asset_id");

-- CreateIndex
CREATE INDEX "asset_context_links_course_id_idx" ON "asset_context_links"("course_id");

-- CreateIndex
CREATE INDEX "asset_context_links_context_type_idx" ON "asset_context_links"("context_type");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "action_history_timestamp_idx" ON "action_history"("timestamp");

-- CreateIndex
CREATE INDEX "action_history_actor_user_id_timestamp_idx" ON "action_history"("actor_user_id", "timestamp");

-- CreateIndex
CREATE INDEX "action_history_area_timestamp_idx" ON "action_history"("area", "timestamp");

-- CreateIndex
CREATE INDEX "action_history_action_type_timestamp_idx" ON "action_history"("action_type", "timestamp");

-- CreateIndex
CREATE INDEX "debug_issues_status_idx" ON "debug_issues"("status");

-- CreateIndex
CREATE INDEX "debug_issues_reporter_user_id_created_at_idx" ON "debug_issues"("reporter_user_id", "created_at");

-- CreateIndex
CREATE INDEX "debug_issues_updated_at_idx" ON "debug_issues"("updated_at");

-- CreateIndex
CREATE INDEX "course_workspaces_course_id_idx" ON "course_workspaces"("course_id");

-- CreateIndex
CREATE INDEX "course_workspaces_title_idx" ON "course_workspaces"("title");

-- CreateIndex
CREATE INDEX "course_workspaces_updated_at_idx" ON "course_workspaces"("updated_at");

-- CreateIndex
CREATE INDEX "workshops_course_workspace_id_idx" ON "workshops"("course_workspace_id");

-- CreateIndex
CREATE INDEX "workshops_course_label_idx" ON "workshops"("course_label");

-- CreateIndex
CREATE INDEX "workshops_term_code_idx" ON "workshops"("term_code");

-- CreateIndex
CREATE INDEX "workshops_title_idx" ON "workshops"("title");

-- CreateIndex
CREATE INDEX "workshops_created_at_idx" ON "workshops"("created_at");

-- CreateIndex
CREATE INDEX "workshop_units_workshop_id_idx" ON "workshop_units"("workshop_id");

-- CreateIndex
CREATE INDEX "workshop_units_updated_at_idx" ON "workshop_units"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "workshop_units_workshop_id_unit_number_key" ON "workshop_units"("workshop_id", "unit_number");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_source_import_batch_id_fkey" FOREIGN KEY ("source_import_batch_id") REFERENCES "course_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_outcomes" ADD CONSTRAINT "course_outcomes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_assets" ADD CONSTRAINT "curriculum_assets_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_context_links" ADD CONSTRAINT "asset_context_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "curriculum_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_context_links" ADD CONSTRAINT "asset_context_links_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_history" ADD CONSTRAINT "action_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debug_issues" ADD CONSTRAINT "debug_issues_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debug_issues" ADD CONSTRAINT "debug_issues_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_workspaces" ADD CONSTRAINT "course_workspaces_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_workspaces" ADD CONSTRAINT "course_workspaces_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_course_workspace_id_fkey" FOREIGN KEY ("course_workspace_id") REFERENCES "course_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_units" ADD CONSTRAINT "workshop_units_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
