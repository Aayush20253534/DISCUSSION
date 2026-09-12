# Life RPG — Part 9: public website & account settings

A full-stack JavaScript project using React, Express, Node.js, Neon PostgreSQL, Prisma, and Motion for React. Application code uses `.js` and `.jsx` throughout.

Part 9 adds the complete public entry experience and real account management. Signed-out visitors now get a dedicated landing page and How It Works page, while authenticated users can edit their profile/timezone, change their password, inspect/revoke active sessions, and control local motion/sound preferences. Public metadata, social previews, sitemap/robots output, prerendered marketing HTML, and private-route noindex protection are included. Parts 1–8 remain compatible.

## Upgrade from Part 8

Stop the development server. Run these commands in the **repository root**, where `client/`, `server/`, and the root `package.json` live. This patch targets the completed **Part 8 Adventure Dashboard** implementation.

```powershell
git apply --ignore-space-change --check .\life-rpg-part-9.patch
```

If the check succeeds:

```powershell
git apply --ignore-space-change .\life-rpg-part-9.patch
npm run db:generate
npm run db:deploy
npm run verify
npm run dev
```

Part 9 adds no npm dependencies. It adds one additive migration, `20260912000700_account_settings`, which stores optional session user-agent metadata for safe device/session presentation. Keep your existing `server/.env`, JWT secret, Neon connection strings, and all earlier migrations. **Do not reset your database.**

For a fresh clone with Part 2 dependencies recorded in its lockfile:

```powershell
npm ci --workspaces --include-workspace-root --include=dev
npm run setup
npm run auth:configure
```

If dependency installation never completed after Part 2, run `npm install --workspaces --include-workspace-root --include=dev` first and commit the updated root lockfile. `auth:configure` creates a private JWT secret if needed while preserving an existing valid secret and database settings. All setup commands belong at the root, not inside `client`.

## Connect your Neon database

