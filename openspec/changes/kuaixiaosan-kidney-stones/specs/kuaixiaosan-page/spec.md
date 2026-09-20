# Spec Delta

## Purpose

Defines the unlisted 肾结石快消散 lounge: a Chinese-default phone page for kidney-stone knowledge, typical cases, recovery steps, real photographs, and a feeling-and-recovery chat, isolated from officer chrome and the other lounges.

## ADDED Requirements

### Requirement: Unlisted Chinese-default kidney-stone lounge

`/kuaixiaosan` MUST be a public route outside the officer `ProtectedRoute`. Officer Navigation, Login, landing, HomeGate, Fridge Raid, 拉了么, and 睡了么 MUST NOT link to it. The first visit MUST default to Simplified Chinese unless a stored 肾结石快消散 language or `?lang=` / `?nation=` override is present. The page MUST use an isolated stone/water skin (`html.kx-world` / `.kx-*`) and MUST NOT apply `ll-world`, `sm-world`, Fridge Raid kitchen classes, or luxury gold `#c6a56a`.

#### Scenario: Fresh visit is 肾结石快消散, not officer nav

- **WHEN** a visitor opens `/kuaixiaosan` with no stored language
- **THEN** the heading is 肾结石快消散, there is no officer `navigation`, `html` has class `kx-world` and not `ll-world` or `sm-world`, and `.fr-page` is absent

#### Scenario: English toggle does not become the default

- **WHEN** a first-time visitor has `navigator.language` of `en-US` and no stored 肾结石快消散 language
- **THEN** chrome is still Simplified Chinese until they tap EN

### Requirement: Nested chat path stays inside the lounge

Unauthenticated `GET /kuaixiaosan/chat` MUST mount the same 肾结石快消散 app (HTTP 200 static shell plus the public route) with the 聊 dock open, not officer login or dashboard. Tapping 聊 MUST set the location to `/kuaixiaosan/chat`. Tapping any other dock MUST set the location to `/kuaixiaosan`. The client MUST NOT add a GET handler on the chat API.

#### Scenario: Unauthenticated /kuaixiaosan/chat is in-app chat

- **WHEN** a visitor opens `/kuaixiaosan/chat` with no session
- **THEN** the heading is 肾结石快消散, a `textarea` is present, officer dashboard copy is absent, officer `navigation` is absent, and the path stays `/kuaixiaosan/chat`

#### Scenario: 聊 dock updates the path

- **WHEN** a visitor on `/kuaixiaosan` taps 聊, then taps 石
- **THEN** the path becomes `/kuaixiaosan/chat` with a `textarea`, then returns to `/kuaixiaosan` without leaving 肾结石快消散

### Requirement: Six knowledge docks, no arousal loops

`/kuaixiaosan` MUST offer exactly six dock tabs: stones (石), cases (例), recover (复), lore (典), imaging (影), and chat (聊 / Chat). It MUST NOT include a 拉榜-style hot feed, a sit-alert overlay, a timed companion bubble, or 睡了么 sound/wind-down docks. It MUST NOT use the Notification API, MUST NOT embed `<video>`, and MUST NOT leave `/kuaixiaosan` for Wikipedia via `<a href>`.

#### Scenario: Dock is six buttons including chat

- **WHEN** the lounge renders
- **THEN** there are six `.kx-dock` buttons including 聊, and the chat dock contains a `textarea`

#### Scenario: No sit-alert after five minutes

- **WHEN** the visitor stays on `/kuaixiaosan` for five minutes with the page visible
- **THEN** no dialog named 久坐警报 (or an English sit-alert equivalent) appears

### Requirement: Real-photo museums with sequential reveal

The stones, cases, recover, lore, and imaging docks MUST show catalog cards as soon as item JSON is available, including a reserved image box. Photographs MUST be local JPEGs of real subjects (specimens, anatomy, devices, clinical settings, still-life of water/diet) — not AI-generated stills and not geometric illustrations. At most the first two visible images MAY start loading immediately. Remaining images MUST receive `src` one after another after the previous image `load` or `error`. Tapping a card title MUST open a bottom sheet with a large local JPEG hero when `imageUrl` exists, chips or meta, and body copy. Sheets MUST NOT use `#c6a56a` and MUST NOT add `wikipedia.org` `<a>` tags. Identifiable patient faces MUST NOT appear.

