# Part 8 — Adventure Dashboard and progress history integration

Part 8 turns the authenticated home screen into the product's daily command center. Earlier parts already had the source systems separately: quests, progression, streak/activity, character attributes, inventory/economy, and completion history. The dashboard now reads those sources in one repeatable-read server snapshot instead of asking the browser to assemble several independently timed responses.

## Goals

The dashboard must answer six questions immediately:

1. Who is my character and how close am I to the next level?
2. What should I do today?
3. What is my current streak and spendable gold balance?
4. Which attributes are growing?
5. What did I complete recently and what did it award?
6. What has the last week of activity looked like?

The response is read-only. Opening the dashboard never awards XP, changes a streak, edits a quest, or creates wallet entries.

## API

### `GET /api/v1/dashboard`

Authentication and completed character onboarding are required. Responses use `Cache-Control: no-store`.

The endpoint returns one consistent snapshot with:

- `generatedAt`, account `timezone`, and server-derived local `today`;
- fully derived character progression and attribute progression;
- lifetime completion count;
- active/archived/due/overdue/daily/daily-ready quest counts;
- up to five prioritized eligible quests;
- current and longest streak plus active-day totals;
- exactly seven local activity-date buckets with completion, XP, and gold totals;
- recent immutable completion receipts including awarded XP/gold/attribute XP and level changes;
- a small first-use state used only to guide brand-new accounts.

The dashboard does not accept a client date, timezone, XP value, gold value, or reward calculation.

## Snapshot consistency

The endpoint uses a PostgreSQL `REPEATABLE READ` transaction. This matters because a dashboard assembled from separate requests can otherwise show combinations that never existed at the same instant, such as:

- a new gold balance with an old completion count;
- a completed quest still appearing as active;
- a streak updated before the weekly graph catches up.

Within one dashboard request, character totals, quest counts, streaks, weekly groups, and recent receipts all observe the same database snapshot.

## Today's quest ordering

The dashboard intentionally does not copy the entire journal. It selects at most five actionable active quests in this order:

1. overdue one-time quests;
2. one-time quests due today;
3. daily quests eligible for the current scheduled day;
4. unscheduled one-time quests;
5. future one-time quests.

Daily eligibility is checked using the quest's immutable schedule timezone and the server clock. A daily quest that already has a receipt for its scheduled date is not returned as actionable.

The full journal remains the source for editing, archiving, searching, and pagination.

## Streak and weekly activity

Streaks continue to be derived from immutable `quest_completions.completed_date` rows. Multiple completions on the same day count as one active streak day, while the weekly graph still shows the actual number of completions and rewards for each day.

The seven-day range is account-local and ends on `today`. Each bucket contains:

```json
{
  "date": "2028-03-01",
  "count": 2,
  "xp": 85,
  "gold": 17
}
```

The dashboard and Activity page therefore use the same completion history as their source of truth.

## Recent progress history

The recent list is composed from immutable completion receipts, not the current quest row. It preserves:

- completion timestamp and local completion date;
- title/description snapshot;
- attribute and difficulty;
- recurrence/scheduled date;
- XP, gold, and attribute-XP awards;
- character and attribute level transitions.

If a completed journal entry is later deleted, its dashboard history remains available and its `questId` becomes `null`. The earned progress is never reconstructed from the current quest definition.

## First-use guidance

A character with zero completion receipts gets one of two server-derived states:

- `CREATE_QUEST` when no active quest exists;
- `COMPLETE_QUEST` when at least one active quest exists.

The UI uses this state to show a three-step introduction without inventing sample progress. The guide disappears after the first real completion.

## Client behavior

`useDashboard()` uses an account-scoped React Query key:

```text
['dashboard', userId]
```

It:

- keeps a short 15-second stale window;
- refreshes every 60 seconds while mounted;
- refetches when the browser window regains focus;
- does not retry failed requests automatically;
- resets authentication state if the API reports an auth/onboarding problem.

Quest mutations invalidate the dashboard in the same tab and through the existing quest `BroadcastChannel`. Economy mutations also invalidate it because purchases change the character's gold balance. This prevents the home screen from showing stale values after a completion or purchase.

## UI composition

The authenticated dashboard now contains:

- a compact character card with portrait cosmetics, title/badge, level and XP meter;
- current streak, spendable gold, and lifetime completion counters;
- a prioritized Today's Quests panel with a prominent New Quest action;
- direct access to the existing secure completion confirmation dialog;
- a seven-day activity chart and totals;
- an attribute overview using the same level curve as the Character page;
- recent immutable completion receipts with exact earned rewards;
- a dedicated first-use guide;
- responsive loading skeletons and a retryable error state.

The guest preview remains unchanged.

## Accessibility and responsive behavior

- The weekly graph contains screen-reader text for every date and reward total; visual bars are decorative.
- Attribute tracks expose native progressbar semantics and numeric values.
- All dashboard actions are real links/buttons with visible keyboard focus inherited from the design system.
- The layout collapses from two columns to one and then simplifies controls for narrow mobile screens.
- Loading uses one status region instead of announcing every skeleton.
- The recoverable error state never replaces saved data with fabricated fallback numbers.

## Tests

`server/tests/dashboard.test.js` verifies:

- zero-state totals and first-use guidance;
- dashboard totals against the existing Progress, Activity, Wallet and Quest sources;
- priority ordering for overdue/today/daily-ready quests;
- weekly totals and streak consistency;
- first-use transition after saving a quest without awarding progression;
- account isolation, authentication, onboarding enforcement;
- completion history surviving journal deletion.

The test database remains disposable PGlite PostgreSQL and never connects to Neon.

## Deployment

Part 8 has **no database migration** and adds no package dependency.

From a completed Part 7 checkout:

```powershell
npm run verify
npm run dev
```

A production smoke test should confirm:

1. sign in to an account with existing progress;
2. compare dashboard level/gold/completion totals with Character and Inventory/Wallet;
3. create a quest and confirm it appears on the dashboard;
4. complete it from the dashboard confirmation flow;
5. verify the quest disappears or updates appropriately, XP/gold/streak/history refresh, and the weekly day bucket increments;
6. focus another browser window after changing data on a second device and confirm the dashboard refetches;
7. delete a completed journal entry and confirm the recent/history receipt remains.
