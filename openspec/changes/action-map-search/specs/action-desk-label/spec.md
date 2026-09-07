## Purpose

Shows the city pin desk as Action to officers instead of Fleet, in English and Simplified Chinese.

## ADDED Requirements

### Requirement: Officer-facing Fleet labels read Action

Every officer-visible string that currently says Fleet SHALL say Action when nation is United States, and SHALL say 行动 when nation is China. This includes bottom navigation, the Action/Investigation Helper tab, unused helper-tab catalog copy, the AI chat greeting for that desk, and the tablist accessible name.

#### Scenario: Bottom nav US

- **WHEN** an officer with United States nation views the police bottom nav
- **THEN** the item that opens the city pin desk is labeled Action

#### Scenario: Bottom nav China

- **WHEN** an officer with China nation views the police bottom nav
- **THEN** the item that opens the city pin desk is labeled 行动

#### Scenario: Desk tab US

- **WHEN** an officer with United States nation is on the city pin desk
- **THEN** the tab for the pin map is labeled Action (not Fleet)

#### Scenario: Chat greeting names Action

- **WHEN** the officer opens AI Chat from the city pin desk
- **THEN** the greeting names Action Desk, not Fleet Desk

### Requirement: Existing Action URLs and APIs keep working

Changing the visible name SHALL NOT break existing routes or marker APIs. `/chase-game`, `/investigation-helper`, and `/fleet/markers` SHALL keep working. Query `tab=fleet` SHALL still open the pin map; `tab=action` SHALL also open the pin map.

#### Scenario: Bookmark to chase-game

- **WHEN** the officer opens `/chase-game`
- **THEN** the Action pin map is shown

#### Scenario: tab=fleet still works

- **WHEN** the officer opens the desk with `tab=fleet`
- **THEN** the Action pin map is shown

#### Scenario: tab=action works

- **WHEN** the officer opens the desk with `tab=action`
- **THEN** the Action pin map is shown
