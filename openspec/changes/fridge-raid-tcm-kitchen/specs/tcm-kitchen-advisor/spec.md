## Purpose

Turns fridge leftovers, photos, and cooking plans into a few TCM-grounded dish suggestions that fit the current season and weather, in the caller’s language, without storing photos or giving medical advice.

## ADDED Requirements

### Requirement: Dedicated advisor API

The system SHALL expose a dedicated fridge-raid advisor API, separate from officer `/chat`. The API MUST accept locale, optional leftover text, optional cooking plan, optional fridge image, and optional location for weather. It MUST return structured suggestion cards, not a single undifferentiated essay.

#### Scenario: Text leftovers return cards

- **WHEN** a client posts leftover text and locale without an image
- **THEN** the response includes two to four structured dish suggestions in that locale

#### Scenario: Officer chat is unchanged

- **WHEN** an officer sends a message to the existing officer chat endpoint
- **THEN** that path is unaffected by fridge-raid prompts, vision, or kitchen card payloads

### Requirement: Fridge raid from text or photo

The advisor MUST infer usable ingredients from leftover text and/or a fridge-interior photo. When a photo is present, the system MUST use a vision-capable model. If vision fails, the API MUST return a short request to type what is in the fridge instead of inventing a full fridge inventory.

#### Scenario: Photo ingredients

- **WHEN** the client sends a fridge-interior image and the vision model succeeds
- **THEN** suggestions use foods that appear in that image (and any leftover text also sent)

#### Scenario: Vision unavailable

- **WHEN** the client sends only an image and vision is not configured or fails
- **THEN** the response does not invent a detailed fridge inventory and asks the user to type what they see

### Requirement: Cooking plan is a constraint

When the user states a cooking plan, suggestions MUST serve that plan using what is on hand when ingredients are known. When no ingredients are known, the advisor MUST still fridge-raid (ask what is in the fridge) or propose a short shopping-light version of the plan — it MUST NOT ignore the stated plan.

#### Scenario: Plan plus leftovers

- **WHEN** the user says they want soup and lists leftover chicken and ginger
- **THEN** returned suggestions are soup-like dishes that use those leftovers

#### Scenario: Plan without fridge contents

- **WHEN** the user states a cooking plan and sends neither leftovers nor a usable photo
- **THEN** the assistant asks for a fridge raid or returns at most a short plan-shaped prompt that still requests what is on hand

### Requirement: TCM, season, and weather

Every suggestion MUST be filtered and briefly justified using traditional Chinese medicine food theory (nature/flavor, organ or pattern correspondence) plus the current season. When location is provided, the system MUST also use current weather (temperature and a simple climate quality such as hot, cold, damp, dry, or windy). Southern-hemisphere seasons MUST follow latitude when location is provided.

#### Scenario: Summer heat favors clearing/cooling cooks

- **WHEN** the season is summer and weather is hot, and leftovers include both watermelon and lamb
- **THEN** suggestions prefer cooling or heat-clearing uses of what is on hand over heavy warming lamb-forward dishes as the lead idea

#### Scenario: Weather from location

- **WHEN** the client sends latitude and longitude
- **THEN** the advisor’s season/weather context includes a current weather reading for that point (or an explicit weather-unavailable fallback that still uses calendar season)

#### Scenario: No location still uses season

- **WHEN** the client omits location
- **THEN** suggestions still name the calendar season (northern hemisphere default) in the card chips or TCM note

### Requirement: Deliciousness, nutrition, wellbeing, appetite

Each suggestion MUST consider deliciousness, everyday nutrition, general wellbeing, and appetite (开胃) — not TCM theory alone. The dish name and first sentence MUST sell the taste; TCM MUST not occupy the first sentence.

#### Scenario: Taste leads

- **WHEN** suggestions are returned
- **THEN** each card’s first sentence is about taste or appetite, and a TCM reason appears as a separate short note or chip — not as the opening lecture

### Requirement: Reply language matches locale

Assistant copy MUST be in English when locale is English and in Simplified Chinese when locale is Chinese. The API MUST NOT return a bilingual wall of duplicate paragraphs as the primary body.

#### Scenario: Chinese locale

- **WHEN** the request locale is Chinese
- **THEN** dish names, hooks, and TCM notes are in Simplified Chinese (ingredient names may keep a common English alias in parentheses if short)

#### Scenario: English locale

- **WHEN** the request locale is English
- **THEN** dish names, hooks, and TCM notes are in English (Chinese dish names may appear as a short alias, not a second full essay)

### Requirement: Short replies

The advisor MUST keep answers short: two to four suggestions; each hook at most two sentences; TCM note at most two sentences. It MUST NOT tell long origin stories or multi-section essays.

#### Scenario: Length cap

- **WHEN** suggestions are returned
- **THEN** there are at most four dishes and no suggestion body exceeds two short sentences plus a two-sentence TCM note

### Requirement: Culinary wellness, not medical practice

The advisor MUST NOT diagnose disease, prescribe treatment, or claim to cure conditions. Copy MUST stay in culinary / seasonal-wellness language. A short not-medical-advice flag MUST be present on the payload or page.

#### Scenario: No treatment claims

- **WHEN** a user describes a medical condition and asks what to cook
- **THEN** the reply stays culinary, does not diagnose or prescribe, and still includes the not-medical-advice framing

### Requirement: Photos are not stored and uploads are bounded

Fridge images MUST be processed in memory and MUST NOT be written to durable storage. Oversized images MUST be rejected. The public API MUST apply a simple per-client rate limit.

#### Scenario: No durable photo file

- **WHEN** a fridge photo is accepted
- **THEN** the system does not persist that image as a stored upload file after the response is produced

#### Scenario: Too large

- **WHEN** a client sends an image larger than the documented size cap
- **THEN** the API rejects it without calling the vision model
