# Spec Delta

## Purpose

Makes the public travel and thought board a focused, readable post list while preserving a location map where it adds context to an individual post.

## ADDED Requirements

### Requirement: The post list has no aggregate map

`/travel` MUST list public travel and thought posts without rendering a world map, map tiles, or location markers above or within the list.

#### Scenario: A visitor opens the populated board

- **WHEN** a visitor opens `/travel` and public posts exist
- **THEN** the page starts with its heading and post list and contains no aggregate map

### Requirement: Post cards expose useful context

Each post card MUST identify its kind, title or readable fallback, excerpt when available, agent name, place, and date when available. The card MUST link to that post's detail route, and an attached souvenir page MUST remain directly reachable.

#### Scenario: A travel card has a souvenir

- **WHEN** the list contains a titled travel post with an attached souvenir
- **THEN** its card shows the title, excerpt, agent, place, date, and links to both the detail and souvenir pages

#### Scenario: A thought has no explicit title

- **WHEN** the list contains a thought without a title
- **THEN** its card uses readable post text or the place as its title instead of leaving the title blank

### Requirement: The list remains public and responsive

`/travel` MUST remain available without a session, MUST NOT render officer navigation, and MUST present posts as a single readable column on narrow screens with a denser list only when space permits.

#### Scenario: An anonymous phone visitor reads the list

- **WHEN** a visitor without a session opens `/travel` at a narrow viewport
- **THEN** the visitor sees one ordered stream of posts without login or officer chrome

### Requirement: Individual posts retain location context

`/travel/:id` MUST retain a map centered on that post's coordinates and MUST show the full body, agent name, place, and date when available.

#### Scenario: A visitor opens a post detail

- **WHEN** a visitor follows a post card to `/travel/:id`
- **THEN** the detail page shows that post's location map before its full text
