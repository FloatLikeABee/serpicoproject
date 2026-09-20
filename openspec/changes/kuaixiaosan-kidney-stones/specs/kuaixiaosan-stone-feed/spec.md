# Spec Delta

## Purpose

Serves 肾结石快消散 with static bilingual catalogs of stones, cases, recovery, lore, and imaging plus an allowlisted wiki summary and a public feeling-and-recovery chat POST, without SQLite history.

## ADDED Requirements

### Requirement: Public stone, case, recover, lore, and imaging catalogs

`GET` of the public 肾结石快消散 catalog endpoints MUST return JSON arrays of items with bilingual titles/bodies, filter fields, a local (non-http) `imageUrl` under `/kuaixiaosan/`, optional wiki URLs, and credit. Unfiltered floors MUST be at least sixteen stones, twelve cases, twelve recover items, sixteen lore articles, and twelve imaging items. Each `imageUrl` MUST resolve to a unique local JPEG (JPEG SOI, distinct SHA-256). Filter query params MUST subset the list without 500s.

#### Scenario: Stones include real local images and filters

- **WHEN** a client requests stones with a composition or site query
- **THEN** every returned stone has a local `imageUrl` prefix `/kuaixiaosan/stones/` and matching filter fields, and there are at least sixteen stones in the unfiltered catalog

#### Scenario: Cases, recover, lore, and imaging meet floors

- **WHEN** a client requests cases, recover, lore, and imaging
- **THEN** the bodies include at least twelve cases, twelve recover items, sixteen lore articles, and twelve imaging items, each with a unique local JPEG path and no `://` in `imageUrl`

### Requirement: Catalog copy is sourced and non-diagnostic

Lore, cases, and recover bodies MUST NOT contain `you have` or `你患有` and MUST NOT prescribe named prescription drugs as treatment doses. Each of those items MUST include at least one source URL (Wikipedia and/or NHS / Mayo / MedlinePlus / NIDDK / Cleveland Clinic). Cases MUST be third-person typical vignettes without real names or identifiable patient photographs.

#### Scenario: Lore and recover hygiene

- **WHEN** a client requests lore and recover
- **THEN** every item has a sources list, no body contains `you have` or `你患有`, and recover copy includes at least one recovery-step sentence (fluids, rest, strain, or seek emergency care)

### Requirement: Allowlisted wiki summary

`GET` of the public 肾结石快消散 wiki endpoint MUST accept only `https://zh.wikipedia.org/wiki/…` or `https://en.wikipedia.org/wiki/…` URLs and MUST return title + extract JSON on success. Other hosts MUST be rejected. The response MUST NOT include HTML that the client would render as an outbound Wikipedia `<a>`.

#### Scenario: Allowlisted wiki returns extract

- **WHEN** a client requests a zh.wikipedia.org wiki URL the lounge already stores
- **THEN** the status is 200 and the body includes a non-empty title and extract

#### Scenario: Off-host wiki is rejected

- **WHEN** a client requests a wiki URL on a host other than zh or en wikipedia.org
- **THEN** the status is 4xx and no third-party host is fetched

### Requirement: Public feeling-and-recovery chat

`POST` of the public 肾结石快消散 chat endpoint MUST accept JSON `{ locale, message, history? }` and MUST return 200 JSON `{ reply }`. Live completion MAY be used; when it is missing or rejected, a canned locale-matched bank of at least eight recovery-flavored lines MUST be used. Replies MUST ask about feelings when the message is too thin, MUST include recovery-step language, MUST strip `you have` / `你患有`, and MUST NOT reuse 拉了么 funny poop canned strings or 睡了么 dry math lectures as the primary voice. Live calls MUST be rate-limited separately from 拉了么 and 睡了么 chat. The server MUST NOT persist the transcript.

#### Scenario: Chat POST returns a recovery reply

- **WHEN** a client POSTs `{ "locale": "cn", "message": "腰好疼" }`
- **THEN** the status is 200, `reply` is a non-empty string, and it does not contain `you have` or `你患有`

#### Scenario: Canned when the model is down

- **WHEN** a client POSTs a chat message and no live completer is configured
- **THEN** the status is 200 and `reply` is one of the canned recovery lines for that locale
