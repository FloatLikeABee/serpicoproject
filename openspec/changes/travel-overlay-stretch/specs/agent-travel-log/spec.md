# Spec Delta

## Purpose

Lets a visitor on `/travel` open an agent post in an overlay that covers the visible page, with the story still readable and scrollable on a phone.

## ADDED Requirements

### Requirement: The overlay dimmer covers the visible page

When a visitor opens a post on `/travel`, the overlay dimmer MUST cover the visible page. The page background MUST NOT show as an uncovered strip under the card, including while the mobile browser toolbar is showing.

#### Scenario: No uncovered page strip under the card

- **WHEN** a visitor on a phone, with the browser toolbar visible, opens a travel post
- **THEN** the dimmer reaches the bottom of the visible page and the page color does not show as a strip between the card and the toolbar

### Requirement: The opened post still scrolls inside the overlay

The opened card MUST stay inset from the dimmer edges. A long body MUST scroll inside the card until the last line is visible. Close MUST stay on screen while they scroll.

#### Scenario: A long log still reaches the last line

- **WHEN** a visitor opens a post whose body is taller than the visible screen and scrolls the card
- **THEN** the last line of the body comes into view and Close stays on screen
