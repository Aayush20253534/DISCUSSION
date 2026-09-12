# Production deployment

Life RPG is designed to deploy as one Node web service: Express serves the API and the built Vite application from the same HTTPS origin, while Neon provides PostgreSQL. Keeping browser and API traffic on one origin avoids cross-site cookie complexity and makes direct React Router refreshes predictable.

## Recommended topology

```text
Browser
  │ HTTPS
  ▼
Render web service
  ├─ Express API (/api/v1/*)
  ├─ health/readiness endpoints
  └─ Vite production assets + SPA fallback
           │
           ▼
      Neon PostgreSQL
```

The repository includes `render.yaml` for a Render Blueprint. The current Blueprint selects Render's Ohio region because the project's existing Neon endpoint is in AWS `us-east-2`; keeping application and database regions close matters more than placing the Node process close to the browser. If you create a different Neon project/region, change the Render region **before the first Blueprint sync** because Render service regions are not movable afterward. The deployment is compatible with the Free web-service plan, although a non-sleeping paid instance is safer during judging because it avoids cold-start delay.

## 1. Prepare Neon

Create or reuse the Neon project used during development and copy:

- `DATABASE_URL`: the pooled application connection string.
- `DIRECT_URL`: the direct/unpooled connection string used by the migration wrapper.

Keep `sslmode=require` and any connection parameters supplied by Neon. Never put either URL in the client environment or source control.

The shop catalog is already seeded by migration `20260912000600_reward_shop_inventory`. Production deployment should run the complete committed migration chain instead of manually inserting shop records.

## 2. Prepare the GitHub repository

Before creating the service:

```powershell
npm run verify
git status
git log --oneline --decorate -10
```

The submission repository must be public and must contain at least three real chronological commits. The provided GitHub Actions workflow runs the same verification gate on pushes and pull requests targeting `main`.

## 3. Deploy the Render Blueprint

Create a Render Blueprint from the repository's root `render.yaml` and select the `main` branch. During first sync, Render prompts for the three variables marked `sync: false`:

```text
DATABASE_URL   Neon's pooled URL
DIRECT_URL     Neon's direct URL
JWT_SECRET     A private high-entropy secret of at least 64 characters
```

Generate a fresh production JWT secret locally if you do not want to reuse the development secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

Do not commit the generated value.

The Blueprint runs:

```text
npm ci --workspaces --include-workspace-root --include=dev
npm run build
npm run db:deploy
npm start
```

The build happens before migrations. A broken client build therefore cannot migrate the production database. The committed migrations are additive and the migration command is idempotent.

`/health/ready` is configured as the service health check. A deployment is not healthy merely because Node started; Neon must also be reachable.

## 4. Render platform defaults

When `RENDER=true`, the server automatically uses `RENDER_EXTERNAL_URL` as `CLIENT_ORIGIN` and `PUBLIC_APP_URL` if you did not explicitly set them, and defaults `TRUST_PROXY_HOPS` to `1`. This lets the initial `onrender.com` deployment boot with secure cookies, correct CORS, canonical metadata, robots, and sitemap output without knowing the generated hostname in advance.

Render terminates public TLS and forwards traffic to the Node service. Production cookies remain `Secure`/HTTP-only, and private application routes continue to send `X-Robots-Tag: noindex`.

## 5. Custom domain

If you later attach a custom domain, explicitly set these two environment variables to the custom HTTPS origin and redeploy:

```dotenv
CLIENT_ORIGIN=https://your-domain.example
PUBLIC_APP_URL=https://your-domain.example
```

If you intentionally support both the custom domain and the Render hostname, `CLIENT_ORIGIN` may contain both comma-separated exact origins, but `PUBLIC_APP_URL` should be the single canonical public origin.

A rebuild matters because the public landing pages are prerendered with absolute canonical/Open Graph metadata at build time.

## 6. Safer paid-service migration mode

Render's dedicated pre-deploy command is the cleaner migration location on plans that support it. If using that feature, change the Blueprint to:

```yaml
buildCommand: npm ci --workspaces --include-workspace-root --include=dev && npm run build
preDeployCommand: npm run db:deploy
startCommand: npm start
```

Do not run migrations in both places.

## 7. Verify the live deployment

After the first successful deploy:

```powershell
npm run verify:live -- --url https://your-service.onrender.com
```

The live checker verifies:

- HTTPS, HSTS, CSP and request IDs.
- liveness and real database readiness.
- direct `/` and `/how-it-works` rendering.
- absolute canonical/Open Graph URLs matching the deployment.
- direct refresh of `/quests` with private-route `noindex` protection.
- API 404 behavior and `no-store` caching.
- robots/sitemap output.
- fingerprinted production asset existence and immutable caching.

Then manually complete the core persistence smoke test in a private/incognito browser:

1. Sign up and finish onboarding.
2. Create a Hard quest.
3. Complete it and observe the level-up/reward feedback.
4. Refresh the browser.
5. Sign out and sign back in.
6. Confirm XP, level, quest history, streak and gold persisted.
7. Open the same account in a second browser/device and verify the same server-backed state.

## 8. Deployment troubleshooting

### Build fails before deployment

Run `npm run verify` locally. Do not bypass a failing build by changing the Render command to `npm start`; production Express intentionally refuses to start without `client/dist/index.html`.

### Migration fails

Check `DIRECT_URL`, Neon availability, and the Render build logs. Do not run `prisma db push` against production and do not reset the database. Fix the configuration and rerun the committed migration chain.

### `/health` works but `/health/ready` fails

The process is alive but PostgreSQL is unavailable or misconfigured. Check `DATABASE_URL` and Neon status.

### Login loops or CSRF/origin failures

Check the exact public origin. Origins must use HTTPS in production and must not contain a trailing slash or path.

### Canonical URL still points at the Render hostname after adding a custom domain

Set `PUBLIC_APP_URL` to the custom domain and trigger a fresh build/deploy. The public HTML metadata is generated during the build.
