# Part 2 implementation notes

## Request flow

1. The browser requests `/api/v1/auth/csrf`. The API returns a signed CSRF token and sets its matching HTTP-only cookie.
2. Signup/login send JSON with `X-CSRF-Token`. Express checks the exact Origin, signed CSRF token, validation, and rate limits. Password work uses Argon2id.
3. The API writes a session to PostgreSQL and sets HTTP-only access and refresh cookies. Tokens are never returned in JSON or placed in browser storage.
4. Protected requests verify the JWT signature, algorithm, issuer, audience, type, expiry, and matching live database session. Authentication never trusts a client-supplied user ID.
5. When access expires, the client performs one shared refresh request, then retries the protected request. Refresh/login/logout use Web Locks across tabs when supported, with an in-tab fallback.
6. Logout deletes the backing session, then clears the browser cookies. Logout-all deletes every session belonging to the authenticated user. Previously copied access JWTs are then rejected by the API.

## API contract

Successful responses use `{ "data": ... }`. Errors use `{ "error": { "code", "message", "fields"?, "requestId" } }`. All account responses have `Cache-Control: no-store`.

| Method | Endpoint                  | Input / behavior                                                                        |
| ------ | ------------------------- | --------------------------------------------------------------------------------------- |
| GET    | `/api/v1/world`           | Public stage, account configuration flag, attributes; no user data                      |
| GET    | `/api/v1/auth/csrf`       | Issues or reuses signed CSRF token                                                      |
| POST   | `/api/v1/auth/signup`     | `{ email, password, displayName }`; stores pending signup and sends a 6-digit email OTP |
| POST   | `/api/v1/auth/verify-email` | `{ verificationId, otp }`; verifies email, then creates the user/session                |
| POST   | `/api/v1/auth/resend-verification` | `{ verificationId }`; rotates and re-sends the pending OTP after cooldown       |
| POST   | `/api/v1/auth/login`      | `{ email, password }`; verifies password, creates session, returns public user          |
| GET    | `/api/v1/auth/me`         | Current public user and character; `{ user: null }` for a browser with no auth cookies  |
| POST   | `/api/v1/auth/refresh`    | `{}`; rotates refresh token and sets new access JWT                                     |
| POST   | `/api/v1/auth/logout`     | `{}`; revokes current session, including via refresh when access has expired            |
| POST   | `/api/v1/auth/logout-all` | `{}`; requires authentication, revokes every session for that user                      |
| GET    | `/api/v1/me/character`    | Requires authentication; returns only the caller's character                            |
| PUT    | `/api/v1/me/onboarding`   | `{ displayName, avatarKey, timezone }`; creates initial character/attributes atomically |

Every mutation requires JSON, a configured Origin, and the signed CSRF token. Identity and ownership come from the verified JWT and session, never from request body/query parameters. The public user contains only `id`, `email`, `displayName`, `timezone`, `createdAt`, and the public character fields.

## Security choices

- Passwords: Argon2id, 64 MiB memory, three iterations, parallelism one, independently generated salts. Signup accepts 12–128 characters without trimming the password or forcing arbitrary symbol rules. At most two password operations run simultaneously per process; excess work receives a retryable 503.
- Unknown-email login performs a real verification against a precomputed hash of discarded random bytes. Wrong-email and wrong-password responses have the same message and code. Signup reports an existing email with a 409 to offer a useful sign-in path; it is not an account-enumeration-resistant registration system.
- Access: HS256 JWT with fixed issuer/audience and an explicit algorithm allowlist, 15-minute default lifetime. It contains user/session IDs and token type, without email or profile details.
- Refresh: 256-bit random opaque secret prefixed by session UUID. PostgreSQL stores its SHA-256 hash. Rotation uses a conditional database update, so only one request can redeem a token. Old refresh values are rejected; a losing concurrent update does not clear the winning browser's cookies.
- Sessions: seven-day absolute lifetime by default. Refresh does not extend that deadline. Expired rows cannot authorize requests and are pruned on that user's next login. A scheduled global cleanup can be added when operating at scale.
- Cookies: HTTP-only, SameSite=Lax, path `/`, no Domain. Production adds Secure and the `__Host-` prefix. CSRF uses a signed double-submit token plus exact Origin and JSON checks, including on login and signup.
- Email verification: pending signups store only an HMAC of the six-digit OTP. Codes expire after 10 minutes by default, resend has a 60-second cooldown, and five incorrect OTPs invalidate the pending signup.
- Rate limits: 120 API requests/minute/IP, five signup attempts/15 minutes/IP, bounded OTP verify/resend routes, ten failed login attempts/15 minutes/IP, and 60 refreshes/15 minutes/IP. Stores are in memory per process; use a shared store and additional account/edge abuse controls for a multi-instance public deployment.
- Secrets: generate at least 64 random characters with `npm run auth:configure`. No fallback signing key exists. The script preserves `.env` settings and never logs secrets. If rotating the key to revoke every existing login, also delete/revoke database sessions; a valid stored refresh token can otherwise establish a JWT under the new key.

