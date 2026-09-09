## Context

See `proposal.md`. Today officer `POST /auth/login` and `AuthContext.login` both hardcode `serpico` / `cops123`. Google/Apple logins are mock and mint a random id locally. Unauthenticated `/` is swallowed by `ProtectedRoute` and sent to `/login`. Admin Users (`admin-frontend` `/data/users`, `GET /admin/users`) is a read-only table of seeded SQLite `users` (no passwords). SQLite already lives on Render disk `DATA_DIR=/var/data`. Admin HTTP routes are not token-gated (same as today: the admin SPA holds `adminAuth` in `localStorage`). Existing neon/synth classes on `Login.tsx` (`synth-grid-bg`, `neon-text-cyan`, glow orbs) are the visual baseline for the landing.

Self-grill locks (not interviewed):

- Ge emails codes himself. Landing uses `mailto:` only. No SMTP, no request inbox.
- Credentials are generated at invite-create time, not typed by admin, and are shown on both admin and public redeem.
- Invite code is a secret as strong as the password; redeem is rate-limited.
- Invited users are `role: police`. Demo account remains. Google/Apple stay mock.
- Recoverable display password is stored with the invite so lost credentials are reproducible. Treat that row as a password file.

## Goals / Non-Goals

**Goals:**

- Persist invites and invited users on the existing SQLite disk.
- Make officer password login real (backend verifies demo **or** invited hash) and have the officer SPA call it.
- Public routes: `/` landing, `/join` redeem, `/login` unchanged path.
- Admin Users: create + list + copy, not a new admin app.

**Non-Goals:**

- SMTP, invite-request storage, or Ge deciding inside the app.
- Invite revoke, expiry, or password rotation (redeem is the recovery).
- Closing Google/Apple mock logins, or gating `/x-hard-data`.
- Token-auth on `/admin/*` (out of scope; same posture as hardware/users today).
- Civilian invite role, renaming `/fleet/markers`, reviving Chase Game.

## Decisions

### 1. `invites` table plus password hash on `users`

New table `invites`: `id`, `code` (unique), `user_id`, `username`, `password_plain` (display copy), `created_at`, optional `note`. On create: insert `users` row (`id` uuid, `email` = username, `name` derived from username, `role` police, `rank` Officer) with `password_hash` (bcrypt). Demo `serpico` keeps working via a special-case in login; do not require a hash for the seeded demo row.

- **Why:** Redeem must show the same password; login must not compare plaintext for invited users going forward except via the invite display column. One invite ↔ one user.
- **Alternative considered:** Hash-only, never store plaintext. Rejected; contradicts “lose credentials, same code shows the pair.”
- **Alternative considered:** Encrypt `password_plain` with an env key. Deferred; no key-management story on Render yet. Disk + admin-only list is the accepted tradeoff; document it.

Username: `off` + 10 lowercase Crockford chars (or similar), retry on `users.email` collision, never `serpico`. Password: 16 chars from a no-ambiguous charset. Code: 32 bytes `crypto/rand` hex (64 chars).

### 2. Public redeem `POST /auth/redeem`; admin `POST|GET /admin/invites`

`POST /auth/redeem` `{ "code": "..." }` → `{ username, password }` or 404-style invalid (do not leak whether rate-limited vs bad code beyond a generic failure after limit). In-memory per-IP limiter (e.g. 10 / 15 min); best-effort across Render instances.

`POST /admin/invites` optional `{ "note": "..." }` → full invite including plaintext. `GET /admin/invites` → list including plaintext. Keep `GET /admin/users` for the existing accounts table. Admin UI: Users page adds an Invites panel (generate, copy code / username / password).

- **Why:** Matches “admin creates, public redeems, one set, reproducible.”
- **Alternative considered:** Redeem creates the user lazily. Rejected; admin would not have credentials to send in the first email, and “admin create username password and show” happens at mint time.

### 3. Officer login goes through the backend

`handleLogin` accepts `email` (username) + `password`: demo pair **or** bcrypt compare against `users.password_hash`. Return that user’s id, email, name, role, rank (and nation if present). `AuthContext.login` calls `POST /auth/login` and `applyUser` from the response; keep local demo fallback only if the API is unreachable **and** credentials are the demo pair (so local `npm start` without API still works). Invited login with API down fails closed.

- **Why:** Frontend-only checks cannot admit invited users; today login never needs the API.
- **Alternative considered:** Frontend stores invited creds in `localStorage`. Rejected; not reproducible across devices without the code, which is the whole point of redeem.

### 4. Routing: public `/` and `/join`, protected dashboard

`App.tsx`: `/` → if authenticated then `Dashboard`, else `Landing`. `/join` → `Join` (redeem). `/login` unchanged. `/*` remains `ProtectedRoute` → `Dashboard`. Landing CTAs: Request access (mailto form), Enter code → `/join`, Sign in → `/login`. Join shows username/password with copy, plus a Sign in link.

Landing visual: reuse `synth-grid-bg`, scanlines, cyan/purple glow, `font-display` / mono labels; short sections (what it is, maps/desk/cases one-liners), not a long scroll manifesto. Request form: name, who you are, why you want access (min length ~40 chars), optional reply email in the body. `mailto:ge.gao.0039@gmail.com` with encoded subject `Serpico invitation request`.

i18n: EN+ZH catalog keys for landing/join like the rest of the officer app (`loadLastNation()`).

- **Why:** User asked for a public landing and a public code page; `ProtectedRoute` on `/*` would hide both.
- **Alternative considered:** Landing at `/welcome` and keep `/` as login. Rejected; “landing page open to public” is the first hit on the live URL.

## Risks / Trade-offs

- **[Plaintext passwords in SQLite]** → Mitigation: only `/admin/invites` and redeem-by-code return them; no public list; bcrypt still used for login. Document that a DB dump is a credential dump.
- **[Admin `/admin/invites` has no token]** → Mitigation: same as current `/admin/users`; do not advertise the admin origin. Out of scope to add admin JWT in this change.
- **[In-memory rate limit resets on deploy / varies per instance]** → Mitigation: codes are 256-bit; limiter is abuse friction, not the real defense.
- **[mailto blocked on some mobile browsers]** → Mitigation: also show the address and a copyable prefilled body so Ge still gets a self-intro if they paste into Gmail.
- **[Frontend used to ignore backend login]** → Mitigation: tests for AuthContext + handleLogin covering demo, invited, and bad password; demo fallback only for demo creds.

## Migration Plan

Additive tables/columns (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE users ADD COLUMN password_hash`). Existing seeded users without hashes cannot password-login except `serpico` special-case. Rollback: revert routes/UI; leftover `invites` rows are harmless. No data backfill.

## Open Questions

None that block apply. Optional `note` on create is included so Ge can label who a code was for; it is not required.
