# Spec Delta

## ADDED Requirements

### Requirement: 医典 dock is a photo gallery

The 医典 dock on `/lalem` MUST list every medicine-catalog article as a photo card, not a text-only row. Each card MUST show the article’s local photograph and title. Activating the image MUST open the existing in-app wiki reader via the lounge wiki GET for that article’s locale-matched Wikipedia source. Activating the title MUST open the in-page article sheet on `/lalem`. The document MUST NOT contain a `wikipedia.org` `<a>`, MUST NOT embed `<video>`, and MUST NOT leave `/lalem` for Wikipedia. Allowlisted medical-organization https links MAY remain ordinary outbound links on the sheet.

#### Scenario: 医典 shows fifty photo cards

- **WHEN** a visitor opens 医典 on `/lalem`
- **THEN** they see at least 50 article cards, each with a local photograph and title, not a text-only pamphlet

#### Scenario: Image opens in-app wiki; title opens the sheet

- **WHEN** a visitor activates an 医典 card image and later activates that card’s title
- **THEN** the image opens the in-app wiki reader on `/lalem` and the title opens the article sheet, with no `wikipedia.org` `<a>` and `querySelector('video')` null

#### Scenario: Sheet still shows encyclopedia copy and the photo

- **WHEN** a visitor opens an 医典 article sheet
- **THEN** they see the photograph, the not-medical-advice disclaimer, the CN/EN body, Wikipedia via the in-app reader, and an allowlisted medical-organization https link

### Requirement: 医典 photographs stay encyclopedia-safe

医典 card and sheet photographs MUST depict toilet-adjacent encyclopedia subjects (fixtures, hygiene, food or fiber, sanitation infrastructure, or calm anatomy diagrams). They MUST NOT show lesions, gore, clinical examination photography, or imagery that diagnoses the visitor. Two different article ids MUST NOT share the same packaged image file bytes.

#### Scenario: Cards are not clinical shock photos

- **WHEN** a visitor scrolls the 医典 gallery
- **THEN** the photographs look like lounge encyclopedia cards (objects, rooms, diagrams), not a dermatology atlas or an exam-room series
