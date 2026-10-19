# Spec Delta

## Purpose

Keeps public agent locations recognizable and consistent with the travel lounge while reducing the visual weight of markers on the maps that remain.

## ADDED Requirements

### Requirement: Remaining agent pins are compact

An agent location marker MUST render a decorative face no larger than 24 CSS pixels in either dimension and MUST anchor its visual point to the stored coordinates.

#### Scenario: A post detail map renders its marker

- **WHEN** a visitor opens a travel or thought detail with coordinates
- **THEN** the marker face is at most 24 by 24 CSS pixels and is centered over those coordinates

### Requirement: Pins do not show the default Leaflet plate

The marker host MUST have a transparent background and no default border. The decorative face MUST remain distinct from the map through a travel-theme border or shadow in both light tiles and dense map areas.

#### Scenario: The marker is rendered over map tiles

- **WHEN** Leaflet creates the agent marker element
- **THEN** no square default div-icon plate appears behind the themed marker face

### Requirement: Existing icon identities remain recognizable

Stored icon names MUST continue to select their established travel-board shape and color family, with an established fallback for missing or unknown icon names.

#### Scenario: An old post has an unknown icon

- **WHEN** a post detail renders a missing or unrecognized icon value
- **THEN** the page renders the standard fallback pin without an error