#### Scenario: Cards appear before every photo finishes

- **WHEN** stones catalog JSON arrives with at least two items
- **THEN** two card titles are in the document before every card image has fired `load`, and each card has a reserved image box

#### Scenario: Stone sheet has a real local photo

- **WHEN** a visitor opens a stone title into the bottom sheet
- **THEN** the sheet shows a large local JPEG under `/kuaixiaosan/stones/`, `querySelector('video')` is null, and no `wikipedia.org` `<a>` is present

### Requirement: Knowledge, cases, and recovery are encyclopedia, not a clinic

Lore, cases, and recover copy MUST be sourced encyclopedia with a not-medical-advice disclaimer. Cases MUST be typical de-identified vignettes, not named real patients. Copy MUST NOT claim the visitor has a disease, MUST NOT contain `you have` or `你患有`, and MUST NOT prescribe named prescription doses. Wikipedia sources MUST open an in-lounge reader (button). Clinic hosts already allowed on 拉了么 医典 MAY remain as outbound `https` links. Red-flag encyclopedia lines (fever with pain, no urine, pregnancy, inability to keep fluids) MUST tell the visitor to seek emergency care without diagnosing.

#### Scenario: Lore sheet never diagnoses

- **WHEN** a visitor opens a lore card
- **THEN** the sheet includes the disclaimer, the body does not contain `you have` or `你患有`, and Wikipedia labels are buttons rather than `wikipedia.org` links

#### Scenario: Case sheet is a vignette, not a personal diagnosis

- **WHEN** a visitor opens a case card
- **THEN** the sheet describes a typical course in the third person, includes the disclaimer, and does not contain `you have` or `你患有`

### Requirement: Feeling-and-recovery chat

The chat dock MUST show a transcript and a `<textarea>` composer. The assistant MUST ask what the visitor feels when that information is missing (pain place, fever, urine change, after a procedure) and MUST answer with recovery steps (fluids, rest, straining urine, when to seek emergency care, post-procedure encyclopedia). Replies MUST NOT diagnose, MUST NOT contain `you have` or `你患有`, and MUST NOT prescribe doses. Off-topic asks (officer work, Fridge Raid, 拉了么, 睡了么) MUST steer back to kidney-stone recovery knowledge. The client MUST POST only to the 肾结石快消散 chat endpoint, never `/lalem/*` or `/shuileme/*`.

#### Scenario: Chat asks what they feel then gives recovery steps

- **WHEN** the visitor sends a short feeling line such as 腰好疼
- **THEN** the reply asks at least one clarifying feeling question or names a recovery step, and does not contain `you have` or `你患有`

#### Scenario: Off-topic is steered back to stones

- **WHEN** the visitor asks about officer work, Fridge Raid, or poop
- **THEN** the reply returns to kidney-stone knowledge or recovery instead of answering as Serpico, the kitchen, 拉了么, or 睡了么

### Requirement: Thinking indicator while chat is busy

While a 肾结石快消散 chat request is in flight, the transcript MUST show a thinking status with `role="status"` and the log MUST set `aria-busy="true"`. The indicator MUST NOT use 拉了么 cyan/lime pops `#7ee0ff` / `#c9f07a`, MUST NOT use 睡了么-only classes, and MUST NOT use luxury gold `#c6a56a`. When `prefers-reduced-motion: reduce`, the indicator MUST be static text. The status MUST disappear when the reply is appended.

#### Scenario: Busy chat shows a status

- **WHEN** the visitor sends a chat message and the reply has not arrived
- **THEN** a `role="status"` thinking row is visible, the transcript is `aria-busy="true"`, and the indicator computed style does not use `#7ee0ff`, `#c9f07a`, or `#c6a56a`

### Requirement: Session stop stays on the page

`/kuaixiaosan` MUST show a header control labeled 好了 (EN: I'm done) that freezes the 已看 timer without leaving the page. Activating it MUST NOT open officer Navigation, Fridge Raid, `/lalem`, or `/shuileme`. Chat MUST remain usable.

#### Scenario: 好了 freezes the clock in place

- **WHEN** a visitor taps 好了
- **THEN** the 已看 value no longer increases, the heading is still 肾结石快消散, and the location stays under `/kuaixiaosan`
