## ADDED Requirements

### Requirement: Escalating sit-session alerts every five minutes

While a visitor stays on `/lalem`, the lounge MUST pop an in-page alert at every 5-minute boundary of the existing sit-session timer (5, 10, 15, … minutes). Each alert MUST name the elapsed sitting time. Later milestones MUST be more dramatic than earlier ones in both copy and on-screen presentation (distinct wording and a stronger visual treatment). The overlay is a lounge gag. It MUST NOT record bowel duration, diagnose, or prescribe. It MUST NOT use the browser Notification API or ask for notification permission.

#### Scenario: First five-minute pop-up names the time

- **WHEN** a visitor has kept `/lalem` open for 5 minutes of sit-session time
- **THEN** an in-page overlay appears that states they have been sitting about 5 minutes

#### Scenario: Longer sits get more dramatic

- **WHEN** the same visit later reaches a further 5-minute milestone (for example 10 minutes, then 15)
- **THEN** a new overlay appears that states the new elapsed time and is more dramatic in copy and presentation than the previous milestone

#### Scenario: Only one overlay at a time

- **WHEN** a later milestone is due while an earlier alert is still open
- **THEN** the lounge shows at most one sit alert, using the latest due milestone (more dramatic), and does not stack multiple dialogs

#### Scenario: Dismiss waits until the next milestone

- **WHEN** the visitor dismisses the sit alert
- **THEN** the overlay closes and MUST NOT reappear until the next 5-minute sit-session milestone

#### Scenario: Hidden tab does not steal the screen

- **WHEN** a 5-minute milestone occurs while the `/lalem` document is not visible
- **THEN** the overlay MUST NOT appear until the page is visible again, and once visible it MUST show the latest due milestone that was not yet dismissed

#### Scenario: Not a medical log and not an OS notification

- **WHEN** a sit alert appears
- **THEN** the copy does not diagnose or treat, the page does not prompt for notification permission, and sitting time is not saved as a health record

### Requirement: 热榜 and 有用 show the kept archive

The 热榜 surface MUST list stored entertainment/fashion trend cards newest first, not only a one-shot daily snapshot of a handful of cards. The 有用 surface MUST list stored useful notes newest first, including notes kept from previous days still inside the retention window. Curated hot videos remain on 热榜. Empty states remain when the store has nothing to show.

#### Scenario: Yesterday’s trend is still on 热榜

- **WHEN** a visitor opens 热榜 and the store already has trend cards from a previous day inside the retention window
- **THEN** those cards are still listed (newest first) together with any newer cards, each with an image

#### Scenario: Useful notes accumulate

- **WHEN** a visitor opens 有用 after more than one day of stored notes
- **THEN** they see more than one useful note, newest first, plus the not-medical-advice disclaimer
