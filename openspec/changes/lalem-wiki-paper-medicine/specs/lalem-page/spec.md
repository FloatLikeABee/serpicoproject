## ADDED Requirements

### Requirement: Toilet images link out to Wikipedia

Every toilet-card image on `/lalem` MUST be a hyperlink to a Wikipedia article about that real fixture type (or the closest historical article when the exact object has no page). When the lounge language is Simplified Chinese, the image MUST use the Chinese Wikipedia URL. When the lounge language is English, the image MUST use the English Wikipedia URL. The link MUST open in a new browsing context (`target="_blank"` with `rel` including `noopener`). The image MUST NOT be nested inside the control that opens the in-page sheet. Tapping the card title (or equivalent non-image chrome) MUST still open the existing in-page sheet on `/lalem`. The sheet MUST also expose the same Wikipedia URL as a text link. The lounge MUST NOT scrape Wikipedia HTML and MUST NOT embed Wikipedia in an iframe.

#### Scenario: Chinese image goes to Chinese Wikipedia

- **WHEN** the lounge is in Simplified Chinese and a visitor activates a toilet card image
- **THEN** the browser opens a `zh.wikipedia.org` https URL for that fixture in a new tab, and the visitor remains able to return to `/lalem`

#### Scenario: English image goes to English Wikipedia

- **WHEN** the lounge is in English and a visitor activates a toilet card image
- **THEN** the browser opens an `en.wikipedia.org` https URL for that fixture in a new tab

#### Scenario: Title still opens the in-page sheet

- **WHEN** a visitor activates the toilet card title (not the image)
- **THEN** the existing in-page sheet opens on `/lalem` and shows the Wikipedia link, without navigating the lounge away from `/lalem`

### Requirement: Toilet illustrations are distinct silhouettes, not recolors

Toilet-card images MUST depict the named fixture with a silhouette that matches its shape class (sit bowl, squat pan, urinal trough, vacuum pan, portable cabin, space commode, close-stool chair, child seat, accessible stall — as applicable). Two toilets with different `shape` values MUST NOT share the same drawing geometry with only fill color or caption changed. At least two toilets that share a `shape` MUST still differ in setting or props so they are not identical clones. The lounge MUST keep serving local packaged images (not a live image-generation model and not hotlinked Wikimedia files as the card bitmap).

#### Scenario: Different shapes do not look like the same bowl

- **WHEN** a visitor compares a sit toilet, a squat toilet, a urinal trough, a vacuum toilet, and a portable toilet in the gallery
- **THEN** each of those cards shows a different silhouette, not the same ellipse-and-tank drawing recolored

#### Scenario: Same-shape cousins are not identical

- **WHEN** a visitor compares two sit toilets from different places or eras
- **THEN** their images differ by more than the caption text

### Requirement: 厕纸 dock shows paper types and wipe history

The lounge dock MUST include a first-class **厕纸** surface (Chinese label 厕纸, English label that names paper/wipes). That surface MUST be a visual gallery of wiping materials and methods across history and today (including at least: communal sponge-stick, newspaper or paper substitutes, plant material, modern roll paper, wet wipes, bidet or washlet water, and a Southeast-Asian handheld sprayer). Every card MUST show an image. Tapping a card MUST open an in-page sheet with the story. Each card image MUST link to Wikipedia the same way toilet images do (locale-matched wiki, new tab). This surface MUST NOT appear in officer Navigation.

#### Scenario: Visitor opens 厕纸

- **WHEN** a visitor selects 厕纸 on the lounge dock
- **THEN** they see a gallery of distinct wiping tools and historical methods with images, not the officer dashboard and not an empty chat composer

#### Scenario: Historical wipe method has a wiki image link

- **WHEN** a visitor activates the image on a historical wipe card (for example the Roman sponge-stick)
- **THEN** a locale-matched Wikipedia page about that practice or object opens in a new tab

### Requirement: 医典 dock is sourced posture and force encyclopedia

The lounge dock MUST include a first-class **医典** surface. It MUST present detailed encyclopedia articles on toilet posture and defecation force, covering at least: sitting versus squatting, a footstool or forward lean, straining / Valsalva, time spent sitting, pelvic-floor context, and hemorrhoids and constipation as general encyclopedia topics. Each article MUST show the not-medical-advice disclaimer. Each article MUST include outbound https links to Wikipedia **and** at least one allowlisted medical organization page (hosts in the NHS, Mayo Clinic, MedlinePlus, Cleveland Clinic, or WHO sets). Copy MUST NOT diagnose the visitor, MUST NOT prescribe a personal treatment plan, and MUST NOT claim the lounge is a clinic. Sit-session alerts remain a gag and MUST NOT write into 医典.

#### Scenario: Visitor opens 医典

- **WHEN** a visitor selects 医典 on the lounge dock
- **THEN** they see a list of detailed posture/force articles plus the not-medical-advice disclaimer, not a diagnostic questionnaire

#### Scenario: Article cites wiki and a clinic page

- **WHEN** a visitor opens a 医典 article
- **THEN** they can follow a Wikipedia link and a separate allowlisted medical-org link, both https, without the lounge fetching those pages as scraped HTML

#### Scenario: Copy does not diagnose the visitor

- **WHEN** a visitor reads 医典
- **THEN** the copy does not tell them they have a disease and does not prescribe treatment for them personally

### Requirement: 热榜 has no video players and trends open detail

The 热榜 surface MUST NOT render a playable video element, MUST NOT label image-only rows as videos, and MUST NOT embed Douyin, YouTube, or other off-site clip players. Every trend card MUST remain tappable. Activating a trend MUST open an in-page detail sheet on `/lalem`: when the trend maps to a toilet, 厕纸, or 医典 topic, that curated article MUST be the sheet; otherwise the sheet MUST show the trend title, hook, and a lounge-copy notice (not a news or medical claim). Trend cards MUST still show an image.

#### Scenario: 热榜 has no video player

- **WHEN** a visitor opens 热榜
- **THEN** the page contains no `<video>` (or equivalent playable clip) and does not prompt them to play a hot clip

#### Scenario: Mapped trend opens encyclopedia

- **WHEN** a visitor activates a trend that maps to a 医典, 厕纸, or toilet topic
- **THEN** an in-page sheet opens with that curated detailed content, without leaving `/lalem`

#### Scenario: Unmapped trend still opens a sheet

- **WHEN** a visitor activates a trend with no encyclopedia mapping
- **THEN** an in-page sheet still opens showing that trend’s title and hook as lounge copy, not a video
