## Purpose

Gives hungry people a public one-page fridge-raid kitchen chat on its own URL, in English or Simplified Chinese, with short colorful suggestion cards and no entrance from the officer Serpico app.

## ADDED Requirements

### Requirement: Public dedicated route without officer login

The fridge-raid side app SHALL be reachable at the frontend path `/fridge-raid` without signing in. Opening that path MUST NOT redirect to `/login` or into the officer dashboard shell.

#### Scenario: Visitor opens the side app URL

- **WHEN** an unauthenticated visitor opens `/fridge-raid`
- **THEN** they see the fridge-raid kitchen page, not the login form and not the officer dashboard

#### Scenario: Officer login is not required

- **WHEN** a visitor uses the fridge-raid page without credentials
- **THEN** they can start the conversation (type, attach a fridge photo, or send a cooking plan) without being asked to sign in

### Requirement: No entrance from the officer Serpico app

The officer product shell MUST NOT advertise or link to the fridge-raid side app. Navigation, Login, the public landing, and Dashboard MUST NOT contain a fridge-raid link or nav item.

#### Scenario: Officer nav has no fridge-raid item

- **WHEN** an officer uses the signed-in app navigation
- **THEN** there is no control that navigates to `/fridge-raid`

#### Scenario: Public Serpico pages do not advertise it

- **WHEN** a visitor views Login or the public landing
- **THEN** those pages do not contain a link to `/fridge-raid`

### Requirement: Isolated kitchen visual, not officer chrome

The fridge-raid page SHALL use a warm, colorful seasonal kitchen look. It MUST NOT wrap the conversation in the officer synth-grid, scanlines, or bottom Navigation bar.

#### Scenario: Page is not the officer shell

- **WHEN** a visitor views `/fridge-raid`
- **THEN** the page does not show officer bottom navigation and does not use the officer app-shell chrome as its primary look

### Requirement: English and Simplified Chinese versions

The page SHALL offer English and Simplified Chinese. Chrome copy and assistant replies MUST follow the selected language. Traditional Chinese is out of scope.

#### Scenario: Toggle to Chinese

- **WHEN** a visitor selects Simplified Chinese
- **THEN** visible chrome (title, placeholders, buttons, opening ask) is in Simplified Chinese

#### Scenario: Toggle to English

- **WHEN** a visitor selects English
- **THEN** visible chrome is in English

### Requirement: Opening ask is a fridge raid

On a new session the assistant MUST open by asking the user to fridge-raid leftover food or what is already in the fridge, and MUST mention they can type it or send a photo. The opening MUST be short (not a long story).

#### Scenario: Fresh visit greeting

- **WHEN** a visitor opens `/fridge-raid` with no prior session on that device
- **THEN** they see a short assistant opening that asks them to raid the fridge by text or photo

### Requirement: Text, photo, and cooking-plan input

The user SHALL be able to answer with typed text, a photo of the inside of the fridge, a cooking plan (what they want to cook), or a combination in one send.

#### Scenario: Typed leftovers

- **WHEN** the user sends a text list of leftover ingredients
- **THEN** the page submits that text to the advisor and shows the returned suggestion cards

#### Scenario: Fridge photo

- **WHEN** the user attaches a photo of the inside of the fridge and sends
- **THEN** the page submits the image to the advisor and shows suggestion cards based on recognized food (or a short prompt to type what is in the photo if recognition fails)

#### Scenario: Cooking plan

- **WHEN** the user says what they plan to cook (with or without fridge contents)
- **THEN** the page submits that plan and shows suggestion cards that respect the plan

### Requirement: Short colorful card display, not long stories

Advisor replies MUST be shown as a small set of colorful suggestion cards with scannable chips, not as a long narrative. Each card’s visible body MUST stay short (headline plus at most two short sentences before any optional expand). TCM explanation beyond one line MUST be behind an expand control.

#### Scenario: Three scannable cards

- **WHEN** the advisor returns dish suggestions
- **THEN** the user sees at most four colorful cards, each with a dish name, a deliciousness hook of one short sentence, and chips for season or wellbeing — not a multi-paragraph essay as the primary view

#### Scenario: TCM detail is optional

- **WHEN** a user wants the TCM rationale
- **THEN** they can expand a short TCM note on a card; that note is hidden by default

### Requirement: Wellness disclaimer

The page SHALL show a short wellness disclaimer that this is culinary TCM-inspired advice, not medical diagnosis or treatment.

#### Scenario: Disclaimer visible

- **WHEN** a visitor views `/fridge-raid`
- **THEN** they see a short disclaimer that the suggestions are not medical advice
