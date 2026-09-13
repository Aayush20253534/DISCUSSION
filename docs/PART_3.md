# Part 3: the saved quest journal

Part 3 turns the private quest page into a PostgreSQL-backed journal. It builds on Part 2's JWT authentication, Argon2id password hashing, sessions, and character onboarding. All new application code is JavaScript or JSX, with no new npm dependencies.

## Upgrade from Part 2

Stop the development server. Run the following in the repository root containing `client/`, `server/`, and the root `package.json`. The patch targets the completed Part 2 JWT/Argon2 implementation.

```powershell
git apply --ignore-space-change --check .\atlasborn-part-3-quest-journal.patch
```

Continue only if the check succeeds:

```powershell
git apply --ignore-space-change .\atlasborn-part-3-quest-journal.patch
npm run db:generate
npm run db:deploy
npm run verify
npm run dev
```

Existing working Part 2 installations do not need another dependency installation. On a fresh clone, install the committed workspace dependencies with `npm ci --workspaces --include-workspace-root --include=dev`, then run `npm run setup` and `npm run auth:configure`. Configure the real Neon `DATABASE_URL` and `DIRECT_URL` in `server/.env` before deploying migrations. If the root lockfile was never updated after Part 2, use `npm install --workspaces --include-workspace-root --include=dev` first and commit the resulting lockfile.

Keep the existing JWT secret and connection strings. This patch does not modify `.env`, root `.gitignore`, or `package-lock.json`. It adds one migration and does not require a database reset. A failed patch check means the local files differ from the expected Part 2 baseline; resolve that difference before applying.

Open `http://localhost:5173`, sign in, finish character onboarding if necessary, and open **Quest Journal**. Create a quest, reload, edit it, archive and restore it, and check it appears on the overview. Delete only a disposable quest when checking permanent deletion. Existing character progress should remain unchanged.

## User experience

- Create a quest with a title, notes, one of five attributes, difficulty, optional estimated minutes, and an optional due date.
- Read full details, edit, archive, restore, or permanently delete with confirmation.
- Search titles and notes. Filter by attribute, difficulty, status, and schedule; sort by creation time, due date, or title.
- Browse paginated results with filters stored in the URL. Summaries show active, due-today, and archived totals.
- See the next three active quests on the personal overview, ordered by due date with unscheduled quests last. Links open the saved quest or a new-quest form.
- Start from an editable idea. Ideas become saved quests only after submitting the form.
- Receive validation, loading, empty, error, retry, success, and stale-edit states. Closing a changed editor asks whether to discard the draft.
- Receive refreshed journal data after mutations and changes in another signed-in tab. Query caches are scoped to the account, and changing accounts unmounts open editors.
- Use the existing Evergreen design, Motion page transitions, keyboard-accessible Radix dialogs, and reduced-motion behavior on desktop and mobile.

## Persistence

`20260912000200_quest_journal` creates the `quests` table, `QuestDifficulty` and `QuestStatus` enums, ownership indexes, and a foreign key to `users` with cascading deletion. Existing foundation tables are preserved.

| Field                      | Rule                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `id`                       | Server-generated UUID                                              |
| `userId`                   | Taken from the authenticated session                               |
| `title`                    | Trimmed, 3–120 characters                                          |
| `description`              | Trimmed, up to 2,000 characters; defaults to empty                 |
| `attribute`                | `INTELLECT`, `STRENGTH`, `DISCIPLINE`, `CREATIVITY`, or `VITALITY` |
| `difficulty`               | `EASY`, `MEDIUM`, or `HARD`; defaults to `EASY`                    |
| `status`                   | `ACTIVE` or `ARCHIVED`; created active                             |
| `estimatedMinutes`         | Optional integer from 1 to 1,440                                   |
| `dueDate`                  | Optional PostgreSQL `DATE`; real date from 1900 through 2100       |
| `revision`                 | Starts at 1; increases on every successful update                  |
| `requestId`, `requestHash` | Internal create-retry protection; excluded from public responses   |
| `createdAt`, `updatedAt`   | Database timestamps                                                |

Due dates are calendar dates serialized as `YYYY-MM-DD`, not browser-local timestamps. Today, upcoming, and overdue use the account's saved IANA timezone. Upcoming means strictly after today; overdue means strictly before today. Unscheduled dates match neither. Summary due counts include active quests only. The list response includes the account timezone and the date used for its calculation.

## API contract

All endpoints below require a valid access JWT, a live matching database session, and a completed character. Mutation requests additionally require JSON, an allowed Origin, and the signed CSRF token from Part 2. All responses use `Cache-Control: no-store`.

