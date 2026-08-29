## Why

Officers who work in China need the whole product in Simplified Chinese, with maps and crime news that match that country—not a US-English desk with Olathe as the default. Nation must live on the **account** (Cases → Account), so language, default city, and news follow the logged-in user rather than the device.

## What Changes

- Add a **Nation** control on the Cases page **Account** section: United States (English) or China (Simplified Chinese).
- Persist nation **on the account** (same `userId` as demo/login). Switching users loads that user’s nation; it does not stay as a phone-only toggle.
- When nation is China: **all product chrome** (nav, buttons, empty states, modals, login-after-auth, Fleet, Pursue, Board, Chat, Cases, Investigation Helper) is Simplified Chinese; **Fleet/Pursue default map is Shanghai**; **Board / daily intel / web-search crime news** use China crime sources and Chinese copy.
- When nation is United States: keep today’s English UI, US city list (Olathe default), and US/world crime news.
- AI field replies (chat, map-tag briefs, Board copy the model generates) follow the account nation.
- User-typed notes, pin names, and case events are **not** auto-translated.

## Capabilities

### New Capabilities

- `account-nation`: Per-account nation (US vs China) set from Cases → Account, driving UI locale, default map city, and crime-news region.

### Modified Capabilities

- None (no existing specs under `openspec/specs/`).

## Impact

- Frontend: Cases Account UI, i18n string catalog, Auth/user payload, Fleet/Pursue city lists and defaults, API `userId` plus `nation` (or equivalent) on helper/intel/mysteries/chat.
- Backend: persist `nation` on `users`; mysteries RSS + daily intel Google News queries become region-specific (US vs CN); AI system prompts include reply language.
- Admin data-collection UI may stay English but must show or run a China intel lane.
- Demo account `serpico` stores nation like any other user.
