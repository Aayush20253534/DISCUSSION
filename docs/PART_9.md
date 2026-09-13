# Part 9 — Public website and account settings

Part 9 turns AtlasBorn from a private application with a guest preview into a complete website with a deliberate public entry point and production-grade account controls.

## Product goals

The public experience has two indexable routes:

- `/` — landing page explaining the AtlasBorn loop with accurate product previews and clear signup/login actions.
- `/how-it-works` — deeper explanation of quests, attributes, progression, streaks, gold, persistence, and server-authoritative rewards.

Authenticated application routes remain private. Express adds `X-Robots-Tag: noindex, nofollow, noarchive` to SPA responses for non-public routes, and the client also applies noindex metadata to authenticated/account pages.

## Public shell

Signed-out visitors no longer receive the authenticated sidebar shell. The public shell has a compact responsive navigation, signup/login actions, public footer, and dedicated mobile navigation treatment. Signed-in users still enter the Adventure Dashboard at `/`.

The landing-page product preview describes systems that actually exist in Parts 1–8 rather than advertising speculative features.

## Public metadata and crawlability

Part 9 adds:

- route-specific title and description metadata;
- canonical URLs;
- Open Graph and Twitter metadata;
- a bundled social preview SVG;
- `/robots.txt` (API/health paths are excluded; private pages remain crawlable only so their noindex response can be observed);
- `/sitemap.xml` containing only `/` and `/how-it-works`;
- `PUBLIC_APP_URL` for the canonical production origin;
- a small post-build prerender step for the two public routes.

The prerender step writes meaningful fallback HTML for the landing page and `how-it-works.html`. JavaScript still mounts the normal React application for interactive visitors.

`PUBLIC_APP_URL` is optional during local development. Before production deployment it should be the exact public origin, for example:

```dotenv
PUBLIC_APP_URL=https://atlasborn.example
```

Do not include a path or trailing slash.

## Profile settings

`PUT /api/v1/me/profile`

Accepted fields:

- `displayName`
- `timezone`

Both are validated through shared Zod contracts. Email is intentionally read-only in this part.

Changing the account timezone does **not** rewrite the immutable schedule timezone of an existing daily quest. That preserves Part 6's anti-duplicate-reward rule. The new timezone affects future account-local activity dates and display.

## Password change

`PUT /api/v1/me/password`

The client sends only:

- `currentPassword`
- `newPassword`

The endpoint:

1. requires a valid authenticated session;
2. requires signed CSRF and an allowed Origin;
3. rate-limits attempts;
4. verifies the existing Argon2id hash;
5. hashes the new password with the existing Argon2id policy;
6. updates the password in a transaction;
7. revokes every session except the current one.

The new password must satisfy the same 12–128 character account policy and must differ from the submitted current password.

## Session management

Part 9 adds an optional `user_agent` column to `sessions`. Existing sessions remain valid and simply show as an existing browser session until they are replaced by a new login.

New endpoints:

```text
GET    /api/v1/me/sessions
DELETE /api/v1/me/sessions/:sessionId
POST   /api/v1/me/sessions/revoke-others
```

The list response exposes only safe presentation fields:

- session ID;
- a coarse browser/platform label;
- created time;
- expiry time;
- whether it is the current session.

Refresh hashes and raw user agents are never returned.

Every revoke query is scoped by both session ID and authenticated user ID. A user cannot revoke or inspect another account's session.

Revoking the current session clears its cookies and signs the current browser out. Password changes keep the current browser signed in while invalidating other sessions.

## Local comfort preferences

Reduced/gentle-motion and celebration-sound preferences are device-local preferences only. They do not contain account or progression data.

- gentle motion remains opt-out and still respects the operating system's reduced-motion preference;
- celebration sound defaults to off and is stored for Part 10's reward/level-up interaction layer.

No primary application state is moved to localStorage.

## Migration

Part 9 adds:

```text
20260912000700_account_settings
```

It adds only session-management support:

```sql
sessions.user_agent VARCHAR(300) NULL
CREATE INDEX sessions_user_created_id_idx ON sessions(user_id, created_at, id)
```

There is no destructive rewrite, account reset, or session invalidation. Existing rows remain valid.

## Verification coverage

The Part 9 tests cover:

- profile validation and persistence;
- timezone updates without rewriting daily quest schedule timezone;
- incorrect-current-password rejection;
- Argon2id password replacement;
- automatic revocation of other sessions after password change;
- old-password login rejection and new-password login acceptance;
- safe session-list presentation;
- session ownership isolation;
- revoking another session;
- revoking the current session;
- revoke-others preserving the current session;
- CSRF/authentication enforcement;
- sitemap/robots public-route allowlisting;
- `X-Robots-Tag` protection on private SPA routes.

## Production smoke test

After deploying migration 007:

1. Open the site signed out and verify `/` and `/how-it-works` work on direct refresh.
2. Open `/robots.txt` and `/sitemap.xml`; confirm the production origin is correct.
3. Create/sign in to an account and open Settings.
4. Change display name and timezone, refresh, and confirm both persist.
5. Confirm an existing daily quest still displays its original schedule timezone.
6. Sign into a second browser/device.
7. Verify both sessions appear in Settings and revoke the second session.
8. Confirm the second browser can no longer access a protected endpoint.
9. Sign in again on the second browser, then change the password from the first browser.
10. Confirm the second session is revoked, the old password no longer works, and the new password does.
11. Check a direct request to `/settings` or `/quests` includes an `X-Robots-Tag` noindex header in production.
12. Run `npm run verify` before merging or deploying.