If already configured for Part 1, keep your existing connection strings. Otherwise edit **`server/.env`** and fill:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-POOLED-HOST/DBNAME?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@YOUR-DIRECT-HOST/DBNAME?sslmode=require
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
PUBLIC_APP_URL=http://localhost:5173
```

Use the actual pooled and direct URLs copied from Neon, preserving any additional connection parameters. Never put database URLs or JWT secrets in `client/.env` or `VITE_*` variables. Keep the generated `JWT_SECRET` in `server/.env`.

```powershell
npm run db:deploy
npm run verify
npm run dev
```

Open **http://localhost:5173**. Sign in, or choose **Begin your adventure** to create an account and character. Open **Quest Journal** to save a quest. Mark it complete after doing the task, then open **Character** to see your XP, gold, attribute levels, and completion history. Open **Activity** to see your streak, then open **Marketplace** to spend earned gold and **Inventory** to equip owned cosmetics. Refresh to confirm progression, ownership and equipment persistence. New characters start at level 1 with zero XP and gold.

The API runs on port 4000. `GET /health` checks the process; `GET /health/ready` checks database connectivity. Part 9 adds profile/password/session-management endpoints plus public robots/sitemap output. `db:deploy` applies the additive session metadata migration and preserves all existing account/game data.

Without database configuration, the public preview works, but account forms return a clear unavailable message. If `DATABASE_URL` is set, a valid `JWT_SECRET` is required at startup.

## What is implemented

- A dedicated responsive public landing page and How It Works page with accurate Life RPG product previews and signup/login actions.
- Route-specific metadata, canonical/social metadata, a bundled social card, robots.txt, sitemap.xml, and post-build prerendering for public marketing content.
- HTTP `X-Robots-Tag` protection for private/account SPA routes so authenticated screens are not indexed.
- Editable display name and account timezone with shared validation and daily-quest schedule timezone preservation.
- Authenticated password changes that verify the old Argon2id password, hash the new password, and revoke every other session atomically.
- Active-session listing/revocation with safe browser/platform labels, current-session handling, ownership isolation, and sign-out-other-devices.
- Device-local gentle-motion and celebration-sound preferences, with sound defaulting off for the Part 10 interaction layer.

- A server-authoritative Adventure Dashboard built from one repeatable-read database snapshot.
- Character level/XP, gold, current streak, lifetime completions, and attribute progression in one daily view.
- Prioritized actionable quests with a prominent new-quest path and the existing secure completion confirmation flow.
- Seven-day activity graph with completion/XP/gold totals plus recent immutable reward receipts.
- First-use guidance, loading skeletons, recoverable retry state, focus refetch, and cross-tab invalidation after quest/economy changes.

- A real database-backed Marketplace with 12 curated frames, badges, titles and themes.
- Atomic purchases that serialize against quest rewards, prevent negative balances, and return safe replay results for already-owned items.
- Persistent Inventory with one equipped cosmetic per slot and account-scoped ownership checks.
- Append-only gold ledger for quest earnings and shop spending, including migration backfill for existing completion history.
- Equipped frames, titles, badges and themes applied across the authenticated UI with cross-tab refresh.

- Daily recurring quests that remain active and become reward-eligible once per immutable scheduled local date.
- Database-enforced duplicate protection for both one-time and daily occurrences, plus character/quest row locking.
- Server-anchored schedule timezone/start date, with explicit anti-exploit behavior when the account timezone later changes.
- Daily-ready journal summary/filtering, recurring state in quest editor/details/history, and responsive keyboard-accessible controls.

- Current and longest streaks, all-time active days, and a seven-day dashboard card.
- Monthly activity calendar with timezone-aware dates, keyboard navigation and daily receipt history.
- Automatic reuse of saved Part 4 completions, preserved streak history after journal deletion, and live cross-tab refresh.
- Sequential test-file execution to reduce peak native memory, preserving all existing tests.

- Confirmed quest completion with server-calculated XP, gold, and attribute XP, saved atomically.
- Character and attribute leveling with increasing XP costs, progress bars, and reduced-motion-aware celebrations.
- Database-backed duplicate-reward prevention, stale-confirmation protection, and recoverable lost responses.
- Completed journal filters, saved reward receipts, and paginated completion history that survives journal deletion.
- Existing account-scoped caches and cross-tab updates now refresh character progress too.

The journal also includes:

- Owned quest create/read/update/delete endpoints with strict shared validation and existing JWT/session/CSRF checks.
- A responsive private journal with search, attribute/difficulty/status/schedule filters, sorting, pagination, and real summaries.
- Optional due dates evaluated in the account timezone, editable notes, difficulty, and estimated minutes.
- Archive/restore, explicit delete/discard confirmations, recoverable errors, and creation from editable ideas.
- Database revision checks to prevent stale edits and create request IDs to prevent duplicates when retrying a lost response.
- Account-scoped React Query caches, cross-tab updates, and saved active quests on the personal overview.

The earlier parts also provide:

- Email normalization, shared Zod validation, field errors, password visibility, loading and retry states.
- Argon2id hashing with a unique salt per password; no plaintext password storage.
- HS256 JWT access tokens in HTTP-only cookies, rotating refresh tokens, and PostgreSQL-backed session revocation.
- Signed CSRF protection, exact-origin checks, login/signup rate limits, restricted cookie attributes, and safe API errors.
- Signup/login pages, protected account routes, safe return-to navigation, automatic session refresh, and cross-tab sign-out.
- Three avatar choices, display name and IANA timezone onboarding, with atomic creation of the character and its five attributes.
- Personal dashboard, character details, account preferences, sign-out, and sign-out across all devices.
- Responsive Evergreen visuals, local fonts/artwork, reduced-motion support, and accessible forms.
- Integration tests using Prisma against disposable PostgreSQL via PGlite. Tests never read or modify your Neon database.

**Core progression and the cosmetic economy are now implemented.** Easy/Medium/Hard quests award 25/60/120 XP and 5/12/24 gold. The chosen attribute earns the same XP. Character levels need 100 × current level to advance; attributes need 50 × current level. Archiving earns no rewards. Completed details are read-only; removing an entry keeps its reward history. Streaks count consecutive days with at least one completed quest. Marketplace purchases and inventory equipment are now implemented. Cosmetics do not change XP, attributes, streaks or reward balance; journal ideas become real only after you save them. Email verification, password reset, and email-address changes are not implemented.

## Commands

| Command                  | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `npm run dev`            | Start Express and Vite together                              |
| `npm run auth:configure` | Safely generate the private authentication secret            |
| `npm run setup`          | Preserve ignore rules and generate Prisma Client             |
| `npm run db:deploy`      | Apply committed migrations through `DIRECT_URL`              |
| `npm run verify`         | Lint, integration tests, Prisma validation, production build |
| `npm run build`          | Generate Prisma Client and build the React app               |
| `npm start`              | Run Express; production mode also serves the built client    |
| `npm run format`         | Format project source                                        |

## Windows troubleshooting

- **`Fatal process out of memory: Zone` during tests:** this patch limits Node to one test file at a time (`--test-concurrency=1`), avoiding several PostgreSQL WASM engines starting together. Run `npm run verify` from the root. See [Part 5 diagnostics](docs/PART_5.md#windows-native-out-of-memory-failure) if an isolated file still crashes.

- **`ECONNRESET`:** dependency installation did not finish. Restore network access, then retry the root `npm install --workspaces --include-workspace-root --include=dev` command before running setup. Do not install Prisma globally to hide an incomplete install.
- **`EPERM` / OneDrive locks:** stop running dev servers, close processes holding project files, and pause OneDrive syncing while installing. A local development folder outside OneDrive avoids recurring file locks.
- **`prisma` not recognized:** install all workspaces and development dependencies from the root, then retry `npm run setup`.
- **Origin errors:** open exactly `http://localhost:5173`, or include `http://127.0.0.1:5173` in the existing `CLIENT_ORIGIN` setting. Restart the API after changing `.env`.
- **Invalid `JWT_SECRET`:** run `npm run auth:configure`. If an existing value is too short, the script explains how to replace that value while preserving the rest of `.env`.
- **`P1001` during migration:** `db:deploy` uses `DIRECT_URL` in `server/.env`. Restore connectivity to that Neon endpoint, then rerun the command. This patch preserves your connection code and credentials.
- **Database unavailable:** check both Neon URLs, run `npm run db:deploy`, and check `/health/ready`. A successful API health check alone does not mean database tables exist.

For public-site routing, SEO/prerendering, account/profile/password/session contracts and smoke tests, see [docs/PART_9.md](docs/PART_9.md). For the dashboard snapshot, aggregation rules, first-use flow and smoke tests, see [docs/PART_8.md](docs/PART_8.md). For the shop transaction, inventory/equipment model, gold ledger, API contracts and smoke tests, see [docs/PART_7.md](docs/PART_7.md). For daily recurrence rules, timezone policy, database constraints and smoke tests, see [docs/PART_6.md](docs/PART_6.md). For streak rules, activity API contracts, memory diagnostics and smoke tests, see [docs/PART_5.md](docs/PART_5.md). For progression rules, the completion transaction, API contracts, migration details, and smoke tests, see [docs/PART_4.md](docs/PART_4.md). Earlier journal details are in [docs/PART_3.md](docs/PART_3.md). Authentication design, deployment settings, and existing dependency audit findings remain in [docs/PART_2.md](docs/PART_2.md).

The automated test suite runs locally against disposable PostgreSQL via PGlite and never uses your Neon database. A successful verification run does not verify your live Neon connection; complete the create/complete/refresh smoke test after deployment.
