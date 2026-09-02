## Purpose

Keeps Fleet map pin type, name, location, notes, and AI location brief after the officer generates AI info and after they leave Fleet and return.

## ADDED Requirements

### Requirement: Officer pin fields persist after AI generate and Save

After the officer sets type, name, location, and notes on a Fleet pin and generates AI info, Save SHALL persist those officer fields and the AI brief for that pin. Reloading Fleet or opening the same pin SHALL show the saved type, name, location, notes, and AI brief.

#### Scenario: Save after Create AI info

- **WHEN** the officer fills type, name, location, and notes, taps Create AI info, then taps Save
- **THEN** those fields and the AI brief remain on that pin after the modal closes

#### Scenario: Return to Fleet after Save

- **WHEN** the officer has saved a pin as above, then opens another module and returns to Fleet
- **THEN** the pin still has the same type, name, location, notes, and AI brief

### Requirement: Draft pin content persists when leaving the modal or Fleet

Type, name, location, notes, and any generated AI brief SHALL persist when the officer closes the pin modal (including ✕ / backdrop) or navigates away from Fleet, even if they did not tap Save after editing. Closing SHALL NOT discard filled officer fields back to the empty drop-create defaults.

#### Scenario: Close modal without Save

- **WHEN** the officer fills type, name, location, and notes (and optionally generates AI info) then closes the modal without tapping Save
- **THEN** reopening that pin shows the filled fields and AI brief if one was generated

#### Scenario: Switch modules with the modal open

- **WHEN** the officer has filled those fields (and optionally generated AI info) then opens Cases, Pursue, Board, or Chat and returns to Fleet
- **THEN** the pin still has those fields and the AI brief if one was generated

### Requirement: Location mapping does not wipe officer content

Automatic or later address/coordinate mapping SHALL update location only. It SHALL NOT replace the officer's type, name, notes, or AI brief with empty drop-create values.

#### Scenario: Geocode finishes after the officer typed notes

- **WHEN** a new pin's street address is mapped after the officer already typed name and notes
- **THEN** the mapped location is stored and the typed name and notes remain

### Requirement: Same pin id can be created then updated without losing fields

Creating a Fleet pin on map tap and later saving the same pin id SHALL succeed even if the first create is still in flight or already stored. A failed duplicate create SHALL NOT leave the server on empty defaults while the officer's later save is dropped.

#### Scenario: Save while drop-create is in flight

- **WHEN** the officer drops a pin, immediately fills notes, and saves before the first create response returns
- **THEN** the saved notes (and other officer fields) are the stored values for that pin id

### Requirement: Server list does not erase newer device pin fields

When Fleet loads markers from the server, it SHALL NOT replace a pin's newer device-cached type, name, location, notes, or AI brief with older or empty server values for the same pin id.

#### Scenario: Remount with richer local pin than server

- **WHEN** Fleet remounts and the device cache has newer officer fields for a pin than the server list
- **THEN** those newer fields remain visible until a successful server save of that pin
