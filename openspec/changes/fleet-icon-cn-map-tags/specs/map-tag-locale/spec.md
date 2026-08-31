## Purpose

Makes Fleet’s bottom-nav icon match the size of the other police icons, and makes Fleet and Pursue map-tag type labels Simplified Chinese in China mode.

## ADDED Requirements

### Requirement: Fleet nav icon matches sibling icon size

The Fleet item in the police bottom navigation SHALL use a graphic that occupies approximately the same visual size as the Pursue, Board, Chat, and Cases icons (same 20×20 layout box, artwork filling most of the 24×24 viewBox rather than a small car sitting on the baseline).

#### Scenario: Fleet icon is not the smallest in the bar

- **WHEN** an officer views the police bottom navigation
- **THEN** the Fleet icon is visually comparable in size to the adjacent Pursue and Board icons (not a tiny vehicle in the lower third of the cell)

### Requirement: China tag types on Fleet and Pursue are Simplified Chinese

When account nation is China, Fleet and Pursue **tag type** chips, map banners that name the selected type, and the pin-modal type header/dropdown SHALL show Simplified Chinese labels. Single-letter glyphs MAY stay. When nation is United States, those labels SHALL remain English as today.

#### Scenario: Pursue tag chips on China

- **WHEN** an officer with nation China opens Pursue
- **THEN** the tag-type chips (Officer, Staff, PD car, Station, Perp, Suspect, Investigation, Witness, Evidence, and the rest) appear in Simplified Chinese, not English words such as “Officer” or “Investigation”

#### Scenario: Fleet tag chips on China

- **WHEN** an officer with nation China opens Fleet
- **THEN** the tag-type chips (Station, Staff, Vehicle, Scene) appear in Simplified Chinese

#### Scenario: Pin modal type on China

- **WHEN** an officer with nation China opens a Fleet or Pursue pin
- **THEN** the type header and type dropdown options are Simplified Chinese (not hardcoded English “Investigation” / “Station / facility”)

#### Scenario: United States unchanged

- **WHEN** nation is United States
- **THEN** Fleet and Pursue tag-type labels remain English

#### Scenario: Officer pin names stay as typed

- **WHEN** the officer already saved a pin name or notes
- **THEN** those stored strings are not rewritten when nation or tag-label catalogs change
