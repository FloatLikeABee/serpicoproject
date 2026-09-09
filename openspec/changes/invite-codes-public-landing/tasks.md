## 1. Persistence and generators

- [x] 1.1 Add `users.password_hash` (ALTER IF missing) and `CREATE TABLE IF NOT EXISTS invites (id, code UNIQUE, user_id, username, password_plain, note, created_at)` in `database.go`; verify a Go test that a fresh `Initialize()` (or `createTables`) creates `invites` and the new column
- [x] 1.2 Add invite generators (32-byte hex code ≥32 chars, username `off`+Crockford not `serpico`, 16-char password); verify unit tests for length, uniqueness of two samples, and username ≠ `serpico`

## 2. Admin mint and list

- [x] 2.1 Implement `POST /admin/invites` (optional `note`) that inserts `users` (role police, bcrypt hash) + `invites` and returns code, username, password; verify a handler test: two creates differ, code length ≥32, username ≠ `serpico`, body has no admin-typed credentials
- [x] 2.2 Implement `GET /admin/invites` returning stored code/username/password (same as create); verify list after create matches, and `GET /auth/invites` (or `/invites`) is not a public list of secrets
- [x] 2.3 Wire both routes in `routes.go`; keep `GET /admin/users`; verify the create/list tests hit `/api/v1/admin/invites`

## 3. Redeem and login

- [x] 3.1 Implement `POST /auth/redeem` `{code}` → same `{username,password}` every time; unknown code does not insert a user; verify first redeem, second redeem identical, unknown code error and user count unchanged
- [x] 3.2 Rate-limit redeem per client IP (about 10 / 15 min, in-memory); verify a test that exceeding the limit rejects further attempts
- [x] 3.3 Change `handleLogin` to accept demo `serpico`/`cops123` **or** bcrypt of an invited `users.password_hash`; return that user’s id/name/role police (not `demo-serpico` for invited); verify tests: demo ok, invited ok, wrong password 401

## 4. Admin Users UI

- [x] 4.1 Add `adminAPI.createInvite` / `listInvites`; on Users (`DataViewer` users module) show Generate (optional note), list invites, copy code/username/password; verify an admin test that Generate calls create and a row shows the returned code (mock API)

## 5. Officer public pages

- [x] 5.1 Add EN+ZH catalog keys for landing and join (intro, request fields, redeem, errors) and a `buildInviteMailto` helper targeting `ge.gao.0039@gmail.com` with name + who + why; verify catalog ZH coverage and helper tests (complete vs missing fields, mailto contains the address and body text)
- [x] 5.2 Add public `Landing` at `/` (synth-grid/neon, short app intro, request form, links to `/join` and `/login`) and public `Join` at `/join` (code field, shows credentials + copy); authenticated `/` still Dashboard; verify tests: unauthenticated `/` is landing not login; `/join` is not redirected to login; incomplete request does not navigate to mailto; complete request uses the helper; Join shows username/password from mocked redeem twice the same
- [x] 5.3 Point `AuthContext.login` at `POST /auth/login` (`applyUser` from response); demo fallback only if the API is down **and** creds are the demo pair; verify AuthContext tests: invited success from mock API, bad password throws, demo still works

## 6. Checks

- [x] 6.1 Run backend invite/login tests and frontend landing/join/auth/admin Users tests and verify they pass
- [x] 6.2 Confirm no SMTP, no invite-request table, Google/Apple still mock, `/fleet/markers` and Chase Game untouched
