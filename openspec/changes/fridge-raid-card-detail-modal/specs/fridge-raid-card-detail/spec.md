## Purpose

Lets a Fridge Raid visitor tap a short suggestion card and read a beautiful kitchen modal with cuisine steps and culinary TCM “good for” notes, without turning the chat thread into essays.

## ADDED Requirements

### Requirement: Card click opens a kitchen detail modal

Tapping a suggestion card SHALL open a kitchen-styled modal for that dish. The modal MUST appear over the Fridge Raid page (not a new route and not the officer shell). Cards that only nudge the user to raid the fridge (no suggestions) MUST NOT open a dish modal.

#### Scenario: Visitor taps a suggestion card

- **WHEN** a visitor taps a dish suggestion card on `/fridge-raid`
- **THEN** a kitchen modal opens for that dish, with the dish title visible immediately

#### Scenario: TCM peek does not steal the card click

- **WHEN** a visitor uses the existing collapsed TCM expand control on a card
- **THEN** the short TCM note toggles on the card and the detail modal does not open from that control

### Requirement: Modal shows cuisine and culinary TCM, not an essay dump

The modal MUST show structured cuisine method (short steps) and culinary TCM information (natures/flavors, what the dish is good for in seasonal/wellness language, culinary cautions). It MUST NOT present a long undifferentiated story as the primary view. A short not-medical-advice line MUST be visible in the modal.

#### Scenario: Cuisine steps are visible

- **WHEN** detail content has loaded for a dish
- **THEN** the visitor sees a short cooking method as a list of steps, not a multi-paragraph origin story

#### Scenario: Culinary TCM “good for” is visible

- **WHEN** detail content has loaded for a dish
- **THEN** the visitor sees traditional food-theory notes that say what the dish is good for in culinary/seasonal language (for example clearing summer heat or waking appetite), not a diagnosis or prescription

### Requirement: Beautiful isolated kitchen modal chrome

The modal SHALL use the Fridge Raid kitchen look (warm, colorful, seasonal). It MUST NOT use officer synth-grid, scanlines, or bottom Navigation. On a narrow viewport it MUST occupy most of the screen as a sheet; on a wide viewport it MUST sit as a centered dialog. The visitor MUST be able to close it with a close control, the backdrop, and Escape.

#### Scenario: Close the modal

- **WHEN** a visitor presses Escape, taps the backdrop, or taps close
- **THEN** the modal closes and they are back on the Fridge Raid thread with the composer still usable

#### Scenario: Officer chrome stays out

- **WHEN** the detail modal is open
- **THEN** it does not show officer bottom navigation or synth-grid as its primary look

### Requirement: Loading, error, and session cache

Opening the modal MUST request detail if it is not already cached for that dish and locale in the current browser session. While waiting, the modal MUST show a short busy state under the dish title. If the request fails, the modal MUST show a short error and a try-again control. A successful payload MUST be reused if the visitor opens the same dish again in that session.

#### Scenario: First open loads

- **WHEN** a visitor opens a dish they have not opened in this session
- **THEN** they see a busy state, then the cuisine and TCM sections (or a short error with try again)

#### Scenario: Reopen uses cache

- **WHEN** a visitor closes a successfully loaded modal and opens the same dish again in the same session
- **THEN** the modal shows the cached detail without requiring a successful new network round-trip as a precondition of seeing the content

### Requirement: Language follows Fridge Raid locale

Modal chrome and loaded detail copy MUST follow the Fridge Raid English / Simplified Chinese setting. Traditional Chinese remains out of scope.

#### Scenario: Chinese modal chrome

- **WHEN** Fridge Raid is in Simplified Chinese and a visitor opens a card
- **THEN** close, busy, and error chrome are in Simplified Chinese
