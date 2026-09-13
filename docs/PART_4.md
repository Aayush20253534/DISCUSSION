# Part 4: quest completion and progression

Part 4 adds the AtlasBorn progression engine to Part 3's saved journal. Application code remains JavaScript/JSX. It reuses React, Express, Prisma/PostgreSQL, JWT/Argon2id authentication, React Query, Radix dialogs, and Motion. No npm dependency changes are required.

## Upgrade from Part 3

Stop the development server and save the patch in the repository root. Check it first:

```powershell
git apply --ignore-space-change --check .\atlasborn-part-4-progression.patch
```

If the check succeeds:

```powershell
git apply --ignore-space-change .\atlasborn-part-4-progression.patch
npm run db:generate
npm run db:deploy
npm run verify
npm run dev
```

The patch targets the completed Part 3 quest-journal code. It preserves `.env`, `.gitignore`, package manifests, lockfiles, the migration runner, and `server/src/lib/database.js`. Existing database connection fixes remain in place. A fresh clone still needs the root workspace installation and authentication/Neon configuration described in the README.

The new committed migration is `20260912000300_quest_progression`. It adds a completed status, an optional completion timestamp on quests, and the `quest_completions` history table with indexes and constraints. It does not reset existing accounts, sessions, quests, or progress. Existing XP and gold retain their values; existing quests retain their active/archived status. Existing progress is not given invented historical completions.

`db:deploy` uses `DIRECT_URL`. If it still reports `P1001`, the Neon connection must be restored before this migration can run. Schema generation and local verification do not prove that a live Neon endpoint is reachable. Never reset the database to recover from a connection failure.

## Implemented behavior

- Complete an active quest from a journal row or its detail dialog, after confirming that the real-world task is done.
- Show a difficulty-based reward preview in creation/editing, quest details, and the completion confirmation.
- Save character XP, gold, selected-attribute XP, quest status, and the completion receipt in one database transaction.
- Celebrate successful completion and character/attribute level-ups with Motion, subtle particles, and an XP progress bar. Respect the system reduced-motion setting and the app's Gentle animations preference.
- Display real character levels, XP-to-next-level, gold, and attribute levels on the overview and character page.
- Browse completed journal entries and sort by completion time. Read completion history on the character page, with attribute filtering and pagination.
- Refresh account-scoped journal/progression data after completion and across tabs. A late response from an earlier account cannot populate another account's caches.
- Recover a lost completion response by retrying the same quest without another reward. Show an explicitly labeled already-recorded result for retries.
- Keep completed details read-only. Removing a completed quest from the journal keeps its historical receipt and earned progress.

## Rules, version 1

The original problem statement explicitly leaves the exact math open and requires increasing XP costs for successive levels. These values are implementation choices, centralized in `shared/src/progression.js` and enforced by the backend.

| Difficulty | Character XP | Gold | Selected attribute XP |
| ---------- | -----------: | ---: | --------------------: |
| Easy       |           25 |    5 |                    25 |
| Medium     |           60 |   12 |                    60 |
| Hard       |          120 |   24 |                   120 |

Title length, notes, due date, and estimated minutes do not increase the reward. Difficulty and attribute come from the saved, revision-checked quest. The client cannot submit XP, gold, levels, ownership, or completion timestamps. Task completion is self-reported; this system prevents forged balance updates and duplicate quest rewards, not dishonest claims about real-world activity.

For character level `L`:

```text
XP needed to advance from L to L+1 = 100 × L
Total XP needed to enter L        = 50 × L × (L − 1)
```

Character level thresholds are 0, 100, 300, 600, 1,000 XP, and so on. The cumulative curve is quadratic. Four Easy quests or one Hard quest take a new character to level 2. Progress resets within the new level, while lifetime XP remains intact.

Attributes use the same increasing curve at half the cost: `50 × current attribute level` to advance, with total thresholds 0, 50, 150, 300, 500 XP. Only the selected attribute receives XP. All levels are derived from persisted XP, so there is no separate editable level column that can become inconsistent.

XP and gold remain bounded by the existing PostgreSQL integer columns. A completion that would overflow any affected balance is rejected before writing. The transaction fails without partial progress if a required character attribute is missing. Each receipt records the rule version and actual rewards so future balance changes do not rewrite history.

## Completion transaction and retries

1. Verify the JWT and backing session, ownership, onboarding, exact Origin, JSON content type, and signed CSRF token.
2. Lock the authenticated character row with `SELECT … FOR UPDATE`. Different quests for the same character are serialized, including requests handled by different API processes.
3. Look for the existing owned receipt by original quest UUID. If found, return it with current character progress and `newlyCompleted: false`.
4. Read the owned quest. It must be active and match the submitted revision. Atomically claim it using a conditional update of status/revision.
5. Increment character XP/gold and the chosen attribute XP. Save the immutable snapshot and resulting balances/levels in the same transaction.
6. Commit and return the receipt. If any step fails, PostgreSQL rolls back every change.

The unique `original_quest_id` constraint supplies database-level replay protection. An active quest uses its UUID as the completion identity; no additional client-generated reward key is needed. All duplicate completion requests for that quest return the original receipt rather than adding progress again. Valid retries can submit the pre-completion revision because the saved receipt is checked first.

Deleting a completed journal entry sets the receipt's nullable `questId` to null. Its separate original quest UUID remains unique, so even a completion retry after deletion cannot award it again. A new intentional quest has a new UUID and can be rewarded once. There is no completion undo/reset endpoint in Part 4.

Completed quests cannot be edited, restored to active, or archived through the generic update endpoint. Archived quests must be restored before completion. A stale completion cannot reward a difficulty or attribute the user did not confirm.

## Persistence and public data