| Method | Endpoint                 | Behavior                                                                                                         |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/quests/summary` | Returns active/archived totals, active due-today/overdue totals, active counts by attribute, today, and timezone |
| GET    | `/api/v1/quests`         | Returns owned filtered quests, pagination, today, and timezone                                                   |
| GET    | `/api/v1/quests/:id`     | Returns an owned quest                                                                                           |
| POST   | `/api/v1/quests`         | Creates an active quest; requires a UUID `requestId`                                                             |
| PATCH  | `/api/v1/quests/:id`     | Updates supplied editable fields and/or status; requires current `revision`                                      |
| DELETE | `/api/v1/quests/:id`     | Permanently deletes an owned quest; JSON body requires current `revision`                                        |

Create example:

```json
{
  "requestId": "70b70389-52cd-4d56-9060-2b67d4701cdb",
  "title": "Read one chapter",
  "description": "Write down one useful idea afterward.",
  "attribute": "INTELLECT",
  "difficulty": "EASY",
  "estimatedMinutes": 20,
  "dueDate": "2026-09-15"
}
```

Generate a fresh UUID for each new draft. The frontend uses `crypto.randomUUID()`. Optional create fields have the defaults shown above; `title`, `attribute`, and `requestId` are required. Updates omit unchanged fields and use `null` to clear the date or minutes. For example, `{ "revision": 1, "status": "ARCHIVED" }` archives a quest.

Success uses `{ "data": ... }`. Single-quest operations return `{ "data": { "quest": ... } }`; delete returns `{ "data": { "deleted": true, "id": ... } }`. List data contains `quests`, `pagination: { page, limit, total, pages }`, `today`, and `timezone`. Summary `byAttribute` contains only attributes with active quests; absent attributes mean zero. Errors retain Part 2's `{ "error": { "code", "message", "fields"?, "requestId" } }` envelope.

List query parameters are strict; unknown fields and malformed numbers are rejected:

| Parameter    | Values / default                                                            |
| ------------ | --------------------------------------------------------------------------- |
| `q`          | Case-insensitive title/notes search, up to 120 characters; empty by default |
| `attribute`  | Five attribute keys or `ALL`; defaults to `ALL`                             |
| `difficulty` | Three difficulty keys or `ALL`; defaults to `ALL`                           |
| `status`     | `ACTIVE`, `ARCHIVED`, `ALL`; defaults to `ACTIVE`                           |
| `due`        | `ALL`, `TODAY`, `UPCOMING`, `OVERDUE`, `UNSCHEDULED`; defaults to `ALL`     |
| `sort`       | `NEWEST`, `OLDEST`, `DUE`, `TITLE`; defaults to `NEWEST`                    |
| `page`       | Positive integer, maximum 10,000; defaults to 1                             |
| `limit`      | Positive integer, maximum 50; defaults to 12                                |

Search escapes SQL wildcard characters so `%` and `_` are literal search text. Every ordering has a unique ID tie-breaker. Count and list queries run in a repeatable-read transaction, and a page beyond the remaining results clamps to the last available page. Empty results report page 1 of 1. Changes between separate page requests can still shift offset-based pagination.

## Ownership, conflicts, and retries

Ownership always comes from the verified session. Requests cannot supply a user ID, rewards, XP, or gold. List, summary, detail, update, and delete queries are scoped to the caller. A missing quest and another account's quest both return `404 QUEST_NOT_FOUND`.

Updates and deletes compare the submitted revision inside the database. A stale owned record returns `409 QUEST_CHANGED`, preserving the newer data. The editor retains the user's draft and offers an explicit **Load latest quest** action that replaces it; it never silently overwrites another edit.

Creation has a unique `(userId, requestId)` constraint and stores a hash of the validated original payload. The first request returns 201. A duplicate with the same payload returns 200 and the existing quest, including after concurrent submissions. Reusing the key with a different payload returns `409 QUEST_CREATE_CONFLICT`.

When a create response is lost, the editor preserves and locks that draft and its key while offering **Retry save**. Retrying does not insert another row. This guarantee lasts while that quest exists; permanently deleting it also deletes its retry record. Drafts are held in memory and do not survive closing the editor or reloading the page. Update/delete network failures can represent an already-applied action; refreshing loads the actual saved state and revision checks protect subsequent writes.

The account router and journal share authentication middleware so revocation and expiry behave consistently. Existing session refresh and CSRF handling are reused. Part 2's deployment requirements and outstanding dependency-tooling audit findings remain documented in [PART_2.md](PART_2.md).

## Verification and limits

`npm run verify` runs ESLint, 34 automated tests across authentication, foundation, shared contracts, and quests, Prisma validation, and the production client build. Tests use disposable PGlite PostgreSQL through the real Prisma adapter and Express API. They apply all committed migrations and never use the user's Neon database.

New coverage includes authenticated ownership on every quest endpoint, onboarding and CSRF gates, validation, literal search, filters, stable sorting, page clamping, timezone boundaries, duplicate/concurrent creates, revision conflicts, optional-field clearing, archive/restore/delete, cascading ownership, and unchanged character XP/gold.

Separate migration checks deploy the actual Part 2 migration, insert an existing user/character/session, then deploy Part 3 twice. Existing account/session/progress data survives, and the second deploy is a no-op. Browser checks exercise real login, CRUD, persistence, cross-tab refresh, stale edits, a lost-create-response retry, dashboard links, validation/discard/delete dialogs, and API error recovery. The checked desktop, mobile, and 320px screens have no horizontal overflow or automated WCAG A/AA accessibility violations. Automated checks are not a complete accessibility certification.

The migration and integration checks use local PostgreSQL via PGlite, not a live Neon project. Neon TLS, pooling, deployment networking, and true multi-connection database contention still need the deployment smoke test above.

## Part 4 boundary

Part 3 implements quest planning and management. Archiving does not complete a quest or award progress. Part 4 will add completion records, server-calculated XP/gold, atomic reward accounting, and level progression. Streaks, recurring quests, reminders, and shop purchases remain for later parts. Existing preview progress is never credited to an account.

## Commit

After verification, from the repository root:

```powershell
git add .
git -c maintenance.auto=false -c gc.auto=0 commit -m "feat: add authenticated quest journal with CRUD and filters"
git push -u origin main
```

The two command-local Git options skip automatic housekeeping during this commit, avoiding the repeated cleanup prompts seen in the OneDrive folder. They do not change permanent Git configuration.
