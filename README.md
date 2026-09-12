# Life RPG — Part 1: the foundation

A JavaScript full-stack foundation for a Life RPG productivity app. Built against the supplied `0001.zip` (archive commit `0b2ae6b38983d8a09bd5e14b5cf786e0bea7ac3d`). All application source and configuration use `.js` or `.jsx`; no TypeScript compilation is required.

## What works in this part

- React + Vite interface, an original evergreen adventure theme, local fonts and vector artwork.
- Responsive overview, quest journal, character, marketplace, preferences, and 404 routes.
- Collapsible desktop sidebar, mobile bottom navigation, route focus management, skip link, keyboard-accessible dialogs, loading states, and an error boundary.
- Sample quest search, attribute filters, quest details, reward previews, and motion preferences.
- Motion for React with both operating-system reduced motion and an in-app motion preference.
- Express 5 API with exact-origin CORS, Helmet, bounded request bodies, request IDs, rate limiting, safe error responses, and graceful shutdown.
- Prisma 7.8 with the PostgreSQL adapter, Neon connection configuration, and an initial migration for users, sessions, characters, and attributes.
- Shared JavaScript validation and a public world configuration endpoint consumed by Preferences.
- Root npm workspaces, a single reproducible lockfile, formatting, linting, and automated foundation tests.

**This is a read-only world preview.** The sample level, XP, gold, quests, and items are explicitly labeled throughout the interface. They are not saved user records. Authentication is Part 2; quest CRUD is Part 3; real completion and progression are Part 4. No account, completion, or purchase endpoints are falsely advertised as implemented. The only `localStorage` entry is the display preference `life-rpg:gentle-motion`.

## Requirements

Use **Node.js 24 LTS** and npm 11. Node 22.12+ also satisfies the package engine declaration. Install dependencies from the repository root, not separately inside client and server. The patch replaces the two starter lockfiles with one root `package-lock.json`.

## Apply the patch

From the directory that contains `client/` and `server/`:

```powershell
git apply --ignore-space-change --check .\life-rpg-part-1-js-windows-fix.patch
git apply --ignore-space-change .\life-rpg-part-1-js-windows-fix.patch
npm install
npm run setup
```

The patch is based on the exact uploaded starter. If `git apply --check` fails, do not force it; compare your working tree with that starter first. The replacement patch accepts LF or CRLF starter files with `--ignore-space-change`. It leaves an existing root `.gitignore` in place. `npm run setup` appends missing foundation ignore rules without replacing existing content, then generates Prisma Client. The patch itself is ignored after setup. Do not combine the old and replacement patches.

## Run the foundation preview

The interface and public API run without database credentials in development. From the root:

```powershell
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:4000`.

If you get a port conflict, stop the conflicting process or set `PORT` in `server/.env`. When changing the API port, also change both proxy targets in `client/vite.config.js`. The Vite port is deliberately strict so the configured CORS origin does not silently drift.

## Connect Neon PostgreSQL

Create a Neon project and database, then copy its connection strings. Do not put them in frontend code or any `VITE_*` variable.

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

