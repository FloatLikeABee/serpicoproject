## Purpose

Lets admins register a hardware serial number to a dedicated MQTT topic and inspect (and test) hard-data payloads received on that topic.

## ADDED Requirements

### Requirement: Admin can register hardware serial to an MQTT topic

An authenticated admin SHALL be able to register a hardware serial number and receive an MQTT topic under the existing hard-data prefix (`serpico/hard-data/…`). The serial SHALL be unique. Registering an already-registered serial SHALL return the existing topic (not a second device). Invalid empty serials SHALL be rejected. Officer nav SHALL NOT gain a link to this registry. The unlisted `/x-hard-data` partner page SHALL remain.

#### Scenario: New serial gets a topic

- **WHEN** an admin submits serial `SN-1001` that is not yet registered
- **THEN** the system stores the device and returns an MQTT topic under `serpico/hard-data/` that includes a stable identifier derived from that serial

#### Scenario: Same serial is idempotent

- **WHEN** an admin registers `SN-1001` again
- **THEN** the response is the same topic as the first registration and no duplicate device is created

#### Scenario: Empty serial rejected

- **WHEN** an admin submits an empty serial
- **THEN** registration fails with a client error and no device is stored

### Requirement: Admin registry list and per-device data table

The admin app SHALL list registered devices (serial, topic, created time). Choosing a device SHALL open a test/data page that lists hard-data records for that device’s topic (newest first), including MQTT-sourced rows. Unauthenticated visitors SHALL NOT see these admin pages (existing admin login gate).

#### Scenario: Dashboard entry

- **WHEN** an admin is signed in on the admin home
- **THEN** they see a Hardware registry module and can open the registry without using the officer app

#### Scenario: Per-topic table shows MQTT rows

- **WHEN** a message has been stored as hard data on that device’s topic with source `mqtt`
- **THEN** the device data table includes that payload, topic, source, and received time

#### Scenario: Other devices’ data is excluded

- **WHEN** hard data exists on a different topic
- **THEN** it does not appear on this device’s table

### Requirement: Admin can send a test payload on the device topic

The per-device page SHALL allow sending a test payload to that device’s MQTT topic. After a successful test, the table SHALL refresh so the new row is visible.

#### Scenario: Test publish appears in the table

- **WHEN** an admin sends a test payload from the device page
- **THEN** a hard-data row for that topic appears in the table with the test payload
