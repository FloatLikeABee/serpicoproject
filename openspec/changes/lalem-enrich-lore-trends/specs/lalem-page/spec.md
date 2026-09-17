# Spec Delta

## ADDED Requirements

### Requirement: 医典 catalog has at least fifty sourced articles

`GET` of the public 拉了么 medicine catalog MUST return at least 50 encyclopedia articles. Each article MUST have a stable id, Simplified Chinese title and body, English title and body, the lounge not-medical-advice disclaimer on the article sheet, and at least one Wikipedia https URL plus at least one allowlisted medical-organization https URL (NHS, Mayo Clinic, MedlinePlus, Cleveland Clinic, or WHO). Copy MUST NOT diagnose the visitor, MUST NOT prescribe a personal treatment plan, and MUST NOT claim the lounge is a clinic. Sit-session alerts MUST NOT write into 医典. The 医典 dock on `/lalem` MUST list every returned article. Wikipedia stays an in-app reader via the existing wiki GET (no `wikipedia.org` `<a>`).

#### Scenario: 医典 list is a full encyclopedia

- **WHEN** a visitor opens 医典 on `/lalem`
- **THEN** they see at least 50 article titles, not a seven-item pamphlet, and not a diagnostic questionnaire

#### Scenario: Catalog JSON meets the floor

- **WHEN** a client requests the public medicine catalog
- **THEN** the JSON `articles` array length is at least 50 and each item has CN/EN copy plus sourced https URLs

#### Scenario: Article still opens in-lounge with wiki GET

- **WHEN** a visitor opens an 医典 article and activates Wikipedia
- **THEN** the in-app wiki reader loads via the lounge wiki GET and the document URL stays on `/lalem` with no `wikipedia.org` `<a>`

### Requirement: 拉榜 list shows the full stored feed

The 拉榜 dock MUST render every trend card returned by the public digest for the current locale, including compact local photo thumbs, kind tag, title, and hook. After seed or top-up the list MUST contain at least 50 rows. The list MUST NOT embed `<video>` or navigate to Douyin/YouTube. Mapped titles still open 医典 / 厕纸 / 马桶 sheets; unmapped titles still open lounge copy. English dock label stays **La bang**.

#### Scenario: 拉榜 has fifty thumbs

- **WHEN** a visitor opens 拉榜 after the digest for their locale has been seeded or topped up
- **THEN** they see at least 50 trend rows, each with a small local photo thumb, and `querySelector('video')` is null

#### Scenario: Daily extras appear without wiping the stack

- **WHEN** a visitor opens 拉榜 on a later Asia/Shanghai day after increment ran
- **THEN** previously listed cards are still present and a few new unique titles appear above or among them (newest-first)
