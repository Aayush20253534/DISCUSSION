-- Part 11 production indexes target the two hottest compound access patterns:
-- actionable quest ordering and account-scoped completion occurrence checks.
CREATE INDEX "quests_user_status_recurrence_due_created_idx"
  ON "quests"("user_id", "status", "recurrence", "due_date", "created_at", "id");

CREATE INDEX "quest_completions_user_occurrence_idx"
  ON "quest_completions"("user_id", "original_quest_id", "recurrence", "scheduled_date");
