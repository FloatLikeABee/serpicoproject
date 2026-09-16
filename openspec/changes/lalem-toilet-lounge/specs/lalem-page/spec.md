## Purpose

Gives people a public one-page 拉了么 loo lounge on its own URL, Chinese by default, with a fun isolated skin, a world toilet museum first, then hot entertainment/fashion and a few useful bathroom notes, and no entrance from the officer Serpico app.

## ADDED Requirements

### Requirement: Public dedicated route without officer login

The 拉了么 side app SHALL be reachable at the frontend path `/lalem` without signing in. Opening that path MUST NOT redirect to `/login` or into the officer dashboard shell.

#### Scenario: Visitor opens the side app URL

- **WHEN** an unauthenticated visitor opens `/lalem`
- **THEN** they see the 拉了么 lounge page, not the login form and not the officer dashboard

#### Scenario: Officer login is not required

- **WHEN** a visitor uses 拉了么 without credentials
- **THEN** they can browse toilets, 热榜, and 有用 without being asked to sign in

### Requirement: No entrance from the officer Serpico app

The officer product shell MUST NOT advertise or link to 拉了么. Navigation, Login, the public landing, and Dashboard MUST NOT contain a 拉了么 or `/lalem` link or nav item.

#### Scenario: Officer nav has no 拉了么 item

- **WHEN** an officer uses the signed-in app navigation
- **THEN** there is no control that navigates to `/lalem`

#### Scenario: Public Serpico pages do not advertise it

- **WHEN** a visitor views Login or the public landing
- **THEN** those pages do not contain a link to `/lalem`

### Requirement: Isolated fun loo visual, not officer chrome

The 拉了么 page SHALL use a colorful, comic loo-lounge look built for one-thumb bathroom use. It MUST NOT wrap the experience in the officer synth-grid, scanlines, or bottom Navigation bar.

#### Scenario: Page is not the officer shell

- **WHEN** a visitor views `/lalem`
- **THEN** the page does not show officer bottom navigation and does not use the officer app-shell chrome as its primary look

### Requirement: Simplified Chinese is the default language

On a first visit with no saved 拉了么 language, the page MUST open in Simplified Chinese (title 拉了么, Chinese chrome). English MUST be available as an explicit toggle. Traditional Chinese remains out of scope. First-run MUST NOT prefer English just because the browser is `en`.

#### Scenario: Fresh visit is Chinese

- **WHEN** a visitor opens `/lalem` with no prior 拉了么 language saved
- **THEN** visible chrome (title, tabs, filters, empty copy) is in Simplified Chinese

#### Scenario: Toggle to English

- **WHEN** a visitor selects English
- **THEN** visible chrome is in English and that choice is remembered for later visits on that device

### Requirement: Home is the world toilet museum

The first screen MUST be a gallery of toilets from around the world and from history. The visitor MUST be able to filter by shape, size, and class. Era/history chips MUST also be available so historical toilets are first-class, not hidden. Every toilet card MUST display an image. Tapping a card MUST open a short fun sheet (name, place/era, one-paragraph story) without leaving `/lalem`.

#### Scenario: Fresh visit shows toilets with pictures

- **WHEN** a visitor opens `/lalem` with no prior session
- **THEN** they see a toilet gallery with images, not a blank chat composer and not the officer dashboard

#### Scenario: Filter by shape size and class

- **WHEN** a visitor picks a shape, a size, and/or a class chip
- **THEN** the gallery shows matching toilets only, each still with an image

#### Scenario: History toilets are in the same museum

- **WHEN** a visitor filters by a historical era chip
- **THEN** they see toilets from that period with images and a short history blurb on open

### Requirement: 热榜 is entertainment and fashion with images and hot videos

The lounge MUST offer a 热榜 surface whose primary cards are entertainment and fashion. Every trend card MUST show an image. The surface MUST include playable hot videos (not image-only placeholders pretending to be video). Other topics MAY appear as a minority of cards.

#### Scenario: Visitor opens 热榜

- **WHEN** a visitor opens the 热榜 tab
- **THEN** they see image cards concentrated on entertainment and fashion, plus at least one playable hot video

#### Scenario: Video actually plays

- **WHEN** a visitor taps a hot video
- **THEN** a video plays in the lounge (muted by default, with a visible unmute/play control) without navigating to the officer app

### Requirement: 有用 is short bathroom-useful notes, not medical practice

The lounge MUST offer an 有用 surface with short practical notes (hygiene, etiquette, don’t strain, sitting-too-long nudge). It MUST show a short not-medical-advice line. It MUST NOT diagnose disease, read stool as a clinic, or prescribe treatment.

#### Scenario: Useful notes are visible

- **WHEN** a visitor opens 有用
- **THEN** they see short useful bathroom notes and a not-medical-advice disclaimer, not a diagnostic questionnaire

### Requirement: Super-fun bathroom UX

The page MUST feel like a joke-with-heart product: playful Chinese copy, a visible silly sit-session timer, large tap targets, and a fun bottom dock for 马桶 / 热榜 / 有用 that is not officer Navigation. It MUST NOT show user-uploaded feces photos.

#### Scenario: Timer and dock

- **WHEN** a visitor stays on `/lalem`
- **THEN** they see a playful sitting timer and can switch 马桶, 热榜, and 有用 from a lounge dock without officer nav
