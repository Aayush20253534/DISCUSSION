# Life RPG

Life RPG is a full-stack productivity game that turns real-world tasks into quests. Completing a quest awards server-calculated XP, attribute XP and gold; progress builds character levels and streaks, while gold unlocks cosmetic frames, badges, titles and themes.

The project is built for real persistence rather than a frontend-only demo. Authentication, quest ownership, progression, daily recurrence, reward transactions, inventory and activity history are enforced by the Express/PostgreSQL backend.

## Product loop

```text
Create a quest
     ↓
Do the real-world task
     ↓
Complete the quest
     ↓
XP + Gold + Attribute XP
     ↓
Level / streak / character progression
     ↓
Spend Gold on cosmetics
     ↓
Return tomorrow
```

A Hard quest awards enough XP for a new character to cross the first level threshold, making the progression loop easy to demonstrate in the required walkthrough video.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, TanStack Query |
| UI / motion | Tailwind CSS, custom CSS, Radix Dialog, Motion for React, Lucide |
| Backend | Node.js, Express 5 |
| Validation | Zod shared between browser/server contracts |
| Database | PostgreSQL on Neon |
| ORM / migrations | Prisma 7 |
| Authentication | Argon2id passwords, JWT access cookies, rotating database-backed sessions, signed CSRF |
| Testing | Node test runner, Supertest, disposable PostgreSQL through PGlite |
| Deployment | Render web service + Neon PostgreSQL |
| CI | GitHub Actions |

## Core features

- Secure signup, login, logout, refresh-token rotation and multi-session management.
- Character onboarding with display name, avatar and IANA timezone.
- Owned quest CRUD with one-time and daily recurrence, filtering, sorting and bounded pagination.
- Server-authoritative Easy/Medium/Hard rewards: `25/60/120 XP`, `5/12/24 Gold`, and matching attribute XP.
- Nonlinear cumulative character and attribute leveling.
- Transactional quest completion with duplicate/replay protection and historical reward snapshots.
- Timezone-aware current/longest streaks, activity calendar and daily completion history.
- Daily quests that reward at most once per immutable scheduled local date.
- Adventure Dashboard with actionable quests, weekly activity, attributes and recent journey history.
- Database-backed Marketplace, Inventory, equipment slots and append-only gold ledger.
- Atomic purchases that cannot overspend the same balance across concurrent tabs.
- Editable profile/timezone, password changes and session revocation.
- Reduced-motion and optional celebration-sound preferences.
- Server-confirmed XP, level-up, purchase and equipment interaction feedback.
- Responsive keyboard-accessible UI, focus restoration, live regions, error boundaries and network-loss feedback.
- Public landing/How It Works pages with prerendered metadata, sitemap and robots output.
- Structured/redacted server logs, request IDs, cache policies, rate limits and production health checks.
- Production smoke tests, live deployment smoke tests and a final submission validator.

## Architecture

The production deployment is intentionally single-origin:

```text
                    ┌─────────────────────────┐
Browser ── HTTPS ──►│ Render Node web service │
                    │                         │
                    │ Express API             │
                    │ Vite production assets  │
                    │ React Router fallback   │
                    └───────────┬─────────────┘
                                │ PostgreSQL
                                ▼
                          Neon database
```

Only Express talks to PostgreSQL and calculates rewards. The browser never receives database credentials and never determines XP, gold, completion timestamps or ownership.

## Local setup

### Requirements

- Node.js 24 recommended (`.nvmrc` is included; project engines allow supported Node 22–26 releases).
- npm with workspace support.
- Neon/PostgreSQL connection strings for authenticated/database functionality.

Clone the repository and install all workspaces from the repository root:

```powershell
git clone <YOUR_PUBLIC_REPOSITORY_URL>
cd life-rpg
npm ci --workspaces --include-workspace-root --include=dev
```

Copy the server environment template:

```powershell
Copy-Item .\server\.env.example .\server\.env
```

Fill the Neon connection strings, then generate a private authentication secret:

```powershell
npm run auth:configure
npm run db:generate
npm run db:deploy
npm run verify
npm run dev
```

Open `http://localhost:5173`. Vite proxies API, health, robots and sitemap requests to Express on port `4000` during development.

## Environment

