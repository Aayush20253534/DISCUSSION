-- Part 9: account settings and useful session management metadata.
-- Existing sessions remain valid; their user-agent is intentionally unknown.
ALTER TABLE "sessions" ADD COLUMN "user_agent" VARCHAR(300);

CREATE INDEX "sessions_user_created_id_idx"
  ON "sessions"("user_id", "created_at", "id");
