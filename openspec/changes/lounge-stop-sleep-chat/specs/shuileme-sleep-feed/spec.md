# Spec Delta

## ADDED Requirements

### Requirement: Beds and bedrooms photographs are unique local JPEGs

`GET` of the public 睡了么 beds and bedrooms endpoints MUST return items whose `imageUrl` is a local path under `/shuileme/beds/` or `/shuileme/rooms/` ending in `.jpg`. Each file MUST be a real JPEG (SOI `FF D8`), MUST NOT be an SVG leftover, MUST NOT be a hotlink (`http` / `://`), and each bed photograph MUST have a unique content hash from every other bed photograph. Bedroom photographs MUST likewise be unique from each other. Credits MUST name the packaged source. Lore images MAY remain illustrated so long as they stay local JPEGs under `/shuileme/lore/`.

#### Scenario: Bed photographs are unique JPEGs on disk

- **WHEN** a client reads the unfiltered beds catalog
- **THEN** every `imageUrl` is a local `/shuileme/beds/*.jpg` whose bytes start with JPEG SOI, and no two beds share the same file hash

#### Scenario: Bedroom photographs are unique JPEGs on disk

- **WHEN** a client reads the unfiltered bedrooms catalog
- **THEN** every `imageUrl` is a local `/shuileme/rooms/*.jpg` whose bytes start with JPEG SOI, and no two rooms share the same file hash

### Requirement: Public sleepy lecture chat

`POST` of the public 睡了么 chat endpoint MUST accept JSON `{ locale, message, history? }` and MUST return `200` JSON with a non-empty `reply` that is a dry law, science, or math lecture in short easy sentences. When the live model is missing or fails, the handler MUST return a canned dry lecture. Replies MUST NOT contain `you have` or `你患有`, MUST NOT prescribe treatment, and MUST NOT reuse 拉了么 funny poop copy. The route MUST be rate-limited separately from 拉了么 chat. The response MUST NOT instruct the client to call `/lalem/*`.

#### Scenario: Chat returns a dry lecture

- **WHEN** a client POSTs `{ "locale": "cn", "message": "讲一点数学" }` to the 睡了么 chat endpoint
- **THEN** the status is 200 and `reply` is a non-empty dry lecture without `you have` or `你患有`

#### Scenario: Canned path when the model is down

- **WHEN** a client POSTs a chat message and the advisor has no live completion function
- **THEN** the status is 200 and `reply` is a canned dry lecture in the requested locale

#### Scenario: Diagnosis is rejected

- **WHEN** the live model returns copy containing `you have` or `你患有`
- **THEN** the handler returns a canned dry lecture instead of that copy
