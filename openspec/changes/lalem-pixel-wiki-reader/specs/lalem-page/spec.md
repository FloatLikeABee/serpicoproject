## REMOVED Requirements

### Requirement: Toilet images link out to Wikipedia
**Reason:** Phone OSes hand `wikipedia.org` links to the Wikipedia app, which is what visitors asked to stop.
**Migration:** Image and 维基 controls open the in-app wiki reader. Catalog `wikiUrlZh` / `wikiUrlEn` remain the source URLs passed to the lounge wiki API.

## ADDED Requirements

### Requirement: Wikipedia opens in an in-app lounge reader

Tapping a toilet or 厕纸 card image, or a Wikipedia control in a toilet / paper / 医典 sheet, MUST open an in-page reader on `/lalem`. The reader MUST show the article title and a text extract for the locale-matched Wikipedia URL already stored on that item. The lounge MUST NOT navigate to `wikipedia.org`, MUST NOT use an `<a href>` whose host is Wikipedia, MUST NOT set `target="_blank"` on Wikipedia URLs, MUST NOT embed Wikipedia in an iframe, and MUST NOT scrape full wiki HTML. Title chrome MUST still open the existing in-page detail sheet (not the wiki reader). Allowlisted medical-org links (NHS, Mayo Clinic, MedlinePlus, Cleveland Clinic, WHO) MAY remain ordinary outbound https links.

#### Scenario: Chinese image opens Chinese extract in a modal

- **WHEN** the lounge is in Simplified Chinese and a visitor activates a toilet card image
- **THEN** an in-page dialog shows a Chinese Wikipedia extract for that fixture, the lounge URL stays on `/lalem`, and no new tab or Wikipedia app is launched

#### Scenario: English image opens English extract in a modal

- **WHEN** the lounge is in English and a visitor activates a toilet card image
- **THEN** an in-page dialog shows an English Wikipedia extract for that fixture

#### Scenario: Title still opens the in-page sheet

- **WHEN** a visitor activates the toilet card title (not the image)
- **THEN** the existing in-page sheet opens on `/lalem`, and its Wikipedia control opens the in-page reader rather than leaving the lounge

#### Scenario: 医典 Wikipedia is in-app; clinic is outbound

- **WHEN** a visitor opens a 医典 article and activates the Wikipedia source
- **THEN** the in-page wiki reader opens, and a separate NHS (or other allowlisted org) control may still be an ordinary https link

### Requirement: Toilet and paper cards are 8-bit pixel sprites

Toilet and 厕纸 card images MUST be local packaged 8-bit pixel-art sprites (NES-like chunky pixels), not photographs hotlinked from the internet and not the previous smooth vector cartoons. Sprites MUST share one sprite palette that is colorful against the existing dark lounge chrome and MUST NOT use luxury gold `#c6a56a` or hot-pink `#ff4d8d`. Different `shape` values MUST still have different silhouettes; same-shape cousins MUST still differ by more than caption or a single fill swap. The lounge MUST NOT call a live image-generation model for these bitmaps.

#### Scenario: Visitor sees pixel toilets, not photos or neon vectors

- **WHEN** a visitor opens 马桶
- **THEN** each card image is a blocky pixel sprite on the dark lounge, not a photographic download and not a smooth unpixelated ellipse cartoon

#### Scenario: Different shapes stay distinct

- **WHEN** a visitor compares a sit toilet, a squat toilet, a urinal, a vacuum toilet, and a portable toilet
- **THEN** those sprites do not share the same pixel silhouette with only color changed

### Requirement: 热榜 cards use a small kind tag

热榜 cards MUST NOT lead with a large hero picture. Each card MUST show a small kind tag (for example fashion vs entertainment), then title and hook. Cards MUST remain tappable into the existing encyclopedia or lounge-copy sheet. The surface MUST still contain no playable `<video>`.

#### Scenario: Trend list is tagged, not a poster grid

- **WHEN** a visitor opens 热榜
- **THEN** they see compact rows with a small tag plus title and hook, and no large 16:10 trend picture as the primary chrome
