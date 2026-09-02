## Purpose

Pre-selects investigator nation mode from the visitor’s access area so China-area browsers open in China mode and every other area opens in United States mode, until the officer explicitly sets nation on Account.

## ADDED Requirements

### Requirement: Access area maps to China or United States mode

The system SHALL classify the current browser access **area** as either China or not-China. China area SHALL pre-select China mode. Any other area (including Hong Kong, Macau, Taiwan, the United States, and unknown) SHALL pre-select United States mode. Access area means the visitor’s geographic/network locale, not the HTTP `Origin` request header. Browser UI language alone SHALL NOT classify the area as China.

#### Scenario: Mainland China area

- **WHEN** the visitor’s access area is mainland China
- **THEN** the pre-selected mode is China

#### Scenario: United States area

- **WHEN** the visitor’s access area is the United States
- **THEN** the pre-selected mode is United States

#### Scenario: Any non-China area

- **WHEN** the visitor’s access area is France, Singapore, Hong Kong, or otherwise not mainland China
- **THEN** the pre-selected mode is United States

#### Scenario: Language is not area

- **WHEN** the browser UI language is Simplified Chinese but the access area is not mainland China
- **THEN** the pre-selected mode is United States

#### Scenario: Unknown area defaults to United States

- **WHEN** access area cannot be determined
- **THEN** the pre-selected mode is United States

### Requirement: Login chrome follows this visit’s access area

The unauthenticated Login screen SHALL use the pre-selected mode for this visit’s access area. It SHALL NOT use a previous session’s last-nation value from this device to paint Login.

#### Scenario: China visitor on a device that last used United States

- **WHEN** an unauthenticated visitor in a mainland China area opens Login and this device previously stored last-nation United States
- **THEN** Login chrome is Simplified Chinese (China mode)

#### Scenario: Non-China visitor on a device that last used China

- **WHEN** an unauthenticated visitor outside mainland China opens Login and this device previously stored last-nation China
- **THEN** Login chrome is English (United States mode)

### Requirement: Unset account nation takes the geo default; explicit Account nation wins

When the officer logs in and this account has **no stored nation**, the system SHALL persist the pre-selected access-area mode as that account’s nation (so Fleet, maps, news, and AI follow it immediately). When this account already has a stored nation from Cases → Account (United States or China), the system SHALL keep that stored nation and SHALL NOT overwrite it from access area.

#### Scenario: First login from China with no stored nation

- **WHEN** an officer logs in (including demo `serpico`) from a mainland China area and this `userId` has no stored nation
- **THEN** the account nation is China and investigator chrome after login is Simplified Chinese

#### Scenario: First login from outside China with no stored nation

- **WHEN** an officer logs in from outside mainland China and this `userId` has no stored nation
- **THEN** the account nation is United States and investigator chrome after login is English

#### Scenario: Stored China is kept when visiting from the United States

- **WHEN** the same account already has nation China and the officer logs in from a United States area
- **THEN** nation remains China

#### Scenario: Stored United States is kept when visiting from China

- **WHEN** the same account already has nation United States (explicitly chosen on Account) and the officer logs in from a mainland China area
- **THEN** nation remains United States

#### Scenario: Account control still switches nation

- **WHEN** the officer later chooses China or United States on Cases → Account
- **THEN** that choice is stored on the account and takes effect immediately, regardless of access area
