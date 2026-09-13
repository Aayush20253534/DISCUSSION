# Part 5 — streaks, activity calendar, and lower-memory verification

## Install this patch

This patch targets the complete Part 4 JavaScript implementation. Run from the repository root after stopping the development server:

```powershell
git apply --ignore-space-change --check .\atlasborn-part-5-activity.patch
git apply --ignore-space-change .\atlasborn-part-5-activity.patch
npm run db:generate
npm run db:deploy
npm run verify
npm run dev
```

No new packages or environment variables are required. Existing credentials, local ignore rules, lockfiles, database connection code and authentication settings are preserved. Apply the patch once. Do not reset the database. A failed `--check` means the local baseline differs; stop before applying and inspect the reported files.

## Windows native out-of-memory failure

The reported `Fatal process out of memory: Zone` happens after Prisma generation while Node runs database test files. The existing command allows multiple test-file child processes to start together; each integration file creates its own PostgreSQL WASM engine. Concurrent native compilation/allocation is the likely source of the high peak memory. It is a process crash, not a failed authentication or progression assertion and not a Neon connection failure.

The root test script now uses:

```text
npm run db:generate && node --test --test-concurrency=1 server/tests/*.test.js shared/tests/*.test.js
```

Node's [test runner execution model](https://nodejs.org/download/release/v22.17.0/docs/api/test.html#test-runner-execution-model) documents separate file processes and the concurrency limit. Only one test file runs at a time. This keeps process isolation and releases an engine before the next file starts. All authentication, Argon2id, transaction, ownership, and concurrent-request tests remain enabled; `Promise.all` race tests inside a file still run concurrently. No password-hashing strength, test assertions, or database constraints were reduced. No V8 heap override is required by this patch.

The Windows crash cannot be reproduced on this Linux workspace. The complete suite is verified here with serialization; rerun `npm run verify` on the affected machine. If a single test process still runs out of memory, close other memory-heavy applications and provide `node -p "process.version + ' ' + process.arch"`, available RAM, and the isolated failing-file output. An isolated diagnostic command is `node --test --test-concurrency=1 server/tests/auth.test.js`. More JavaScript heap is not an established fix for a native Zone allocation failure.

## Streak rules

- **Active day:** at least one successfully completed quest. Planning, creating, editing, archiving, logging in, or merely opening the calendar does not count.
- **One day, one step:** several quests on one date increase the day's completion and reward totals but count as one active day.
- **Current streak:** consecutive recorded active dates ending today or yesterday. If yesterday was active, there is all of today left to continue. When the latest active date is earlier than yesterday, current streak is zero.
- **Longest streak:** the longest consecutive run in recorded history through today. It survives a missed day, new streak, or journal deletion.
- **Timezone:** the API decides today using its clock and the saved IANA account timezone. Each completion keeps Part 4's original `completedDate` and `timezone`. Dates are compared as calendar labels; a day is not assumed to last 24 hours.
- **Historical stability:** past completions are never moved between dates. If an administrator changes an account timezone across the date line, a receipt whose recorded date is ahead of the new today stays recorded but is excluded from activity calculations until that date arrives. There is no account-timezone editing UI in this phase.
- **Durability:** deleting a completed quest preserves its receipt and active day. Retrying completion cannot create another receipt or reward. Deleting the owner still cascades private data.
- **Rewards:** streaks do not grant bonus currency, XP, multipliers or items in this phase. Existing quest reward rules are unchanged.

No cron job or mutable streak counter is needed. Streaks derive from the committed receipts at read time, so downtime over midnight cannot leave stored counters stale. Existing Part 4 history counts immediately without a backfill.

## Backend and database

`GET /api/v1/activity?month=YYYY-MM` returns:

- Account `timezone`, server-derived `today`, selected `month`.
- `streaks`: `currentStreak`, `longestStreak`, `totalActiveDays`, `firstActiveDate`, `lastActiveDate`, `todayCompletedCount`.
- `week`: seven date/count/XP/gold entries ending today.
- `days`: a complete selected calendar month, with zero-filled empty and future dates.
- `totals`: selected-month active days, completions, XP and gold through today.

Without `month`, the server selects the current account-local month. Streak statistics always describe the present even when browsing a historical month. Months from January 1900 through the current month are accepted.

