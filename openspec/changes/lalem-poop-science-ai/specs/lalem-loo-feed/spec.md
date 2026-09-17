# Spec Delta

## ADDED Requirements

### Requirement: Public companion GET returns one poop-science line

`GET` of the public 拉了么 companion endpoint MUST return one short locale-matched line (`cn` or `en`) about poop science. When the live text model is configured it MAY write the line; when the model is missing, errors, or returns empty/invalid text, the response MUST still be a canned cute fallback line. The line MUST NOT diagnose the visitor. Distinct calls in the same locale MAY reuse canned lines; live lines SHOULD stay on-topic (medical, biological, social, or historical defecation science).

#### Scenario: Locale-matched line

- **WHEN** a client requests the companion with locale `cn` (or `en`)
- **THEN** the body includes one non-empty text line in that lounge language

#### Scenario: Model down still speaks

- **WHEN** the live model is unset or fails
- **THEN** the GET still returns 200 with a canned cute poop-science line, not an empty error page

#### Scenario: Not a diagnosis payload

- **WHEN** the companion JSON is produced
- **THEN** the text does not claim the visitor has a disease and does not prescribe treatment