On macOS/Linux, use `cp` instead of `Copy-Item`. Edit `server/.env`:

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-ENDPOINT-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@YOUR-ENDPOINT.REGION.aws.neon.tech/DBNAME?sslmode=require
TRUST_PROXY_HOPS=0
```

Use the actual pooled and direct URLs copied from Neon, including any additional parameters Neon supplies. The values above are illustrative placeholders. Credentials with special characters must be URL encoded. Keep `.env` untracked.

Apply the included migration and restart the dev server:

```powershell
npm run db:deploy
npm run dev
```

Verify the real database connection:

```powershell
Invoke-RestMethod http://localhost:4000/health/ready
```

Expected result: `data.status = ready` and `data.database = connected`. In a browser, the same URL returns JSON. `/health` only checks the running API process; it deliberately does not claim the database is healthy.

`db:deploy` applies the committed migration without a shadow database. Use it for the initial Neon setup and production. `db:migrate -- --name your_change` is for developing later schema changes; Prisma may require permission to create a shadow database or a separately configured shadow database URL. It should not be used against production.

The checked-in migration adds database constraints preventing negative gold and XP, duplicate attribute entries, duplicate accounts, and orphaned character/session records. Future authentication must normalize email before insertion. Only token hashes belong in `sessions.token_hash`.

## Commands

| Command                                    | Purpose                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `npm run setup` | Preserve/complete ignore rules and generate Prisma Client |
| `npm run dev`                              | Start client and API together                                         |
| `npm run lint`                             | Check JavaScript and JSX                                              |
| `npm test`                                 | Run foundation API/configuration/contract tests                       |
| `npm run db:generate`                      | Generate the JavaScript Prisma client                                 |
| `npm run db:validate`                      | Validate the schema without a database connection                     |
| `npm run db:deploy`                        | Apply existing migrations using `DIRECT_URL`                          |
| `npm run db:migrate -- --name change_name` | Create/apply a development migration                                  |
| `npm run db:studio`                        | Inspect the database configured in `DIRECT_URL`                       |
| `npm run build`                            | Generate Prisma client and build React                                |
| `npm run start`                            | Start Express; set `NODE_ENV=production` to serve the built React app |
| `npm run verify`                           | Lint, tests, Prisma validation, and production build                  |
| `npm run format`                           | Format project files                                                  |
| `npm run format:check`                     | Check formatting                                                      |

## Structure

- `client/src/components/`: shared interface primitives, shell, artwork, error boundary.
- `client/src/pages/`: route-level screens loaded on demand.
- `client/src/data/preview.js`: clearly separated read-only sample fixtures.
- `client/src/lib/`: API client and display preference helpers.
- `client/src/index.css`: visual tokens, responsive styles, and motion rules; Tailwind is also configured.
- `server/src/app.js`: injectable Express app, public routes, security, and errors.
- `server/src/index.js`: process lifecycle and production startup checks.
- `server/src/config/`: validated configuration and explicit `server/.env` loading.
- `server/src/lib/`: database adapter and safe structured logger.
- `server/prisma/`: schema and committed SQL migrations.
- `shared/src/`: shared constants and Zod contracts used by both applications.

The Prisma schema uses the supported `prisma-client-js` generator to generate JavaScript, with Prisma's PostgreSQL driver adapter. The default TypeScript-emitting `prisma-client` generator is intentionally not used for this JavaScript project.

## Production foundation

The simplest topology is one Node service hosting Express and the built React files at the same origin, with Neon as the remote database. Express handles React deep links while keeping missing API routes as JSON 404 responses.

Build stage:

```sh
npm ci
npm run build
```

Release stage (with the real direct URL provided securely):

```sh
npm run db:deploy
```

Runtime environment:

```dotenv
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://your-domain.example
DATABASE_URL=YOUR_REAL_POOLED_NEON_URL
DIRECT_URL=YOUR_REAL_DIRECT_NEON_URL
TRUST_PROXY_HOPS=0
```

Then run `npm start`. Configure `TRUST_PROXY_HOPS=1` only if exactly one trusted reverse proxy fronts the application. Production requires HTTPS origins, a configured reachable database, and a built client; startup fails if these requirements are absent. The hosting provider normally terminates HTTPS before forwarding to Express.

Keep `VITE_API_BASE_URL` blank for this topology. Separate frontend hosting requires a deliberate CORS, CSP, and cookie configuration review when authentication is implemented. Vite's proxy operates during development only.

The public website/SEO phase and deployment submission are planned later. This foundation provides a title, description, theme color, local favicon, semantic HTML, and route titles; it is not the final public landing site.

## Verification and limits

Automated tests cover environment validation, secret-safe errors, liveness/readiness separation, database outage responses, CORS, malformed/oversized JSON, public contracts, production security headers, and SPA/API routing. A passing schema validation or build does **not** prove a Neon connection: use `/health/ready` with your real credentials.

No Neon credentials are bundled. No data is written during startup. No user or character fixtures are automatically inserted. The test suite injects a database probe for API tests and never contacts your production database.

## Next implementation parts

2. Authentication, session management, and character onboarding.
3. Persisted quest CRUD.
4. Transactional completion, reward calculation, and nonlinear leveling.
5. Real attribute progression and character equipment.
6. Recurrence, daily activity, and timezone-aware streaks.
7. Transactional purchases, inventory, and currency ledger.
8. Dashboard aggregates and activity history.
9. Public pages and complete account settings.
10. Event-driven interaction and animation polish.
11. End-to-end robustness and accessibility checks.
12. Deployment, public repository, and submission video.

Commit each substantive part as it is implemented. The problem statement requires at least three genuine chronological commits; do not manufacture a false history.

## Reference documentation

- [Motion for React](https://motion.dev/docs/react)
- [Prisma configuration](https://www.prisma.io/docs/orm/reference/prisma-config-reference)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Express documentation](https://expressjs.com/)
