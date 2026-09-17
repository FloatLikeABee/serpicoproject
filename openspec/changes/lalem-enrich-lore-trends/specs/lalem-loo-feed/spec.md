# Spec Delta

## ADDED Requirements

### Requirement: Digest archive floors at fifty unique trends

For each locale, the public digest MUST keep at least 50 unique trend titles in the durable store (within the three-month retention window) after the first successful seed or top-up. An empty store MUST seed at least 50 unique cards (live model plus canned pad). A warm store with fewer than 50 unique titles MUST append unique canned (or live) cards until the floor is met, without deleting existing rows. Duplicate titles for the same locale MUST be skipped. Each trend `imageUrl` MUST stay a local `/lalem/trends/*.jpg` path (pool cycling is allowed). `videos` MUST remain empty.

#### Scenario: Empty store seeds fifty

- **WHEN** a digest GET arrives for a locale with no stored trend rows
- **THEN** the response `trends` array has at least 50 items with unique titles and local `.jpg` image URLs, and those rows are persisted

#### Scenario: Short warm store is topped up, not replaced

- **WHEN** a digest GET arrives for a locale that already has fewer than 50 unique stored trend titles
- **THEN** new unique titles are appended until there are at least 50, and the previously stored titles are still present

#### Scenario: Live seed that returns fewer than fifty is padded

- **WHEN** the live model returns fewer than 50 unique trend titles on seed or top-up
- **THEN** the digest still reaches at least 50 unique titles by padding from the canned pack, without wiping stored rows

### Requirement: Daily increment still appends a little more

Once a locale already has at least 50 unique stored trends, the system MUST still append about two new unique trend cards and exactly one new useful note once per Asia/Shanghai calendar day per locale. Same-day GET MUST NOT call the live model again as a precondition of returning the archive. Generation failure MUST leave existing rows intact. Three-month prune is unchanged.

#### Scenario: New day adds two trends on a full archive

- **WHEN** a digest GET arrives on a new Asia/Shanghai day for a locale that already has ≥50 stored trends
- **THEN** about two new unique trend titles and one new useful note are appended and the previous ≥50 remain

#### Scenario: Same day does not shrink the feed

- **WHEN** a second digest GET arrives later the same Shanghai day
- **THEN** the response still has at least 50 unique trends and is served from the store without a new live-model round-trip
