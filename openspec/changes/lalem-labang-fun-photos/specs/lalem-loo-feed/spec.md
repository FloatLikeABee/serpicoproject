## ADDED Requirements

### Requirement: Distinct packaged toilet images are photographs

Packaged toilet image files served by the catalog MUST be **raster photographs** (JPEG or WebP) of real fixtures. Different shape classes MUST use different photographs, not one sprite recolored. Same-shape cousins MUST still use different files. Image URLs MUST stay on the local pack path used by the lounge (`/lalem/toilets/…`), MUST NOT be a third-party hotlink, MUST NOT be SVG pixel sprites, and MUST NOT be live-model output.

#### Scenario: Mixed-shape catalog files are different photographs

- **WHEN** the catalog includes sit, squat, urinal, vacuum, and portable toilets
- **THEN** those items’ packaged image files are distinct raster photographs on `/lalem/toilets/`, not the same SVG with only fill colors or captions changed

#### Scenario: Catalog images are local rasters, not hotlinks

- **WHEN** a client requests the unfiltered toilet catalog
- **THEN** every `imageUrl` is a local `/lalem/toilets/` path ending in `.jpg` or `.webp`, and none contain `://`

### Requirement: Packaged paper images are photographs

Packaged 厕纸 / wipe catalog files MUST be raster photographs (JPEG or WebP) of the named tool or method, stored under `/lalem/papers/`. They MUST NOT be SVG sprites, MUST NOT reuse a toilet photo as the paper card, and MUST NOT be hotlinked. Each paper id MUST keep a unique file.

#### Scenario: Paper catalog files are local photos

- **WHEN** a client requests the paper catalog
- **THEN** every item has a local `/lalem/papers/` JPEG or WebP `imageUrl` that exists on disk and is not an SVG sprite

### Requirement: Digest trend images are small funny local photographs

The digest trend image pool MUST be locally packaged raster photographs that look funny or interesting in a compact thumbnail (not huge SVG posters and not the NES sprite set). Every trend `imageUrl` MUST stay on `/lalem/trends/` with a `.jpg` or `.webp` extension. The pool MUST NOT hotlink a CDN. Digest `videos` MUST stay empty. Wiki GET behavior is unchanged.

#### Scenario: Trend pool is local photos

- **WHEN** a client requests the digest
- **THEN** each trend’s `imageUrl` is a local `/lalem/trends/` JPEG or WebP path, and `videos` is empty

#### Scenario: Pool files exist and are rasters

- **WHEN** the packaged trend pool is read from disk
- **THEN** each pool path exists as a photographic raster file, not an SVG
