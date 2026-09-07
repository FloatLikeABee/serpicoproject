## Purpose

Lets officers find Action-map pins and Pursue map tags by place name or note text, then jump the map to that pin.

## ADDED Requirements

### Requirement: Search bar on Action and Pursue maps

The Action city map and the Pursue intel map SHALL each show a search field in the page header. The field SHALL accept typed query text and SHALL be labeled for screen readers as searching places and notes.

#### Scenario: Search field is visible on Action

- **WHEN** an officer opens Action (the city pin map)
- **THEN** a search field is visible in the Action map header

#### Scenario: Search field is visible on Pursue

- **WHEN** an officer opens Pursue
- **THEN** a search field is visible in the Pursue map header

### Requirement: Query matches places or notes

A non-empty query SHALL match a pin when the query is a case-insensitive substring of any of: pin name, address/location, kind label (in the officer's language), officer notes, or AI brief text. Empty query SHALL show no result list (map pins stay as they are).

#### Scenario: Match by place name

- **WHEN** the officer types a substring of a pin's name
- **THEN** that pin appears in the search results

#### Scenario: Match by notes

- **WHEN** the officer types a substring of a pin's notes
- **THEN** that pin appears in the search results

#### Scenario: Match by AI brief

- **WHEN** the officer types a substring of a pin's AI brief
- **THEN** that pin appears in the search results

#### Scenario: Empty query hides results

- **WHEN** the search field is empty
- **THEN** no result dropdown is shown

#### Scenario: No matches

- **WHEN** the officer types a query that matches no pin
- **THEN** the UI shows that no places or notes matched

### Requirement: Action search covers the officer's pins across cities

On Action, search SHALL include the officer's loaded pins in every city, not only the city currently shown. Pursue search SHALL include that officer's Pursue map tags.

#### Scenario: Match in another Action city

- **WHEN** the officer is viewing city A and searches for a pin stored in city B
- **THEN** that pin appears in the results

#### Scenario: Pursue search stays on Pursue tags

- **WHEN** the officer searches on Pursue
- **THEN** results are Pursue map tags only, not Action pins or Cases notes

### Requirement: Choosing a result focuses the pin

Selecting a search result SHALL pan the map to that pin, highlight it, and open the pin modal. On Action, if the pin is in a different city than the one currently shown, the map SHALL switch to that pin's city first.

#### Scenario: Select a pin in the current city

- **WHEN** the officer selects a result whose pin is already on the visible map
- **THEN** the map pans to that pin and the pin modal opens

#### Scenario: Select an Action pin in another city

- **WHEN** the officer selects an Action result whose pin is in another city
- **THEN** Action switches to that city, pans to the pin, and opens the pin modal
