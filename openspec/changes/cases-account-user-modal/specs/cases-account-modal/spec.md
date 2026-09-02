## Purpose

Lets officers open account nation and logout from a compact user button beside New case on Cases, instead of a full panel in the note list.

## ADDED Requirements

### Requirement: Cases header has a user button right of New case

The Cases header SHALL keep the New case control and SHALL place a user button immediately to its right. The former full-width Account card SHALL NOT remain in the Cases scroll list. The user button SHALL be reachable on the same header row as New case on a typical phone width.

#### Scenario: Header cluster

- **WHEN** an authenticated officer opens Cases
- **THEN** New case and a user control sit together on the right side of the header, with the user control to the right of New case

#### Scenario: Account card is gone from the list

- **WHEN** an officer scrolls the Cases list (including past notes)
- **THEN** there is no standalone Account / nation / logout panel in that scroll content

### Requirement: User button opens a small account modal

Tapping the user button SHALL open a small modal (not a full-page route) that includes nation (United States and China), logout, and the signed-in display name when present. Closing the modal (dismiss control or backdrop) SHALL return to Cases without navigating away. Nation and logout SHALL keep existing account behavior.

#### Scenario: Open account modal

- **WHEN** the officer taps the user button
- **THEN** a compact modal shows nation controls, logout, and the user display name

#### Scenario: Nation still switches chrome

- **WHEN** the officer chooses China (or United States) in the modal
- **THEN** account nation updates as today (chrome language follows; officer-authored notes are not rewritten)

#### Scenario: Logout from modal

- **WHEN** the officer taps logout in the modal
- **THEN** they are signed out and sent to login as today
