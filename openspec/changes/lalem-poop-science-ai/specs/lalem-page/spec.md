# Spec Delta

## ADDED Requirements

### Requirement: Infrequent poop-science companion bubble

While a visitor stays on `/lalem` with the document visible, the lounge MUST show a small in-page companion bubble that tells a short, funny, cute fact about defecation science. The first line MUST wait until about 90 seconds of visible sit-session time. After a line is shown or dismissed, the next line MUST NOT appear until at least eight more minutes of visible sit-session time. The companion MUST NOT use the browser Notification API, MUST NOT be a typed chat composer, MUST NOT embed `<video>`, and MUST NOT leave `/lalem` for Wikipedia. Sit-alert overlays remain the 5-minute gag and MUST stay visually above the companion; the two MUST NOT stack as two blocking dialogs.

#### Scenario: First line after a short settle

- **WHEN** a visitor has kept `/lalem` visible for about 90 seconds of sit-session time
- **THEN** a companion bubble appears with one short cute poop-science line

#### Scenario: Later lines stay infrequent

- **WHEN** that visitor is still on `/lalem` eight minutes after the previous companion line
- **THEN** a new companion line MAY appear, and no extra companion line appears in between

#### Scenario: Hidden tab does not chatter

- **WHEN** the `/lalem` document is not visible
- **THEN** the companion MUST NOT appear until the page is visible again, and visible sit time is what counts toward the next slot

#### Scenario: Dismiss waits for the next slot

- **WHEN** the visitor dismisses the companion bubble
- **THEN** it closes and MUST NOT reappear until the next eight-minute slot

#### Scenario: Sit alert stays on top

- **WHEN** a sit-alert overlay is due at the same time as a companion line
- **THEN** the sit alert is the blocking overlay, the companion is not a second modal, and `querySelector('video')` is still null

### Requirement: Companion voice is cute, specialized, and not a clinic

Each companion line MUST be funny and cute in tone. Across a visit, lines MUST cover poop science from medical, biological, social, and historical angles (one angle per line is enough). Copy MUST NOT diagnose the visitor, MUST NOT say they have a disease, and MUST NOT prescribe treatment. Medical-flavored lines MAY keep the lounge’s not-medical-advice spirit.

#### Scenario: Four science angles

- **WHEN** a visitor sits long enough to hear several companion lines
- **THEN** the lines are about poop science (medicine, biology, social custom, or history), not officer work, Fridge Raid, or unrelated news

#### Scenario: Not a diagnosis

- **WHEN** a companion line is shown
- **THEN** it does not tell the visitor they have a condition and does not prescribe a drug or procedure
