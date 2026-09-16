## ADDED Requirements

### Requirement: Toilet catalog includes locale Wikipedia URLs

Each toilet in the public toilet catalog MUST include an https Chinese Wikipedia URL and an https English Wikipedia URL for the real fixture type (or the closest article). Hosts MUST be Wikipedia (`zh.wikipedia.org` and `en.wikipedia.org` respectively). The catalog MUST NOT require a live model call. URLs MUST be curated in the dataset, not scraped at request time.

#### Scenario: Every toilet has both wiki URLs

- **WHEN** a client requests the unfiltered toilet catalog
- **THEN** every toilet includes a `zh.wikipedia.org` https URL and an `en.wikipedia.org` https URL

#### Scenario: Wiki URLs are not invented per request

- **WHEN** two clients request the toilet catalog
- **THEN** the Wikipedia URLs come from the curated catalog and do not require a Wikipedia fetch as a precondition of the response

### Requirement: Distinct packaged toilet images by shape

Packaged toilet image files served by the catalog MUST use different drawing geometry for different shape classes. Recoloring one ellipse-and-tank template and changing only the caption MUST NOT be the catalog for mixed shapes. Image URLs MUST stay on the local pack path used by the lounge (not a third-party hotlink).

#### Scenario: Mixed-shape catalog files are not color-swaps

- **WHEN** the catalog includes sit, squat, urinal, vacuum, and portable toilets
- **THEN** the packaged image files for those shapes are not the same drawing with only fill colors or captions changed

### Requirement: Public paper-and-wipe catalog

The system SHALL expose a public paper/wipe catalog, separate from officer `/chat` and from fridge-raid, with at least eight items that together cover historical wipe methods and modern paper/water methods. Each item MUST include locale titles, a short blurb, an image URL, and locale-matched Wikipedia https URLs on the same rules as toilets. The catalog MUST be curated data, not a live-model or scrape result.

#### Scenario: Paper catalog lists history and modern types

- **WHEN** a client requests the paper catalog
- **THEN** the response includes multiple wiping methods spanning history and today, and every item has an image URL plus Chinese and English Wikipedia URLs

### Requirement: Public medicine encyclopedia catalog

The system SHALL expose a public medicine-encyclopedia catalog for 拉了么. It MUST include multiple articles on posture and defecation force as general knowledge. Each article MUST include locale title and body (more than one short sentence), the not-medical-advice disclaimer (or a flag the lounge already shows), Wikipedia https URL(s), and at least one https URL whose host is an allowlisted medical organization (NHS, Mayo Clinic, MedlinePlus, Cleveland Clinic, or WHO). Bodies MUST NOT diagnose a named visitor and MUST NOT prescribe a personal treatment plan. Generation MUST NOT use the live SiliconFlow model to invent clinical claims for this catalog.

#### Scenario: Medicine catalog is detailed and sourced

- **WHEN** a client requests the medicine catalog
- **THEN** each article has a multi-sentence body, a Wikipedia https link, and at least one allowlisted medical-org https link

#### Scenario: Medicine catalog is not a live clinical model

- **WHEN** two clients request the medicine catalog
- **THEN** the bodies come from the curated dataset and the live model is not called as a precondition of returning articles

### Requirement: Digest has no playable videos and trends can name a topic

The public digest payload MUST NOT include a playable hot-video item for the lounge to render. The `videos` field MUST be omitted or an empty array. Trend objects MAY include a topic identifier that names a toilet, paper, or medicine catalog id when a curated mapping exists. Digest keep-and-append, locale split, and 3-month retention for trends and useful notes MUST stay. Daily increment copy MUST NOT be used as 医典 article bodies.

#### Scenario: Digest has no playable video source

- **WHEN** a client requests the digest
- **THEN** the payload has no video item with a playable media URL (empty or absent `videos`)

#### Scenario: Mapped trend carries a topic id

- **WHEN** a stored or canned trend matches a curated encyclopedia topic
- **THEN** that trend in the digest includes a topic identifier the lounge can use to open the matching article

#### Scenario: Archive behavior is unchanged aside from videos

- **WHEN** a client requests the digest for a locale with stored trends
- **THEN** newest-first trends and useful notes are still returned without requiring a live-model call as a precondition, and still without playable videos
