# Part 11 — robustness, accessibility, and production testing

Part 11 turns the feature-complete Life RPG core into a release candidate that can survive the failure modes most likely to appear during judging: retries, stale tabs, network loss, route crashes, production asset changes, cross-account requests, database persistence, keyboard use, and direct-link deployment behavior.

The guiding rule is that reliability must preserve the server-authoritative systems built in Parts 1–10. The client may improve feedback and recovery, but it never invents progression, retries writes silently, or falls back to local persistence.

## Release gate

`npm run verify` is now the release gate:

1. ESLint.
2. Static quality/accessibility architecture audit.
3. Full shared + API integration suite against disposable PostgreSQL-compatible PGlite.
4. Prisma schema validation.
5. Production Vite build and public prerender.
6. Production smoke test against the actual built `client/dist` served through Express.

A successful unit/integration suite is no longer enough if the production build cannot be served correctly.

## End-to-end production-like journey

`server/tests/journey.test.js` exercises one coherent account across the systems instead of testing features only in isolation:

1. sign up,
2. onboard a character,
3. create three hard quests,
4. complete them and earn real server rewards,
5. confirm dashboard/streak totals,
6. buy a cosmetic using earned gold,
7. equip the cosmetic,
8. confirm wallet history,
9. log out,
10. sign in through a fresh cookie jar,
11. verify XP, gold, history, inventory, equipment, and streak persistence,
12. safely replay a lost completion response without a second reward,
13. prove another account cannot read or complete the owner's quest.

The test uses the same migrations and Prisma client as the rest of the integration suite. It does not connect to the developer's Neon database.

## Safe client retry policy

Read queries retry at most once and only for failures that may actually recover:

- network failures,
- request timeouts,
- server `5xx` responses.

Validation, authentication, authorization, and other normal `4xx` responses are not retried.

Client mutations never retry automatically. Completion and purchase endpoints are server-idempotent, but an uncertain write should still be surfaced to the user rather than silently generating more network writes. A user retry is safe because the server returns the existing immutable completion or ownership record.

`ApiError` now preserves the server request ID and `Retry-After` value when available. That gives a production error enough correlation information for support/debugging without exposing internal server data.

## Network-loss behavior

A global status region announces offline and restored connectivity. It is intentionally non-blocking:

- existing server-backed data stays on screen,
- no fake local progression is created,
- new requests show the existing network error path,
- TanStack Query refetches stale reads after reconnection.

The status is an `aria-live` region so connectivity changes are not visual-only.

## Error boundaries and deployment races

There are now two layers of render recovery:

- the outer fatal boundary protects application bootstrap,
- a route-keyed boundary protects page rendering and resets automatically when the pathname changes.

If a lazy-loaded chunk disappears during a deployment or a page throws at render time, the user receives a recovery screen rather than a blank application. They can retry the screen, reload the newest deployment, or return to the overview.

Render-error logging deliberately records only the error name/message/component stack in the browser console. It does not serialize auth state, form values, cookies, or API payloads.

## Accessibility hardening

Part 11 preserves the Radix focus traps and Part 10 focus restoration while adding/rechecking:

- public and authenticated skip links,
- programmatically focusable `<main>` regions after route navigation,
- visible `:focus-visible` treatment for buttons, links, inputs, selects, textareas, and custom tabindex targets,
- Escape support for the mobile public navigation,
- `aria-controls` and `aria-expanded` on its menu trigger,
- live connectivity announcements,
- accessible render-failure alert text,
- minimum 44 px icon/menu targets on coarse pointers,
- reduced-motion CSS and Motion preferences.

The no-dependency quality audit also prevents accidental `dangerouslySetInnerHTML` usage and rejects primary application state being moved into `localStorage`. The only allowed local storage remains device-local motion/sound preferences.

### Manual keyboard/screen-reader release pass

Automated source checks cannot prove real assistive-technology behavior, so the final release pass must still cover:

1. Tab through signup, login, onboarding, dashboard, quest journal, marketplace, inventory, and settings.
2. Activate every primary action with Enter/Space.
3. Open and close every dialog using keyboard only; verify focus returns to the launching control.
4. Use skip links on public and authenticated shells.
5. Open the public mobile menu, close it with Escape, and confirm the trigger remains reachable.
6. Complete a quest and purchase/equip a reward with a screen reader; confirm live announcements do not duplicate visual notices.
7. Enable OS reduced motion and confirm state remains understandable with motion removed.
8. Disconnect networking during a read and a mutation; confirm the UI remains recoverable and no duplicate reward appears after retry.

## Structured server logging

HTTP logs now include only bounded operational fields:

- request ID,
- method,
- pathname (never query text),
- status,
- duration,
- response size when known.

Requests taking at least 1.5 seconds are emitted as `http.slow_request` events.

The logger recursively redacts keys that look like passwords, secrets, tokens, cookies, authorization data, and database URLs. Credential-bearing PostgreSQL/HTTP URLs and Bearer values are also scrubbed from free-form strings before JSON serialization.

This means adding richer structured logs later is less likely to turn a useful debugging tool into a credential-leak machine.

## HTTP process hardening

The production server now has explicit limits:

- 20 s request timeout,
- 10 s header timeout,
- 5 s keep-alive timeout,
- existing 15 s database/query timeout,
- existing 32 KiB JSON body limit,
- existing API rate limit.

SIGTERM/SIGINT still drain the HTTP server and close Prisma. Unhandled rejections and uncaught exceptions now enter the same bounded shutdown path instead of leaving a potentially corrupted process running.

## API caching and request correlation

All `/api` responses, including error and unknown-route responses, receive `Cache-Control: no-store`.

The server always generates its own UUID request ID. A client-supplied `X-Request-Id` is ignored, preventing external input from poisoning log correlation.

## Database production indexes

Migration `20260913000800_production_hardening` adds two indexes based on the current query shapes:

- `quests_user_status_recurrence_due_created_idx` accelerates account-scoped actionable-quest filtering/order used by the dashboard/journal.
- `quest_completions_user_occurrence_idx` accelerates account-scoped one-time/daily replay checks.

The migration is additive and does not rewrite progression or inventory data.

## Production asset strategy

Vite-fingerprinted `/assets/*` files are served with a one-year immutable cache. HTML is always served with `no-cache`, so a deployment can replace chunk references without trapping users on an old HTML shell.

Public prerender pages continue to be served directly. Private SPA routes receive the index fallback plus `X-Robots-Tag: noindex`.

## Production smoke test

`npm run test:production` starts the real Express application on an ephemeral local port using the actual built `client/dist` and verifies:

- liveness/readiness endpoints,
- request IDs and security headers,
- Home and How It Works prerenders,
- semantic public HTML (`lang`, viewport, description, main, h1),
- absence of development source references and placeholder canonical host,
- private-route SPA fallback and noindex header,
- JSON 404 behavior for missing API routes,
- missing asset 404 behavior,
- immutable caching of fingerprinted JS/CSS,
- every asset referenced from built HTML actually exists,
- conservative JS/CSS size budgets.

Current budgets are intentionally guardrails, not optimization targets:

- <= 450 kB raw per JavaScript chunk,
- <= 1.5 MB raw JavaScript across emitted chunks,
- <= 180 kB raw per stylesheet.

Part 12 can still optimize hosting/CDN compression, but a sudden dependency or bundling regression now fails verification before deployment.

## Migration and verification

Apply the migration normally; do not reset the database:

```bash
npm run db:generate
npm run db:deploy
npm run verify
```

After deployment, perform one signed-out and one signed-in smoke journey from a fresh browser profile before recording the submission video.
