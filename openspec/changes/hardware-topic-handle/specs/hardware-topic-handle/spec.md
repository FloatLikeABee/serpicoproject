## Purpose

Lets a registered hardware owner open a stable unlisted URL derived from their MQTT topic and see only that device’s stored hard data.

## ADDED Requirements

### Requirement: Registered serial has a public topic handle

Each hardware serial that exists in the registry SHALL have an unlisted frontend URL whose path includes `hw/{SERIAL}` matching MQTT topic `serpico/hard-data/hw/{SERIAL}` (serial normalized the same way as registration: trim, uppercase, `[A-Z0-9._-]+`). The page SHALL be reachable without officer login. Officer Navigation and Login SHALL NOT gain a link to these handles. The existing `/x-hard-data` docs page SHALL remain.

#### Scenario: Owner opens their handle

- **WHEN** serial `SN001` is registered and someone opens `/x-hard-data/hw/SN001` (or equivalent case `sn001`) without logging in
- **THEN** the page identifies MQTT topic `serpico/hard-data/hw/SN001` and shows a data table for that topic

#### Scenario: Unregistered serial is not a table

- **WHEN** someone opens `/x-hard-data/hw/NOTREGISTERED` and that serial is not in the registry
- **THEN** they do not see other devices’ hard data (not-found / not registered)

#### Scenario: Handle stays off officer nav

- **WHEN** an officer uses the main app Navigation or Login
- **THEN** there is no link to `/x-hard-data/hw/…`

### Requirement: Handle list is only that topic

The handle page SHALL list stored hard-data records for the registered device’s topic only (newest first), including MQTT-sourced rows. Records on any other topic SHALL NOT appear. The page MUST NOT load the unfiltered global hard-data list.

#### Scenario: Own MQTT row appears

- **WHEN** a message is stored as hard data on `serpico/hard-data/hw/SN001` with source `mqtt`
- **THEN** the SN001 handle table includes that payload, topic, source, and received time

#### Scenario: Other topics excluded

- **WHEN** hard data exists on `serpico/hard-data/demo` or another hardware serial’s topic
- **THEN** those rows do not appear on the SN001 handle page