`quest_completions` stores the title, notes, attribute, difficulty, optional due date/minutes, source revision, actual XP/gold/attribute rewards, rule version, completion instant, account timezone/local date, and before/after levels and resulting balances. The snapshot remains after a journal entry is removed. Deleting the owning user through database/account lifecycle operations cascades to their private history.

Completion time comes from the server. The local completion date is calculated in the saved account IANA timezone and stored with that timezone. Due dates remain separate date-only values. History displays the recorded timezone; it does not reinterpret a historical date using the viewer's browser timezone. Streak calculations will use these records in a later part.

Public receipts exclude user IDs, source revision, password/token hashes, and create idempotency internals. History and progression queries always derive ownership from the session. History count and rows use a repeatable-read snapshot with stable timestamp/UUID ordering and clamped pagination. Offset-based pages can still shift between separate requests when new completions arrive.

## API additions

All routes require authentication and completed onboarding. Responses use the existing `{ "data": ... }` / `{ "error": ... }` envelopes and `Cache-Control: no-store`.

| Method | Endpoint                      | Contract                                                                                                         |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/quests/:id/complete` | Strict JSON `{ "revision": 1 }`; CSRF and Origin required                                                        |
| GET    | `/api/v1/progress`            | Current character, derived progression for character/attributes, lifetime completion count, reward table/version |
| GET    | `/api/v1/progress/history`    | Owned completion snapshots, filtered and paginated                                                               |

Completion returns `201` for a new completion and `200` for a replay:

```json
{
  "data": {
    "newlyCompleted": true,
    "quest": { "id": "...", "status": "COMPLETED", "revision": 2 },
    "completion": { "id": "...", "xpAwarded": 120, "goldAwarded": 24 },
    "character": { "totalXp": 120, "gold": 24, "progression": { "level": 2 } }
  }
}
```

This example abbreviates the full objects. On a replay after journal deletion, `quest` is null. The receipt contains the historical balances; `character` contains the current balances, which may include later completions.

History accepts only `attribute` (five attribute keys or `ALL`), `page` (1–10,000), and `limit` (1–50, default 8). Data contains `completions` and `pagination: { page, limit, total, pages }`.

The existing quest list now accepts `status=COMPLETED` and `sort=COMPLETED`. Quest detail/list objects include `completedAt` and an optional public `completion`. Journal summary `completed` counts entries still in the journal; progression `completedCount` includes historical completions whose entries were removed. Generic create/update still reject a caller-supplied completed status.

| Error                         | Meaning                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `404 QUEST_NOT_FOUND`         | Missing quest/receipt or another account's quest                  |
| `409 QUEST_CHANGED`           | Stale revision or an edit/delete won the race                     |
| `409 QUEST_ARCHIVED`          | Restore the quest before completing it                            |
| `409 QUEST_COMPLETED`         | Attempt to edit or reopen a completed quest                       |
| `409 PROGRESS_LIMIT`          | An affected integer balance would overflow                        |
| `503 PROGRESSION_UNAVAILABLE` | Required attribute data is missing; nothing was awarded           |
| `422 VALIDATION_ERROR`        | Invalid revision, extra reward/ownership fields, or invalid query |

Existing authentication, CSRF, rate-limit, and safe server/database errors remain in effect. No process-local lock or browser flag is relied on to protect reward accounting.

## Validation

`npm run verify` runs lint, 49 automated tests, Prisma validation, and the production build. The suite exercises real Express routes, JWT/Argon2, Prisma, and disposable PostgreSQL via PGlite. It never uses live Neon credentials.

New tests cover all difficulty rewards, character/attribute boundaries, preserving existing progress, duplicate/concurrent requests, different quests updating the same character, stale/archived/completed states, ownership/CSRF, reward-field tampering, history after deletion, replay after deletion, sorting/pagination, integer ceilings, missing attributes, a forced receipt failure with full rollback, and unique constraints/cascading user deletion.

The deployment check applies Part 3 to a disposable database, inserts existing account/session/quest/progress records, then runs the actual Part 4 migration command twice. The upgrade preserves the records, and the second deployment has no pending migrations.

Browser checks cover confirmation/cancellation, reward preview, completion and level-up, persisted totals after refresh, cross-tab updates, stale confirmation reload, a lost completion response and successful replay, completed details/removal, retained history, filters/pagination, errors/retry, and responsive screens down to 320px. Automated accessibility checks supplement visual and interaction inspection.

PGlite has a single underlying database connection. Concurrent HTTP requests exercise retry and accounting paths, while the row locks and conditional SQL updates provide the implementation's multi-connection safeguards. Live Neon TLS/pooling/networking and deployment-specific contention still require a deployment smoke test.

## Quick smoke test

1. Sign in and create a Hard quest under Creativity.
2. Check the preview: 120 XP, 24 gold, and 120 Creativity XP.
3. Choose Complete, cancel once, then confirm. A new character reaches character level 2 and Creativity level 2.
4. Refresh the character page and verify the saved totals and completion history.
5. Open another tab, complete a different quest, and check both tabs refresh.
6. Remove a completed journal entry. Its history and earned progress should remain.

Streaks, recurring quests, reminders, marketplace purchases/inventory, and deployment/video deliverables remain later work. Gold is earned and persisted now; it cannot yet be spent in the preview marketplace. The earlier dependency-tooling audit notes in [PART_2.md](PART_2.md) remain applicable.

## Commit and push

```powershell
git add .
git -c maintenance.auto=false -c gc.auto=0 commit -m "feat: add quest completion, atomic rewards, and character progression"
git push -u origin main
```

The command-local Git options skip automatic housekeeping for this commit, avoiding the repeated OneDrive cleanup prompts without changing permanent Git configuration.
