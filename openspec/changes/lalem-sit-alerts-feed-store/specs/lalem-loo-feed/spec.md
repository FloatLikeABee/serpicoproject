## ADDED Requirements

### Requirement: Durable store for trends and useful notes

The system SHALL persist every kept 热榜 trend card and every kept 有用 note in the existing durable application database (the same disk-backed store used for other Serpico SQLite data), keyed by locale. Persistence MUST survive process restart. The public digest MUST NOT treat an in-memory hour cache as the only copy of those cards.

#### Scenario: Restart still has yesterday’s cards

- **WHEN** the lounge process restarts and a client then requests the digest
- **THEN** trend cards and useful notes stored before the restart are still returned (within the retention window)

#### Scenario: Both locales are stored

- **WHEN** a client requests the digest for Chinese and another request uses English
- **THEN** each locale’s stored trends and useful notes are returned in that locale, not mixed together

### Requirement: Digest GET is a fast store read

`GET` of the public 拉了么 digest MUST return the stored archive for the requested locale without calling the live model as a precondition of showing cards. The payload MUST keep the existing digest JSON field names (`generatedAt`, `locale`, `disclaimer`, `trends`, `videos`, `useful`). `trends` and `useful` MUST be newest-first and MAY contain more items than a single generation batch. `videos` MUST still include the curated playable hot clips. Cheap store reads MUST NOT consume the live-model rate-limit budget.

#### Scenario: Stored cards return without a live-model round-trip

- **WHEN** the store already has digest rows for the locale
- **THEN** the digest response includes those rows and does not require a new live-model call before returning

#### Scenario: Payload shape stays a digest

- **WHEN** a client requests the digest
- **THEN** the JSON includes disclaimer, newest-first `trends` with images, `useful` notes, and at least one playable `videos` item

#### Scenario: Store reads are not live-model-limited

- **WHEN** a client refreshes the digest repeatedly while the store is already populated for that locale and no daily increment is due
- **THEN** each response is served from the store and is not rejected as a live-model burst

### Requirement: Daily keep-and-append updates

The system SHALL keep existing stored trends and useful notes. Once per Asia/Shanghai calendar day per locale, it MUST append about two new trend cards and exactly one new useful note (skipping a duplicate title already stored for that locale). The first time a locale has no rows, the system MAY seed the store with a larger initial batch from the existing digest advisor, then follow the daily increment afterwards. Daily generation MUST use the same SiliconFlow live text configuration as Serpico / Fridge Raid text, with no vision and no user photos. Generation failure MUST leave existing rows intact and MAY skip that day’s increment.

#### Scenario: A new day adds a couple of trends and one useful note

- **WHEN** a digest request arrives for a locale on a new Asia/Shanghai day after that locale already has stored rows
- **THEN** about two new trend cards and one new useful note are appended, and older stored rows remain

#### Scenario: Same day does not replace the archive

- **WHEN** a second digest request arrives later on the same Asia/Shanghai day after the increment (or seed) already ran
- **THEN** the store is not wiped and the live model is not called again as a precondition of returning cards

#### Scenario: Failed generation keeps prior data

- **WHEN** the daily increment cannot be generated
- **THEN** previously stored trends and useful notes are still returned and are not deleted

### Requirement: Three-month retention

The system MUST delete trend and useful rows whose stored timestamp is older than three months. Digest responses MUST NOT include pruned rows. Three months is the maximum keep window; newer rows MUST remain until they age out.

#### Scenario: Old cards disappear after three months

- **WHEN** a stored trend or useful note is older than three months
- **THEN** a later digest response does not include that item

#### Scenario: Recent cards stay

- **WHEN** a stored trend or useful note is newer than three months
- **THEN** it remains available in digest responses until it ages past that window

### Requirement: Rate-limit live digest generation only

The public digest API MUST apply a simple per-client rate limit so daily increment and first-time seed generation cannot unbounded-burn the live model. A successful stored archive MUST be reusable from the durable store so many visitors share one generation. An in-memory short cache MAY still wrap a composed digest response, but it MUST NOT be the only copy of trends and useful notes. Refreshing 热榜 when the store is warm MUST return stored cards without a new live-model round-trip as a precondition.

#### Scenario: Generation burst is rejected

- **WHEN** a client exceeds the documented burst on 拉了么 live-generation routes (empty store seed or due daily increment)
- **THEN** the digest API returns a rate-limit error instead of calling the live model again

#### Scenario: Warm store does not require a new model call as a precondition

- **WHEN** a second client requests the digest while stored rows (or a fresh composed cache of them) exist for that locale
- **THEN** they receive the stored payload without a new live-model round-trip as a precondition of seeing cards
