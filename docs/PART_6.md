# Part 6 — Daily activity, recurring quests and streaks

Part 6 adds server-controlled daily quest eligibility to the activity and streak foundation established in Part 5.

- A day is active when at least one committed quest completion exists for that account-local calendar date.
- Multiple completions on one day still contribute one streak day.
- Daily quests keep an immutable schedule timezone and start date.
- The server clock, never a browser-submitted timestamp, determines the scheduled local date.
- One-time quests can earn once; daily quests can earn once per scheduled local date.
- Database partial unique indexes enforce both rules under retries and concurrent requests.
- Account timezone changes do not rewrite a daily quest's schedule timezone, preventing timezone hopping from manufacturing an extra daily reward.
- Completion receipts preserve schedule and activity dates independently so history remains auditable.

The primary implementation is migration `20260912000500_daily_recurring_quests`, `server/src/progression/complete.js`, the quest router/presentation layer, the shared quest contracts, and the Quest Journal recurring controls.
