## Purpose

Gives Fridge Raid a dedicated dish-detail advisor call that turns a short suggestion card into structured cuisine steps and culinary TCM “good for” notes, without changing officer chat or stuffing recipes into the card list.

## ADDED Requirements

### Requirement: Dedicated dish-detail API

The system SHALL expose a dedicated fridge-raid dish-detail API, separate from officer `/chat` and from the short-card fridge-raid chat payload. The request MUST include locale and the suggestion card being expanded (title and enough context to cook from leftovers). The response MUST be structured JSON the modal can render, not a single undifferentiated essay.

#### Scenario: Card context returns structured detail

- **WHEN** a client posts a suggestion card plus locale to the dish-detail API
- **THEN** the response includes a short cooking method and culinary TCM fields for that dish in that locale

#### Scenario: Officer chat is unchanged

- **WHEN** an officer sends a message to the existing officer chat endpoint
- **THEN** that path is unaffected by dish-detail prompts or kitchen detail payloads

### Requirement: Same live model config as Serpico fridge-raid text

Dish-detail generation MUST use the same SiliconFlow live-model configuration as Fridge Raid text cards and officer Serpico (same key, base URL, and live model id). It MUST NOT require a separate vision model. This path MUST NOT accept fridge photos.

#### Scenario: Text-only detail

- **WHEN** the dish-detail API is called with a card and locale
- **THEN** the server does not require an image and uses the Serpico SiliconFlow live model

### Requirement: Culinary TCM “good for”, not medical practice

Detail copy MUST stay in culinary / seasonal-wellness language. It MUST describe natures/flavors and what the dish is good for as food (appetite, seasonal heat/damp/dry, everyday balance). It MUST NOT diagnose disease, prescribe treatment, or claim to cure conditions. A short not-medical-advice flag MUST be present on the payload.

#### Scenario: No treatment claims

- **WHEN** a user-supplied cooking plan or leftover text mentions a medical condition
- **THEN** the detail reply stays culinary, does not diagnose or prescribe, and still includes the not-medical-advice framing

### Requirement: Short structured method, not a story

The cooking method MUST be a short list of steps (enough to cook, not a restaurant manual). TCM “good for” MUST be a short list of culinary points, not a multi-section essay.

#### Scenario: Length stays scannable in a modal

- **WHEN** detail is returned
- **THEN** the method is a bounded step list and the TCM section is a bounded list of culinary points, not a long origin story

### Requirement: Reply language matches locale

Assistant copy MUST be in English when locale is English and in Simplified Chinese when locale is Chinese. The API MUST NOT return a bilingual wall of duplicate paragraphs as the primary body.

#### Scenario: Chinese locale

- **WHEN** the request locale is Chinese
- **THEN** method steps and TCM “good for” copy are in Simplified Chinese

### Requirement: Rate limit the public detail call

The public dish-detail API MUST apply a simple per-client rate limit (shared with fridge-raid chat is allowed) so tapping every card cannot unbounded-burn the live model.

#### Scenario: Burst is rejected

- **WHEN** a client exceeds the documented burst on fridge-raid AI routes
- **THEN** the detail API returns a rate-limit error instead of calling the live model
