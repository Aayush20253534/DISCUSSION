-- Additive migration: all existing accounts, sessions and character progress are preserved.
CREATE TYPE "QuestDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "QuestStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "quests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "request_id" UUID NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(2000) NOT NULL DEFAULT '',
  "attribute" "AttributeKey" NOT NULL,
  "difficulty" "QuestDifficulty" NOT NULL DEFAULT 'EASY',
  "status" "QuestStatus" NOT NULL DEFAULT 'ACTIVE',
  "estimated_minutes" INTEGER,
  "due_date" DATE,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "quests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quests_title_valid" CHECK (char_length(btrim("title")) BETWEEN 3 AND 120),
  CONSTRAINT "quests_minutes_valid" CHECK ("estimated_minutes" IS NULL OR "estimated_minutes" BETWEEN 1 AND 1440),
  CONSTRAINT "quests_revision_positive" CHECK ("revision" > 0),
  CONSTRAINT "quests_due_date_valid" CHECK ("due_date" IS NULL OR "due_date" BETWEEN DATE '1900-01-01' AND DATE '2100-12-31'),
  CONSTRAINT "quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "quests_user_id_request_id_key" ON "quests"("user_id", "request_id");
CREATE INDEX "quests_user_id_status_created_at_id_idx" ON "quests"("user_id", "status", "created_at", "id");
CREATE INDEX "quests_user_id_status_due_date_id_idx" ON "quests"("user_id", "status", "due_date", "id");
CREATE INDEX "quests_user_id_attribute_status_idx" ON "quests"("user_id", "attribute", "status");
