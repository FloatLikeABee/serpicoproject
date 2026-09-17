# Spec Delta

## Purpose

Defines the unlisted 睡了么 bedtime lounge: a dim, Chinese-default phone page for beds, bedrooms, sleep lore, soundscapes, and a wind-down visual, isolated from officer chrome and 拉了么.

## ADDED Requirements

### Requirement: Unlisted Chinese-default bedtime lounge

`/shuileme` MUST be a public route outside the officer `ProtectedRoute`. Officer Navigation, Login, landing, HomeGate, Fridge Raid, and 拉了么 MUST NOT link to it. The first visit MUST default to Simplified Chinese unless a stored 睡了么 language or `?lang=` / `?nation=` override is present. The page MUST use an isolated night skin (`html.sm-world` / `.sm-*`) and MUST NOT apply `ll-world`, Fridge Raid kitchen classes, or luxury gold `#c6a56a`.

#### Scenario: Fresh visit is 睡了么, not officer nav

- **WHEN** a visitor opens `/shuileme` with no stored language
- **THEN** the heading is 睡了么, there is no officer `navigation`, `html` has class `sm-world` and not `ll-world`, and `.fr-page` is absent

#### Scenario: English toggle does not become the default

- **WHEN** a first-time visitor has `navigator.language` of `en-US` and no stored 睡了么 language
- **THEN** chrome is still Simplified Chinese until they tap EN

### Requirement: Five bedtime docks, no arousal loops

`/shuileme` MUST offer exactly five dock tabs: beds (床), bedrooms (卧), sleep lore (典), sound (声), and wind-down (息). It MUST NOT include a typed chat composer, a 拉榜-style hot feed, a sit-alert overlay, or a timed companion bubble. It MUST NOT use the Notification API, MUST NOT embed `<video>`, and MUST NOT leave `/shuileme` for Wikipedia via `<a href>`.

#### Scenario: Dock is five buttons

- **WHEN** the lounge renders
- **THEN** there are five `.sm-dock` buttons and no `textarea` chat composer

#### Scenario: No sit-alert after five minutes

- **WHEN** the visitor stays on `/shuileme` for five minutes with the page visible
- **THEN** no dialog named 久坐警报 (or an English sit-alert equivalent) appears

### Requirement: Beds and bedrooms museum

The beds dock MUST show illustrated beds filterable by size, fill, and era, each with a local image. The bedrooms dock MUST show illustrated rooms filterable by light and layout, each with a local image. Tapping a card title MUST open a bottom sheet with a large hero photo when `imageUrl` exists, colorful-but-dim chips, and body copy. Sheets MUST NOT use `#c6a56a` and MUST NOT add `wikipedia.org` `<a>` tags.

#### Scenario: Bed card opens a photo-rich sheet

- **WHEN** a visitor opens a bed title into the bottom sheet
- **THEN** the sheet shows a large local JPEG, chips or meta, and the blurb, and `querySelector('video')` is null

#### Scenario: Bedroom filters hide non-matches

- **WHEN** a visitor taps a light filter that does not match every room
- **THEN** non-matching bedroom cards are hidden and matching cards still show images

### Requirement: Sleep and insomnia lore is encyclopedia, not a clinic

The lore dock MUST show sourced sleep/insomnia encyclopedia cards with local images and a not-medical-advice disclaimer. Copy MUST NOT claim the visitor has a disease and MUST NOT prescribe treatment. Wikipedia sources MUST open an in-lounge reader (button), not an outbound `<a>`. Clinic hosts already allowed on 拉了么 医典 MAY remain as outbound `https` links.

#### Scenario: Lore sheet never diagnoses

- **WHEN** a visitor opens a lore card
- **THEN** the sheet includes the disclaimer, the body does not contain `you have` or `你患有`, and Wikipedia labels are buttons rather than `wikipedia.org` links

### Requirement: Tap-to-play soundscapes

The sound dock MUST offer named bedside scenes (at least brown noise, pink noise, rain-like, and fan-like). Sound MUST start only after an explicit tap. Scenes MUST be generated or packaged locally — not YouTube, Douyin, or TikTok. Leaving `/shuileme` MUST stop playback. Hiding the tab MUST NOT force-stop playback (phone locked on the nightstand). `prefers-reduced-motion` does not apply to audio. The dock MUST NOT use the Notification API.

#### Scenario: Tap starts, unmount stops

- **WHEN** the visitor taps a sound scene, then navigates away from `/shuileme`
- **THEN** playback started after the tap and is stopped after the page unmounts, and `Notification` is never referenced

#### Scenario: Autoplay is blocked

- **WHEN** the sound dock first appears with no tap
- **THEN** no scene is playing

### Requirement: Wind-down visual without video

The wind-down dock MUST show a slow, dim visual field (breathing orb or equivalent CSS) meant to be watched in bed. It MUST honor `prefers-reduced-motion` by showing a static dim field instead of animation. It MUST NOT embed `<video>` or autoplay motion that flashes. Optional further dimming after minutes in this dock MUST NOT be an alarming modal.

#### Scenario: Reduced motion is static

- **WHEN** the visitor has `prefers-reduced-motion: reduce` and opens the wind-down dock
- **THEN** the visual is present and does not use a looping transform animation, and `querySelector('video')` is null
