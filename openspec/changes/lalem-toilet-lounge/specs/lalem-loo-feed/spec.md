## Purpose

Gives 拉了么 a dedicated public feed: a filterable world-and-history toilet catalog with images, plus a cached entertainment/fashion digest with images and playable hot clips, and short useful bathroom notes — without officer chat or user photo uploads.

## ADDED Requirements

### Requirement: Filterable toilet catalog with images

The system SHALL expose a public toilet-catalog API, separate from officer `/chat` and from fridge-raid. Each toilet MUST include a title, shape, size, class, optional era/history tag, a short blurb, and an image URL the lounge can render. The catalog MUST include toilets from multiple world regions and from history, not only contemporary sit toilets.

#### Scenario: Unfiltered catalog returns pictured toilets

- **WHEN** a client requests the toilet catalog with no filters
- **THEN** the response includes multiple toilets spanning more than one shape and more than one era, and every item has an image URL

#### Scenario: Shape size and class filters

- **WHEN** a client requests the catalog with shape, size, and/or class filters
- **THEN** every returned toilet matches those filters and still has an image URL

### Requirement: Entertainment and fashion digest with images

The system SHALL expose a public digest API whose primary cards are entertainment and fashion. Every digest card MUST include an image URL. Copy MUST follow the requested locale (Simplified Chinese by default). Cards MUST be structured JSON the lounge can paint, not a single undifferentiated essay.

#### Scenario: Digest concentrates on entertainment and fashion

- **WHEN** a client requests the digest
- **THEN** most cards are tagged entertainment or fashion, each with an image, and the payload is structured JSON

#### Scenario: Locale follows the lounge

- **WHEN** the request locale is Chinese
- **THEN** digest titles and hooks are in Simplified Chinese

### Requirement: Playable hot videos in the digest

The digest MUST include one or more hot-video items with a playable media URL (or equivalent playable source) the lounge can start without leaving the page. Image-only cards MUST NOT be labeled as the hot-video row.

#### Scenario: Hot videos are real media

- **WHEN** a client requests the digest
- **THEN** the payload includes at least one video item with a playable source and a poster image

### Requirement: Useful bathroom notes, not clinical practice

The digest MUST include a short useful-notes list (hygiene, etiquette, don’t strain, sitting time). Copy MUST stay in everyday language. It MUST NOT diagnose disease, interpret stool as a lab result, or claim to treat conditions. A short not-medical-advice flag MUST be present.

#### Scenario: No treatment claims

- **WHEN** the digest is returned
- **THEN** useful notes are practical bathroom tips, include a not-medical-advice flag, and do not prescribe treatment

### Requirement: Same live model config as Serpico text, no user photos

Digest generation MUST use the same SiliconFlow live-model configuration as Serpico / Fridge Raid text (same key, base URL, and live model id). This path MUST NOT accept user photos or require a vision model. The toilet catalog MAY be a curated dataset rather than a live model call.

#### Scenario: Text-only digest

- **WHEN** the digest API is called
- **THEN** the server does not require an image upload and uses the Serpico SiliconFlow live text model for generated copy (or a cache of that generation)

### Requirement: Cache and rate-limit the public digest

The public digest API MUST apply a simple per-client rate limit so refreshing 热榜 cannot unbounded-burn the live model. A successful digest MUST be reusable from a short server cache so many visitors in the same window share one generation.

#### Scenario: Burst is rejected

- **WHEN** a client exceeds the documented burst on 拉了么 AI routes
- **THEN** the digest API returns a rate-limit error instead of calling the live model again

#### Scenario: Cache hit does not require a new model call as a precondition

- **WHEN** a second client requests the digest while a fresh cached digest exists
- **THEN** they receive the cached payload without a new live-model round-trip as a precondition of seeing cards