`server/.env.example` is the authoritative server template:

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
PUBLIC_APP_URL=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-POOLED-HOST/DBNAME?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@YOUR-DIRECT-HOST/DBNAME?sslmode=require
TRUST_PROXY_HOPS=0
JWT_SECRET=
ACCESS_TOKEN_MINUTES=15
SESSION_DAYS=7
EMAIL_OTP_MINUTES=10
EMAIL_OTP_RESEND_SECONDS=60
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_FROM_EMAIL=
MAILJET_FROM_NAME=Life RPG
```

`DATABASE_URL` is used by the running application. `DIRECT_URL` is used by the migration wrapper. `JWT_SECRET` must remain private and is required whenever database-backed authentication is enabled. Signup email verification uses Mailjet Send API v3.1; `MAILJET_FROM_EMAIL` must be a verified Mailjet sender.

The browser normally needs no environment variables because production uses same-origin API requests. `client/.env.example` exists only for the optional `VITE_API_BASE_URL` override.

Never commit `server/.env`, database URLs or JWT secrets.

## Database and progression

Committed Prisma migrations create all account, quest, progression, recurrence, activity, marketplace, inventory, equipment, wallet and performance structures. The shop catalog is seeded by the committed reward-shop migration, so production does not need a separate manual seed command.

Important progression guarantees include:

- reward amounts are selected only on the server;
- one-time quests cannot reward twice;
- daily quests cannot reward twice for one scheduled day;
- completion rewards, XP, attributes, gold and history are one transaction;
- purchases lock the wallet and grant ownership atomically;
- deleting a journal entry does not erase immutable completion history;
- primary state lives in PostgreSQL, not localStorage.

Tests use disposable PostgreSQL instances and do not modify the configured Neon database.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Express and Vite together |
| `npm run build` | Generate Prisma Client and build/prerender the production React app |
| `npm start` | Start Express; in production it also serves `client/dist` |
| `npm run verify` | Lint, source audit, tests, Prisma validation, production build and local production smoke test |
| `npm run verify:live -- --url https://...` | Smoke-test the real deployed HTTPS service and database |
| `npm run submission:check -- --config submission.json` | Validate final repo/live/video submission package |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:deploy` | Apply committed migrations through `DIRECT_URL` |
| `npm run db:migrate` | Create/apply development migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run auth:configure` | Generate/preserve the local JWT signing secret |
| `npm run quality:audit` | Enforce source-level accessibility/persistence guardrails |
| `npm run test:production` | Serve the actual built client through production Express and smoke-test it |
| `npm run format` | Format repository source with Prettier |

## Verification

Before every release:

```powershell
npm run verify
```

The gate covers authentication/session behavior, account isolation, malformed input, quest CRUD, progression thresholds, concurrent completions, streak/date boundaries, daily recurrence, marketplace overspending, inventory/equipment ownership, dashboard consistency, full persisted user journey, accessibility/source guardrails, Prisma validation, production build integrity, security headers, direct SPA routes and bundle budgets.

GitHub Actions runs the same verification on pushes and pull requests targeting `main`.

## Deployment

The repository contains a Render Blueprint at `render.yaml`. The recommended production target is one Render Node web service connected to Neon.

For a first deployment:

1. Push the finished repository to public GitHub on `main`.
2. Create a Render Blueprint from `render.yaml`.
3. Supply `DATABASE_URL`, `DIRECT_URL`, a private 64+ character `JWT_SECRET`, and the Mailjet API/sender values when Render prompts for secrets.
4. Let the Blueprint install dependencies, build the Vite app, apply committed migrations and start Express.
5. Wait for `/health/ready` to become healthy.
6. Run the live verification command:

```powershell
npm run verify:live -- --url https://your-service.onrender.com
```

On Render, `RENDER_EXTERNAL_URL` automatically becomes the public/canonical origin unless you explicitly set `CLIENT_ORIGIN` and `PUBLIC_APP_URL`. This avoids hardcoding a hostname that does not exist until the service is created.

For custom domains, migration strategy, cold-start considerations and troubleshooting, read [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Submission

The required package consists of:

- a **public GitHub repository** with complete frontend/backend source and at least three chronological commits;
- a **working public HTTPS URL**;
- a **90–180 second public walkthrough video under 100 MB** showing signup/login, quest creation/completion, level-up and persistence after refresh.

Copy the example metadata file after the deployment/video exist:

```powershell
Copy-Item .\submission.example.json .\submission.json
```

Replace the placeholders with the real URLs, measured video duration and measured file size, commit all release source changes, then run:

```powershell
npm run submission:check -- --config submission.json
```

The checker verifies the clean `main` branch, commit count, public repository reachability, live app/database health, direct routing/SEO/security behavior, public video reachability, duration range and declared size limit.

Use [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) for a roughly two-minute recording plan and [`docs/SUBMISSION.md`](docs/SUBMISSION.md) for the final judge-perspective checklist.

## Project structure

```text
.
├─ client/                 React/Vite application
│  ├─ public/              favicon + social card
│  ├─ scripts/             public-page prerendering
│  └─ src/                 routes, components, queries, interactions
├─ server/
│  ├─ prisma/              schema + chronological migrations
│  ├─ scripts/             migration + production smoke tooling
│  ├─ src/                 Express/auth/game/economy implementation
│  └─ tests/               integration and robustness tests
├─ shared/                 shared Zod/game contracts + tests
├─ scripts/                repo quality, live and submission checks
├─ docs/                   engineering/deployment/submission runbooks
├─ .github/workflows/      CI verification
└─ render.yaml             production Blueprint
```

## Production notes

- `GET /health` checks process liveness.
- `GET /health/ready` verifies the live database connection.
- Fingerprinted `/assets/*` responses are immutable-cacheable; HTML remains revalidated.
- `/api/*` responses are `no-store`.
- Private SPA routes receive `X-Robots-Tag: noindex`.
- Public pages are prerendered with absolute canonical/Open Graph URLs at build time.
- The server shuts down gracefully on `SIGTERM`/`SIGINT` and fails closed on fatal process errors.
- Request logs redact credential-like fields and credential-bearing URLs.

## Engineering history

The implementation was built incrementally and the detailed design notes for each phase remain in `docs/PART_2.md` through `docs/PART_12.md`. Those documents describe authentication, quest consistency, progression transactions, streak semantics, recurrence/timezones, economy locking, dashboard snapshots, account settings/SEO, interaction feedback, production hardening and release packaging.
