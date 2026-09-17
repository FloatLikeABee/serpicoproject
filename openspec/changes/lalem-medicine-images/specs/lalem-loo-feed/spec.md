# Spec Delta

## ADDED Requirements

### Requirement: Medicine catalog items have local JPEG photographs

`GET` of the public 拉了么 medicine catalog MUST include an `imageUrl` on every article. Each `imageUrl` MUST be a local path under `/lalem/medicine/` ending in `.jpg`, MUST NOT contain `://`, MUST exist as a JPEG file on disk (JPEG SOI), and MUST NOT be an SVG leftover. Distinct article ids MUST have distinct file bytes (SHA-256). Medicine photographs MUST NOT reuse the byte-identical file of a toilet or paper catalog image.

#### Scenario: Catalog JSON carries local jpgs

- **WHEN** a client requests the public medicine catalog
- **THEN** every article has an `imageUrl` of the form `/lalem/medicine/<id>.jpg` with no `://`, and the file exists on disk as a JPEG

#### Scenario: Medicine photos are distinct from toilets and papers

- **WHEN** uniqueness is checked across packaged lounge catalogs
- **THEN** no two medicine articles share SHA-256, and no medicine file matches a toilet or paper catalog file
