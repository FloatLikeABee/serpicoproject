## Purpose

Defines the investigator-facing visual identity: dark deep-blue police surfaces, bright accent highlights, and game-like chrome reduced, without changing product behavior.

## ADDED Requirements

### Requirement: Dark deep-blue surfaces

The app SHALL present primary surfaces (page background, app shell, panels, headers, and navigation chrome) as a dark, deep-blue police-force palette. Purple-void, magenta-tinted, and arcade-black backgrounds SHALL NOT be used as the default theme.

#### Scenario: Logged-in shell uses navy surfaces

- **WHEN** an authenticated user views any police or civilian page
- **THEN** the page background and primary panels appear dark navy / deep blue rather than purple-black synthwave

#### Scenario: Unauthenticated login matches the same theme

- **WHEN** a user opens the login screen
- **THEN** the login chrome uses the same dark deep-blue surfaces as the rest of the app

### Requirement: Bright highlight accents

Interactive and status accents (primary buttons, focus rings, active navigation, links, alerts, and key labels) SHALL use bright, high-contrast highlight colors on the dark-blue surfaces. Accents SHALL NOT be dull, desaturated, or low-contrast against the background.

#### Scenario: Primary action is clearly highlighted

- **WHEN** a user views a primary action control (for example Save, Create AI info, or Login)
- **THEN** the control uses a bright accent that stands out from the dark-blue surface and remains readable

#### Scenario: Active navigation is distinguishable

- **WHEN** a user is on a given nav destination
- **THEN** the active nav item uses a bright highlight distinct from inactive items

#### Scenario: Alerts and destructive actions stay visible

- **WHEN** a user sees an error, delete, or other warning control
- **THEN** that control uses a bright warning or danger accent, not a muted or washed-out color

### Requirement: Reduced game chrome

The UI SHALL NOT present arcade or game HUD styling as the default look. CRT scanline overlays SHALL NOT appear. Display type SHALL read as a professional operations tool rather than a sci-fi game title.

#### Scenario: No scanline overlay

- **WHEN** a user views any screen
- **THEN** no CRT scanline overlay is visible over the app

#### Scenario: Headings are operational, not arcade

- **WHEN** a user reads page titles and section headings
- **THEN** the typeface and letterspacing look like a professional app, not a game HUD wordmark

### Requirement: Theme change does not alter behavior

Retheming SHALL be visual only. Existing screens, routes, controls, maps, chat, notes, and data flows SHALL keep the same behavior, labels, and interaction targets. Existing CSS class names used by the app (`game-panel`, `hud-nav`, `btn-neon-primary`, `synth-*`, `neon-*`, and equivalent) SHALL continue to style the same elements so functionality is not broken by class renames.

#### Scenario: Controls still work after retheme

- **WHEN** a user performs an existing flow (login, open Fleet or Pursue, drop a map pin, save notes, send chat)
- **THEN** each step completes as before; only colors, shadows, and type treatment differ

#### Scenario: Class-based chrome still wraps the same UI

- **WHEN** a screen uses existing panel, header, input, or button utility classes
- **THEN** those classes still apply to the same components and do not hide, disable, or reposition controls