References: [node-argon2](https://github.com/ranisalt/node-argon2), [node-jsonwebtoken](https://github.com/auth0/node-jsonwebtoken), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Persistence and onboarding

The migration wrapper now resolves the explicit Prisma CLI entry, fixing the package-root resolution error in Part 1. The `db:deploy` command was checked against both an empty PostgreSQL database and the same database with the foundation migration already applied.

Part 1 already provides `users`, `sessions`, `characters`, and `character_attributes`, with unique email/user-character constraints and nonnegative XP/gold checks. This implementation uses that schema without destructive changes or a new migration.

A new user initially has no character. The UI sends them to onboarding until a character exists. Onboarding creates the character and all five attribute rows and updates name/timezone in one Prisma transaction. Repeating onboarding returns the existing character without resetting progress. Unique constraints handle concurrent creation attempts. Avatars are `wanderer`, `scholar`, and `guardian`; all start equally at zero XP/gold. Level 1 is the starting presentation until the later progression engine defines leveling.

The authenticated overview displays actual stored XP/gold. It does not borrow the guest preview's sample streak, completed quests, gold, or attribute levels. Character and preferences pages read the current user's saved record. Query caches are cleared when the account changes; cross-tab messages contain no credentials.

## Deployment

Build with development dependencies installed: `npm run verify`. Set `NODE_ENV=production`, a private `JWT_SECRET`, real `DATABASE_URL`/`DIRECT_URL`, and the exact HTTPS website origin in `CLIENT_ORIGIN`; apply `npm run db:deploy`, then run `npm start`.

Serve the built frontend and `/api` from the same HTTPS origin through Express or a reverse proxy. Keep `VITE_API_BASE_URL` blank for this setup. The cookie settings deliberately do not support a frontend and API on unrelated sites; proxy `/api` under the website origin instead. Development uses Vite's proxy. If hosting behind a trusted proxy, configure `TRUST_PROXY_HOPS` for the actual topology so IP rate limits receive the correct address.

Email ownership is verified before account creation through Mailjet OTP delivery. Forgotten-password recovery is still not implemented. Configure a verified Mailjet sender before treating signup as production-ready.

## Dependency audit

The dependency audit reports seven advisory entries in the existing Prisma 7.8 toolchain, involving `deepmerge-ts`, `@hono/node-server`, `valibot`, and `mysql2` and their parent packages. Those packages belong to Prisma configuration/development tooling; this application's authentication request path uses Express, Argon2, JWT, and PostgreSQL. The audit findings are still outstanding. Review the Prisma toolchain update separately before public deployment, and keep Prisma development services private. A successful test/build run is not a claim that the entire dependency tree is free of advisories.

## Verification

`npm run verify` runs ESLint, Node tests, Prisma schema validation, and a production build. Integration tests execute the committed PostgreSQL migration through PGlite, then exercise the real Express routes, Prisma models, pg adapter, Argon2 hashing, and JWT verification. They use an ephemeral local TCP port, require no external database service, and never use your Neon credentials. PGlite's single underlying connection does not replace testing deployment-specific TLS, pooling, networking, or true multi-connection contention on Neon.

Covered behaviors include normalization and password hashing, public response filtering, strict validation, CSRF/origin enforcement, production cookie flags, duplicate email, saved onboarding, ownership isolation, refresh rotation/replay/concurrent redemption, JWT expiry/claims/algorithm rejection, session expiry, current/all-device revocation, and failed-login limiting.

Desktop and mobile browser checks cover signup → onboarding → character, session restoration, expired-access refresh, wrong-password errors, settings, cross-tab logout, field labels, and layout down to 320px. Connect your real Neon database and complete a signup/onboarding/login smoke test after applying the patch.

## Next implementation part

Part 3 should add authenticated quest CRUD: schema/migrations for owned quests, validated Express endpoints, quest creation/editing/deletion, filters and empty states, and React Query cache updates. Quest completion, reward accounting, level rules, streak time boundaries, and shop transactions should follow their planned parts rather than silently award sample progress here.
