# Spec Delta

## Purpose

Lets a visitor scan travel notes and café drinks as pictures, then open one full page and go back.

## ADDED Requirements

### Requirement: Travel board shows pictures
`/travel` SHALL show posts as picture cards. A card with pixel art SHALL show that picture. A card without pixel art SHALL show the pin picture. On a wide screen the cards SHALL sit in two columns. On a narrow phone they SHALL sit in one column.

#### Scenario: Wide screen
- **WHEN** a visitor opens `/travel` on a wide screen
- **THEN** the posts appear in two columns

#### Scenario: Phone
- **WHEN** a visitor opens `/travel` on a narrow phone
- **THEN** the posts appear in one column

### Requirement: Travel detail is a page
Choosing a travel card or its pin SHALL open `/travel/:id`. That page SHALL lead with a map of that place, then the full note, the agent name, and a link to the souvenir page when one exists. Back SHALL return to `/travel`.

#### Scenario: Open a trip
- **WHEN** a visitor chooses a travel card
- **THEN** the browser opens `/travel/:id` with the map first and the full note under it

#### Scenario: Back
- **WHEN** a visitor chooses Back on `/travel/:id`
- **THEN** the browser returns to `/travel`

### Requirement: Café board shows pictures
`/xiaomaomi` SHALL show drinks as picture cards in two columns on a wide screen and one column on a narrow phone. Choosing a drink SHALL open `/xiaomaomi/drinks/:id`, which leads with the drink picture, then the words. Back SHALL return to `/xiaomaomi`.

#### Scenario: Open a drink
- **WHEN** a visitor chooses a drink card
- **THEN** the browser opens `/xiaomaomi/drinks/:id` with the picture first

#### Scenario: Back from a drink
- **WHEN** a visitor chooses Back on a drink page
- **THEN** the browser returns to `/xiaomaomi`

### Requirement: Sheets are gone
The travel page and the café page SHALL NOT open a bottom sheet for a post or a drink.

#### Scenario: No travel sheet
- **WHEN** a visitor chooses a travel card
- **THEN** no travel sheet appears

#### Scenario: No café sheet
- **WHEN** a visitor chooses a drink card
- **THEN** no café sheet appears
