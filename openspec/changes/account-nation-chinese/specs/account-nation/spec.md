## Purpose

Lets each officer pick a nation on their account so the app’s language, default map city, and crime news match that nation and follow them across sessions.

## ADDED Requirements

### Requirement: Nation is set on the Cases Account panel

The officer SHALL choose nation from the Cases screen Account section. Allowed values SHALL be United States and China. The control SHALL be bound to the logged-in account, not a device-only preference that ignores `userId`.

#### Scenario: Open Account on Cases

- **WHEN** an authenticated officer opens Cases
- **THEN** the Account section includes a Nation control with United States and China

#### Scenario: Selection is stored on this account

- **WHEN** the officer selects China and later logs in as the same user on this or another session
- **THEN** nation is still China

#### Scenario: Another account does not inherit nation

- **WHEN** officer A has China selected and officer B (different `userId`) logs in
- **THEN** officer B sees officer B’s nation (default United States if unset), not officer A’s

### Requirement: China nation uses Simplified Chinese chrome

When the account nation is China, all product chrome the officer sees in the investigator app (navigation, buttons, labels, empty states, Fleet/Pursue/Board/Chat/Cases/Investigation Helper, and authenticated shell) SHALL be Simplified Chinese. When nation is United States, chrome SHALL remain English as today.

#### Scenario: Switch to China translates chrome

- **WHEN** the officer sets nation to China
- **THEN** bottom nav, Fleet, Cases Account, and other investigator chrome appear in Simplified Chinese without requiring a full reinstall

#### Scenario: Switch back to United States restores English

- **WHEN** the officer sets nation to United States after using China
- **THEN** chrome returns to English

#### Scenario: Officer-authored text is not rewritten

- **WHEN** the officer has typed case notes or pin names in any language
- **THEN** those stored strings remain unchanged when nation changes

### Requirement: China nation defaults maps to Shanghai

When nation is China, the Fleet city list SHALL include Chinese cities with **Shanghai** as the default if this account has no saved city for that nation. Pursue’s map SHALL open on Shanghai (not Olathe). When nation is United States, Fleet keeps the current US city list and Olathe default.

#### Scenario: First open of Fleet on a China account

- **WHEN** an officer with nation China opens Fleet and has no saved city for China
- **THEN** the map is centered on Shanghai and the city control lists Chinese cities

#### Scenario: First open of Pursue on a China account

- **WHEN** an officer with nation China opens Pursue
- **THEN** the map is Shanghai, not Olathe

#### Scenario: US account unchanged

- **WHEN** an officer with nation United States opens Fleet
- **THEN** the default city remains Olathe (unless they already saved another US city)

### Requirement: China nation shows China crime news

Board cases/briefings and daily crime intel used by the investigator app SHALL be China-focused when nation is China (Chinese queries/sources and Chinese-language cards where the pipeline produces copy). United States accounts SHALL keep the existing US/world crime news behavior.

#### Scenario: Board on a China account

- **WHEN** an officer with nation China opens Board
- **THEN** listed cases and briefings concern China crime / missing-person / cold-case / fugitive items rather than US NamUs/FBI-default copy

#### Scenario: Board on a US account

- **WHEN** an officer with nation United States opens Board
- **THEN** cases and briefings remain the US/world feed used today

### Requirement: AI replies follow account nation

Chat, map-pin field briefs, and other model-generated investigator text SHALL be Simplified Chinese when nation is China and English when nation is United States.

#### Scenario: AI Chat on a China account

- **WHEN** an officer with nation China sends a chat message
- **THEN** the assistant reply is Simplified Chinese

#### Scenario: AI Chat on a US account

- **WHEN** an officer with nation United States sends a chat message
- **THEN** the assistant reply is English as today
