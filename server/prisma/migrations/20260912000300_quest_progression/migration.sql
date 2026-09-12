-- Additive: preserve all existing quests, accounts, sessions, XP and gold.
ALTER TYPE "QuestStatus" ADD VALUE 'COMPLETED';
ALTER TABLE "quests" ADD COLUMN "completed_at" TIMESTAMPTZ(3);
CREATE INDEX "quests_user_id_status_completed_at_id_idx" ON "quests"("user_id", "status", "completed_at", "id");

CREATE TABLE "quest_completions" (
  "id" UUID NOT NULL,
  "original_quest_id" UUID NOT NULL,
  "quest_id" UUID,
  "user_id" UUID NOT NULL,
  "source_revision" INTEGER NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "attribute" "AttributeKey" NOT NULL,
  "difficulty" "QuestDifficulty" NOT NULL,
  "due_date" DATE,
  "estimated_minutes" INTEGER,
  "xp_awarded" INTEGER NOT NULL,
  "gold_awarded" INTEGER NOT NULL,
  "attribute_xp_awarded" INTEGER NOT NULL,
  "rules_version" INTEGER NOT NULL,
  "completed_at" TIMESTAMPTZ(3) NOT NULL,
  "completed_date" DATE NOT NULL,
  "timezone" VARCHAR(80) NOT NULL,
  "level_before" INTEGER NOT NULL,
  "level_after" INTEGER NOT NULL,
  "attribute_level_before" INTEGER NOT NULL,
  "attribute_level_after" INTEGER NOT NULL,
  "total_xp_after" INTEGER NOT NULL,
  "gold_after" INTEGER NOT NULL,
  "attribute_xp_after" INTEGER NOT NULL,
  CONSTRAINT "quest_completions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quest_completions_reward_bounds" CHECK (
    "xp_awarded" > 0 AND "gold_awarded" >= 0 AND "attribute_xp_awarded" > 0
    AND "total_xp_after" >= "xp_awarded" AND "gold_after" >= "gold_awarded"
    AND "attribute_xp_after" >= "attribute_xp_awarded"
  ),
  CONSTRAINT "quest_completions_level_bounds" CHECK (
    "level_before" >= 1 AND "level_after" >= "level_before"
    AND "attribute_level_before" >= 1 AND "attribute_level_after" >= "attribute_level_before"
    AND "rules_version" >= 1 AND "source_revision" >= 1
  ),
  CONSTRAINT "quest_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quest_completions_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- This key survives deleting a journal entry. The original quest can never be rewarded twice.
CREATE UNIQUE INDEX "quest_completions_original_quest_id_key" ON "quest_completions"("original_quest_id");
CREATE UNIQUE INDEX "quest_completions_quest_id_key" ON "quest_completions"("quest_id");
CREATE INDEX "quest_completions_user_id_completed_at_id_idx" ON "quest_completions"("user_id", "completed_at", "id");
CREATE INDEX "quest_completions_user_id_attribute_completed_at_id_idx" ON "quest_completions"("user_id", "attribute", "completed_at", "id");
