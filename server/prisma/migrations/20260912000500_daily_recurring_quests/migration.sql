-- Part 6: daily recurring quests. Existing one-time quests and completion history are preserved.
CREATE TYPE "QuestRecurrence" AS ENUM ('ONCE', 'DAILY');

ALTER TABLE "quests"
  ADD COLUMN "recurrence" "QuestRecurrence" NOT NULL DEFAULT 'ONCE',
  ADD COLUMN "schedule_start_date" DATE,
  ADD COLUMN "schedule_timezone" VARCHAR(80);

ALTER TABLE "quest_completions"
  ADD COLUMN "recurrence" "QuestRecurrence" NOT NULL DEFAULT 'ONCE',
  ADD COLUMN "scheduled_date" DATE,
  ADD COLUMN "schedule_timezone" VARCHAR(80);

-- Part 4 allowed one receipt per quest. Daily quests need one receipt per scheduled local date.
DROP INDEX "quest_completions_original_quest_id_key";
DROP INDEX "quest_completions_quest_id_key";

-- Defense in depth: application locks/idempotency are not the only duplicate-reward protection.
CREATE UNIQUE INDEX "quest_completions_once_reward_key"
  ON "quest_completions"("original_quest_id") WHERE "recurrence" = 'ONCE';
CREATE UNIQUE INDEX "quest_completions_daily_reward_key"
  ON "quest_completions"("original_quest_id", "scheduled_date") WHERE "recurrence" = 'DAILY';
CREATE INDEX "quests_user_status_recurrence_schedule_idx"
  ON "quests"("user_id", "status", "recurrence", "schedule_start_date", "id");
CREATE INDEX "quest_completions_quest_id_idx" ON "quest_completions"("quest_id");
CREATE INDEX "quest_completions_original_quest_id_scheduled_date_idx"
  ON "quest_completions"("original_quest_id", "scheduled_date");

ALTER TABLE "quests" ADD CONSTRAINT "quests_recurrence_schedule_valid" CHECK (
  ("recurrence" = 'ONCE' AND "schedule_start_date" IS NULL AND "schedule_timezone" IS NULL)
  OR
  ("recurrence" = 'DAILY' AND "schedule_start_date" IS NOT NULL AND "schedule_timezone" IS NOT NULL
    AND "due_date" IS NULL AND "completed_at" IS NULL AND "status" <> 'COMPLETED')
);

ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_schedule_valid" CHECK (
  ("recurrence" = 'ONCE' AND "scheduled_date" IS NULL AND "schedule_timezone" IS NULL)
  OR
  ("recurrence" = 'DAILY' AND "scheduled_date" IS NOT NULL AND "schedule_timezone" IS NOT NULL)
);