`GET /api/v1/activity/day?date=YYYY-MM-DD&page=1&limit=8` returns the selected date's saved completion receipts, original timezone/timestamp and stable pagination. Limits are 1–50, pages 1–10000; excessive valid page numbers clamp to the last page. Empty dates return page 1 of 1. Only dates from 1900 through today are accepted. Original titles, attributes and earned rewards remain visible when a quest is removed.

Both endpoints require the existing valid JWT/session and completed onboarding, set `Cache-Control: no-store`, use strict query validation, scope every database query to the authenticated owner, and return a repeatable-read snapshot. Unsupported parameters (including caller-supplied owner, clock or timezone) return 422 `VALIDATION_ERROR`; future requests return 400 `FUTURE_ACTIVITY`. Existing safe error handling covers database outages. No read endpoint mutates progress.

Consecutive date runs are aggregated in PostgreSQL using distinct dates and window functions, returning one small streak summary instead of transferring all history to Node. Calendar/weekly aggregates are bounded to at most 38 distinct dates. Daily receipts are paginated.

Migration `20260912000400_activity_calendar` adds `quest_completions_user_activity_idx` on `(user_id, completed_date, completed_at, id)`. It changes no row data or reward rules. Run `db:deploy` before starting the app; it also applies any earlier pending migrations. A repeat deploy is a no-op. Neon must be reachable for deployment; local test success does not prove live connectivity.

## Frontend

- Protected `/activity` route, sidebar and mobile navigation, and safe return to Activity after sign-in.
- Dashboard streak card with the last seven days and a link to the complete calendar.
- Current/longest/all-time active-day cards, today's status, monthly date picker/navigation, visible completion counts and intensity legend.
- Monday-first calendar with real month lengths, today's marker and selected-date state. Tab enters the calendar once; arrow keys move and select within the month; Enter/Space or pointer activation selects dates. Future dates are disabled. Month navigation moves focus to the newly loaded month heading.
- Paginated daily history with original reward details, links to surviving quests, and retained history for removed entries.
- Empty/loading/error/retry states, 320px/mobile/desktop layouts, labelled controls and reduced-motion preferences.
- Account-scoped React Query keys use the existing `progress` namespace. Completing/removing a quest refreshes activity immediately and broadcasts to other tabs. Account changes clear private query caches. Visible views poll every 30 seconds and refetch on focus/reconnection, including date changes over midnight; no browser clock or primary localStorage persistence is used.

## Verification

Verification completed on Linux with Node 24: all 61 tests pass, ESLint passes, Prisma validates, and the production client builds. Browser checks cover 10 desktop/mobile/320px/error/reduced-motion views with no horizontal overflow, reported runtime exceptions or axe WCAG A/AA violations in those views. The Part 4 → Part 5 migration and repeated-deploy rehearsal preserved existing rows. Automated checks do not replace a complete manual accessibility audit.

Automated tests use disposable PostgreSQL through Prisma/PGlite and never connect to Neon. New coverage includes duplicate active dates, leap years/centuries, month/year boundaries, US daylight-saving transitions, date-line timezones, midnight expiry, longest-streak preservation, historical timezone snapshots, owned history, revoked sessions, validation, pagination and deletion/retry invariants. Existing Part 1–4 tests remain enabled.

Manual smoke test after deployment:

1. Sign in and open Activity. Existing completed days should already appear.
2. Complete a quest in the journal. Today's count increases and the overview streak refreshes. A second completion today increases counts, not the number of active days.
3. Open Activity in another tab, complete a quest in the first tab, and check the second updates.
4. Select a previous day/month, use the keyboard arrows, and inspect daily receipts and pagination.
5. Remove a completed journal entry. Its history and active day remain after refresh.
6. Sign out and sign in with a different account. The calendar contains only that account's history.

The live Neon smoke test and true multi-connection database contention are not reproduced by the local single-connection PGlite test adapter. Part 4's transaction locks and replay constraints remain intact.

## Next phase

Marketplace purchases and inventory/equipment remain to be implemented. They will consume saved gold with server-side balance checks and persistent owned items. Marketplace items currently remain previews. Password reset and profile editing are also outside this historical patch.

Suggested commit:

```powershell
git add .
git -c maintenance.auto=false -c gc.auto=0 commit -m "feat: add streaks and activity calendar; reduce test memory usage"
git push -u origin main
```
