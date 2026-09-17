## REMOVED Requirements

### Requirement: Toilet and paper cards are 8-bit pixel sprites
**Reason:** Visitors asked for real interesting photographs of toilets and 厕纸, not NES line sprites. The pixel-sprite rule is the thing they are looking at and rejecting.
**Migration:** Serve locally packaged raster photographs as the card image. Keep the in-app wiki reader on the image control. Do not revive hotlinked Wikimedia URLs as the bitmap.

### Requirement: 热榜 cards use a small kind tag
**Reason:** The dock is renamed 拉榜, and visitors still want a picture — a small funny thumbnail, not a tag-only row and not a 16:10 poster.
**Migration:** 拉榜 rows show a compact local photo plus the existing kind tag, title, and hook. No `<video>`.

### Requirement: Lounge chrome is a calm dark theme
**Reason:** The near-black calm tokens feel like a cave. Visitors still want dark mode, but colorful and fun.
**Migration:** Fun-dark `--ll-*` tokens on `html.ll-world` only. Keep `color-scheme: dark`. Do not merge luxury gold PR #104. Do not restyle officer Navigation, Fridge Raid, or landing.

## ADDED Requirements

### Requirement: Fourth dock is named 拉榜

The fourth lounge dock MUST be labeled **拉榜** in Simplified Chinese and **La bang** in English. Visitor-facing chrome that named this surface 热榜 (dock button, empty-state copy, sit-alert lines that name the dock) MUST use 拉榜 / La bang instead. The dock still sits in the same five-item row (马桶 / 厕纸 / 医典 / 拉榜 / 有用). Officer Navigation MUST still have no 拉了么 entrance.

#### Scenario: Chinese dock says 拉榜

- **WHEN** a visitor on `/lalem` in Simplified Chinese looks at the lounge dock
- **THEN** the fourth dock control is labeled 拉榜 and is not labeled 热榜

#### Scenario: English dock says La bang

- **WHEN** a visitor toggles the lounge to English
- **THEN** the fourth dock control is labeled La bang and is not labeled Hot

#### Scenario: Empty 拉榜 copy follows the new name

- **WHEN** 拉榜 has no trends yet
- **THEN** the empty-state copy names 拉榜 (Chinese) or La bang (English), not 热榜 / Hot

### Requirement: Toilet and paper cards are real packaged photographs

Toilet and 厕纸 card images on `/lalem` MUST be real photographs of interesting, good-looking fixtures or wiping tools, sourced from the open internet and packaged locally with the app. They MUST NOT be 8-bit pixel sprites, MUST NOT be simple line-and-shape drawings, and MUST NOT be hotlinked at runtime from Wikimedia, Unsplash, or any other third-party CDN. Different `shape` values MUST still look like different fixtures; same-shape cousins MUST still differ by more than caption. Image controls MUST still open the in-app wiki reader (no `wikipedia.org` `<a>`). The lounge MUST NOT call a live image-generation model for these bitmaps. Photos MUST NOT show an identifiable person using a toilet.

#### Scenario: Visitor sees real toilets, not sprites

- **WHEN** a visitor opens 马桶
- **THEN** each card image is a photographic picture of a real fixture, not a pixel-rect sprite and not a line cartoon, and the image URL is a local `/lalem/toilets/` pack path

#### Scenario: 厕纸 cards are photos too

- **WHEN** a visitor opens 厕纸
- **THEN** each card image is a photographic picture of that wiping tool or method, served from a local `/lalem/papers/` pack path, not an SVG sprite

#### Scenario: Shapes stay distinct in photographs

- **WHEN** a visitor compares a sit toilet, a squat toilet, a urinal, a vacuum toilet, and a portable toilet
- **THEN** those photographs depict different fixture types, not the same photo recolored or recropped as the only difference

#### Scenario: Image still opens the in-app wiki reader

- **WHEN** a visitor activates a toilet card image
- **THEN** the in-page wiki reader opens on `/lalem` and the lounge does not navigate to wikipedia.org

### Requirement: 拉榜 rows show a small funny thumbnail and a kind tag

拉榜 cards MUST lead with a **small** local photograph that looks funny or interesting (not a huge 16:10 poster and not a sterile label graphic), plus the existing kind tag, title, and hook. The thumbnail MUST be clearly smaller than a 马桶 gallery card image. Cards MUST remain tappable into the existing encyclopedia or lounge-copy sheet. The surface MUST still contain no playable `<video>`. Trend images MUST be local pack paths, not hotlinks.

#### Scenario: 拉榜 is a compact pictured list

- **WHEN** a visitor opens 拉榜
- **THEN** each row shows a small thumbnail image, a kind tag, a title, and a hook, and the thumbnail is not a 16:10 hero filling the card

#### Scenario: Mapped trend still opens encyclopedia

- **WHEN** a visitor activates a 拉榜 row that maps to a 医典, 厕纸, or toilet topic
- **THEN** an in-page sheet opens with that curated content, without leaving `/lalem` and without playing a video

### Requirement: Lounge chrome is a fun dark theme

The `/lalem` page MUST stay in dark mode (`color-scheme: dark`) but MUST use a playful night-stall palette: a lifted (not near-black) page background, warmer surfaces, readable warm body text, and a saturated mint-or-coral accent for selected controls. The lounge MUST NOT use near-black calm ink `#12161c` as the page background, MUST NOT use a hot-pink selected fill `#ff4d8d` as the primary selected state, MUST NOT paint candy gold/pink radial glows or repeating stripe wallpaper on the page, and MUST NOT adopt the unmerged luxury gold token `#c6a56a` from PR #104. Layout alignment (one gutter, two-column gallery, five equal dock buttons, filter label column) MUST stay. Officer pages, Fridge Raid, and landing MUST keep their existing themes.

#### Scenario: Visitor opens a colorful dark lounge

- **WHEN** a visitor loads `/lalem`
- **THEN** the page is dark mode, the background is visibly lighter and more colorful than near-black `#12161c`, selected dock/chip state uses a saturated accent rather than hot pink, and the officer synth dashboard is not the page chrome

#### Scenario: Luxury gold and cave black stay absent

- **WHEN** a visitor uses `/lalem`
- **THEN** the lounge styles do not use `#c6a56a`, do not use `#12161c` as `--ll-bg`, and Fridge Raid / officer Navigation are unchanged
