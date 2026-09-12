# Life RPG — Part 5: streaks & activity calendar

A full-stack JavaScript project using React, Express, Node.js, Neon PostgreSQL, Prisma, and Motion for React. Application code uses `.js` and `.jsx` throughout.

Part 5 adds current and longest streaks, a monthly activity calendar, daily completion history, and a seven-day overview. It builds on real quest rewards and JWT/Argon2 accounts. The test runner now executes files sequentially to reduce PostgreSQL WASM memory pressure on Windows.

## Upgrade from Part 4

Stop the development server. Run these commands in the **repository root**, where `client/`, `server/`, and the root `package.json` live. This patch targets the completed **Part 4 progression** implementation.

```powershell
git apply --ignore-space-change --check .\life-rpg-part-5-activity.patch
```

If the check succeeds:

```powershell
git apply --ignore-space-change .\life-rpg-part-5-activity.patch
npm run db:generate
npm run db:deploy
npm run verify
npm run dev
```

Part 5 adds no npm dependencies. Keep your existing `server/.env`, JWT secret, and Neon connection strings. The patch preserves `.env`, root `.gitignore`, and your lockfile. The additive activity-index migration preserves existing accounts, sessions, quests, and character progress. **Do not reset your database.**

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
```

Use the actual pooled and direct URLs copied from Neon, preserving any additional connection parameters. Never put database URLs or JWT secrets in `client/.env` or `VITE_*` variables. Keep the generated `JWT_SECRET` in `server/.env`.

```powershell
npm run db:deploy
npm run verify
npm run dev
```

Open **http://localhost:5173**. Sign in, or choose **Begin your adventure** to create an account and character. Open **Quest Journal** to save a quest. Mark it complete after doing the task, then open **Character** to see your XP, gold, attribute levels, and completion history. Open **Activity** to see your streak, explore a month, and select a day to revisit its completed quests. Refresh to confirm persistence. New characters start at level 1 with zero XP and gold.

The API runs on port 4000. `GET /health` checks the process; `GET /health/ready` checks database connectivity. Part 5 indexes the existing completion dates for activity and streak queries. `db:deploy` applies any pending committed migrations, including the new activity index, without resetting existing tables.

Without database configuration, the public preview works, but account forms return a clear unavailable message. If `DATABASE_URL` is set, a valid `JWT_SECRET` is required at startup.

## What is implemented

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

**Completion and progression are now implemented.** Easy/Medium/Hard quests award 25/60/120 XP and 5/12/24 gold. The chosen attribute earns the same XP. Character levels need 100 × current level to advance; attributes need 50 × current level. Archiving earns no rewards. Completed details are read-only; removing an entry keeps its reward history. Streaks count consecutive days with at least one completed quest. Shop purchases arrive in a later part. Shop items remain previews; journal ideas become real only after you save them. Email verification, password reset, and profile/password editing are not implemented.

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

For streak rules, activity API contracts, memory diagnostics and smoke tests, see [docs/PART_5.md](docs/PART_5.md). For progression rules, the completion transaction, API contracts, migration details, and smoke tests, see [docs/PART_4.md](docs/PART_4.md). Earlier journal details are in [docs/PART_3.md](docs/PART_3.md). Authentication design, deployment settings, and existing dependency audit findings remain in [docs/PART_2.md](docs/PART_2.md).

The 61 automated tests run locally against disposable PostgreSQL via PGlite and never use your Neon database. A successful verification run does not verify your live Neon connection; complete the create/complete/refresh smoke test after deployment.
