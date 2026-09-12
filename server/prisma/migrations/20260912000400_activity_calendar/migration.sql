-- Existing completion receipts already contain their immutable local calendar date.
-- This index supports owned daily aggregates, streaks and paginated day history.
CREATE INDEX "quest_completions_user_activity_idx"
ON "quest_completions"("user_id", "completed_date", "completed_at", "id");
