# Life RPG — Part 2: accounts & character onboarding

A full-stack JavaScript project using React, Express, Node.js, Neon PostgreSQL, Prisma, and Motion for React. Application code uses `.js` and `.jsx` throughout.

Part 2 adds working signup, login, JWT sessions, Argon2id password hashing, logout, protected routes, and character onboarding to the Part 1 Evergreen interface. Accounts and characters are persisted in PostgreSQL. Signed-in pages show your own saved data; the public overview remains an explicitly labeled sample preview.

## Upgrade from Part 1

Run these commands in the **repository root**, where `client/`, `server/`, and the root `package.json` live. Stop the development server first. The patch targets the successfully applied **Part 1 Windows-fix** version (your commit `bd8cb0e`).

```powershell
git apply --ignore-space-change --check .\life-rpg-part-2-jwt-argon2.patch
git apply --ignore-space-change .\life-rpg-part-2-jwt-argon2.patch
npm install --workspaces --include-workspace-root --include=dev
npm run setup
npm run auth:configure
```

`auth:configure` creates `server/.env` if missing, generates a private random JWT secret, and preserves existing database settings and a valid existing secret. It never prints the secret. `setup` preserves your existing ignore rules. The patch does not replace `.env`, `.gitignore`, or your existing lockfile; `npm install` updates the root lockfile for the added dependencies. Commit that updated lockfile with Part 2. On a fresh clone with the updated lockfile, use `npm ci`.

If patch checking fails, stop and compare with the Part 1 baseline before applying. Use Node.js 24 LTS and npm 11; the supported Node range is in `package.json`. All setup commands belong at the root, not inside `client`.

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

Open **http://localhost:5173** and choose **Begin your adventure**. Signup leads to avatar/name/timezone onboarding, then your personal dashboard. New characters start at level 1, zero XP, zero gold, and five attributes with zero XP. Reloading or logging in again restores the saved character.

The API runs on port 4000. `GET /health` checks the process; `GET /health/ready` checks database connectivity. Part 2 reuses the four tables from Part 1, so no new schema migration is needed. `db:deploy` applies the original migration if it is still pending. Never reset your database to install this patch.

Without database configuration, the public preview works, but account forms return a clear unavailable message. If `DATABASE_URL` is set, a valid `JWT_SECRET` is required at startup.

## What is implemented

- Email normalization, shared Zod validation, field errors, password visibility, loading and retry states.
- Argon2id hashing with a unique salt per password; no plaintext password storage.
- HS256 JWT access tokens in HTTP-only cookies, rotating refresh tokens, and PostgreSQL-backed session revocation.
- Signed CSRF protection, exact-origin checks, login/signup rate limits, restricted cookie attributes, and safe API errors.
- Signup/login pages, protected account routes, safe return-to navigation, automatic session refresh, and cross-tab sign-out.
- Three avatar choices, display name and IANA timezone onboarding, with atomic creation of the character and its five attributes.
- Personal dashboard, character details, account preferences, sign-out, and sign-out across all devices.
- Responsive Evergreen visuals, local fonts/artwork, reduced-motion support, and accessible forms.
- Integration tests using Prisma against disposable PostgreSQL via PGlite. Tests never read or modify your Neon database.

Quest creation/completion is **Part 3**. XP/level rewards, streaks, and shop purchases arrive in later parts. Quest ideas and shop items remain clearly labeled previews. Email verification, password reset, and profile/password editing are not part of this patch.

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

- **`ECONNRESET`:** dependency installation did not finish. Restore network access, then retry the root `npm install --workspaces --include-workspace-root --include=dev` command before running setup. Do not install Prisma globally to hide an incomplete install.
- **`EPERM` / OneDrive locks:** stop running dev servers, close processes holding project files, and pause OneDrive syncing while installing. A local development folder outside OneDrive avoids recurring file locks.
- **`prisma` not recognized:** install all workspaces and development dependencies from the root, then retry `npm run setup`.
- **Origin errors:** open exactly `http://localhost:5173`, or include `http://127.0.0.1:5173` in the existing `CLIENT_ORIGIN` setting. Restart the API after changing `.env`.
- **Invalid `JWT_SECRET`:** run `npm run auth:configure`. If an existing value is too short, the script explains how to replace that value while preserving the rest of `.env`.
- **Database unavailable:** check both Neon URLs, run `npm run db:deploy`, and check `/health/ready`. A successful API health check alone does not mean database tables exist.

For endpoints, authentication design, deployment settings, and implementation boundaries, see [docs/PART_2.md](docs/PART_2.md).
