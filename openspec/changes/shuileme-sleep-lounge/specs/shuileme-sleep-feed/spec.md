# Spec Delta

## Purpose

Serves 睡了么 with static bilingual catalogs of beds, bedrooms, and sleep lore plus an allowlisted in-lounge Wikipedia summary, without a live digest or chat POST.

## ADDED Requirements

### Requirement: Public bed and bedroom catalogs

`GET` of the public 睡了么 beds and bedrooms endpoints MUST return JSON arrays of items with bilingual titles/blurbs, filter fields, a local (non-http) `imageUrl`, optional wiki URLs, and credit. Each catalog MUST contain at least eight unique items. Filter query params MUST subset the list without 500s.

#### Scenario: Beds include images and filters

- **WHEN** a client requests beds with a fill or era query
- **THEN** every returned bed has a local `imageUrl` prefix `/shuileme/` and matching filter fields, and there are at least eight beds in the unfiltered catalog

#### Scenario: Bedrooms include images

- **WHEN** a client requests bedrooms
- **THEN** the body includes at least eight rooms, each with a local image path

### Requirement: Public sleep lore catalog is sourced and non-diagnostic

`GET` of the public lore endpoint MUST return at least sixteen unique articles with bilingual body copy, a local image, credit, and at least one source URL per article. Bodies MUST NOT contain `you have` or `你患有` and MUST NOT prescribe named prescription drugs as treatment.

#### Scenario: Lore floor and hygiene

- **WHEN** a client requests lore
- **THEN** there are at least sixteen unique `id`s, each article has an image under `/shuileme/lore/` and a sources list, and no body contains `you have` or `你患有`

### Requirement: Allowlisted wiki summary

`GET` of the public 睡了么 wiki endpoint MUST accept only `https://zh.wikipedia.org/wiki/…` or `https://en.wikipedia.org/wiki/…` URLs and MUST return title + extract JSON on success. Other hosts MUST be rejected. The response MUST NOT include HTML that the client would render as an outbound Wikipedia `<a>`.

#### Scenario: Allowlisted wiki returns extract

- **WHEN** a client requests a zh.wikipedia.org wiki URL the lounge already stores
- **THEN** the status is 200 and the body includes a non-empty title and extract

#### Scenario: Off-host wiki is rejected

- **WHEN** a client requests a wiki URL on a host other than zh or en wikipedia.org
- **THEN** the status is 4xx and no third-party host is fetched
