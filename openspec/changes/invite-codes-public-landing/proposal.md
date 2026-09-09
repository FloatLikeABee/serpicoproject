## Why

Officer login is still a single hardcoded demo account (`serpico` / `cops123`). There is no public face of the product and no way for Ge (admin) to admit real people one at a time. This change adds invite-gated officer accounts and a public landing so strangers can request access by email, then redeem a unique code for a reusable username and password.

## What Changes

- Admin (backstage Users) can generate invitation codes: long, cryptographically random, unique. Creating a code also generates one username/password pair for that invite. Admin can copy the code and the credentials to send by email (manual; no SMTP).
- A public officer-app page accepts an invitation code and reveals that invite’s username and password. One code maps to one credential set. Repeating the same code shows the same pair (lost-password recovery).
- Invited users can sign into the officer app with those credentials (`role: police`). The demo account stays. Google/Apple remain mock and do not become invite-gated.
- A public landing page (unauthenticated `/`) introduces Serpico in a simple futuristic synthwave/neon style and lets visitors request an invite by mailing `ge.gao.0039@gmail.com` with a required self-introduction.
- No in-app invite-request queue and no server-sent email. Ge decides offline, then creates a code and emails it himself.

## Capabilities

### New Capabilities

- `invitation-codes`: Admin creates unique long invite codes with generated credentials; the public redeem page shows the same pair for a given code; invited users can log into the officer app.
- `public-landing`: Unauthenticated visitors see a public landing that introduces the app and a mailto request form requiring a self-introduction to `ge.gao.0039@gmail.com`.

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs for officer login or admin Users).

## Impact

- Backend: SQLite `invites` (and password hash on `users`), `POST /admin/invites`, `GET /admin/invites`, public `POST /auth/redeem`, real `POST /auth/login` for demo + invited users. Persist on the existing Render disk (`DATA_DIR`).
- Officer frontend: public `/` landing, `/join` (or `/invite`) redeem, `/login` stays; `AuthContext.login` must call the backend instead of only checking the demo pair locally; `ProtectedRoute` must not steal `/` and `/join`.
- Admin frontend: Users module (`/data/users`) gains create/list/copy for invites and credentials.
- Invite rows store a recoverable display password so redeem can show it again; treat that table as a password file (admin-only list/create).
- Does not rename `/fleet/markers`, revive Chase Game, or change Action/Pursue search.
