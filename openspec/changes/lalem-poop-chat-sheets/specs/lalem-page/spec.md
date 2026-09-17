# Spec Delta

## ADDED Requirements

### Requirement: Funny poop-science chat dock

`/lalem` MUST offer a sixth dock tab for a typed chat that talks about poop science in a funny voice. The chat MUST live only on `/lalem`. It MUST NOT reuse officer `/chat` or Fridge Raid. The infrequent companion bubble MUST keep its 90-second / eight-minute cadence. Sit-alert overlays MUST stay visually above the chat. The chat MUST NOT use the Notification API, MUST NOT embed `<video>`, and MUST NOT leave `/lalem` for Wikipedia.

#### Scenario: Sixth dock opens chat

- **WHEN** a visitor taps the chat dock on `/lalem`
- **THEN** a typed composer and a transcript appear, and there are six dock buttons

#### Scenario: Funny poop reply

- **WHEN** the visitor sends a poop-related message
- **THEN** a funny lounge reply appears that stays on defecation science and does not diagnose the visitor

#### Scenario: Off-topic is steered back

- **WHEN** the visitor asks about officer work, Fridge Raid, or unrelated news
- **THEN** the reply jokes them back toward poop science instead of answering as Serpico or the kitchen

#### Scenario: Sit-alert still wins

- **WHEN** a sit-alert overlay is due while chat is open
- **THEN** the sit-alert is the blocking overlay, `querySelector('video')` is still null, and the companion cadence is unchanged

### Requirement: Photo-rich colorful bottom sheets

Card detail sheets that rise from the bottom on `/lalem` MUST show a large hero photo when the card has a local image (including 拉榜 trend JPEGs). Sheets MUST use colorful lounge chips and a brighter sheet surface than the current flat muted panel. They MUST NOT use luxury gold `#c6a56a`, MUST NOT add `wikipedia.org` `<a>` tags, and MUST NOT embed `<video>`.

#### Scenario: Toilet paper medicine sheets carry a big photo

- **WHEN** a visitor opens a 马桶, 厕纸, or 医典 card title into the bottom sheet
- **THEN** the sheet shows a large local JPEG, colorful chips or meta, and the existing body/blurb/disclaimer content

#### Scenario: 拉榜 sheet gets a picture too

- **WHEN** a visitor opens a 拉榜 trend that has a local `imageUrl`
- **THEN** the bottom sheet shows that photo plus the hook, not text-only

#### Scenario: Color without luxury gold

- **WHEN** the lounge CSS for sheets is inspected
- **THEN** it uses extra pop/accent chip colors and does not contain `#c6a56a`
