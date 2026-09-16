## ADDED Requirements

### Requirement: Lounge chrome is a calm dark theme

The `/lalem` page MUST use a dark, modern visual system: ink or slate page background, slightly lifted surfaces for cards and sheets, and a muted accent for selected controls. Body text MUST remain readable against those surfaces (comfortable contrast, not thin gray on black). The lounge MUST NOT use a hot-pink selected fill as the primary selected state, MUST NOT paint candy gold/pink radial glows or repeating stripe wallpaper on the page, and MUST NOT adopt the unmerged luxury gold token `#c6a56a` from PR #104. Catalog illustration files MAY keep their own drawing colors. Officer pages, Fridge Raid, and landing MUST keep their existing themes.

#### Scenario: Visitor opens 拉了么 in the dark lounge

- **WHEN** a visitor loads `/lalem`
- **THEN** the lounge background is dark (not a light paper page and not a brown-pink neon wash), selected dock/chip state is a quiet accent rather than hot pink, and the officer synth dashboard is not the page chrome

#### Scenario: Luxury gold is absent

- **WHEN** a visitor uses `/lalem`
- **THEN** the lounge styles do not use `#c6a56a`, and Fridge Raid / officer Navigation are unchanged

### Requirement: Lounge layout is aligned on one grid and gutter

Header, scroll body, galleries, lists, sheet, and the five-item dock MUST share one horizontal inset (gutter) and line up on a column grid. Filter rows MUST keep labels in a dedicated column with chips wrapping at a shared height. Gallery cards MUST sit on a two-column grid with equal column widths; title and meta MUST occupy reserved rows so a longer title does not drop the neighboring card’s footer. Dock buttons MUST be equal-width in one row (wrapping only if the viewport is too narrow for five readable labels). Empty space around the column MUST use the same page background so the lounge does not look like a misaligned card floating in a different-colored void.

#### Scenario: Cards and dock share edges

- **WHEN** a visitor views 马桶 or 厕纸 on a typical phone-width lounge
- **THEN** gallery columns are equal, card images share one aspect ratio, and the dock’s left and right edges match the gallery’s

#### Scenario: Filter labels form a column

- **WHEN** a visitor looks at the toilet filter rows
- **THEN** the shape/size/class/era labels stack in one vertical alignment, and chips in each row share one height

#### Scenario: Uneven titles do not break the grid

- **WHEN** one toilet title wraps to two lines and its neighbor does not
- **THEN** both cards still sit on the same row grid and their bottom edges align
