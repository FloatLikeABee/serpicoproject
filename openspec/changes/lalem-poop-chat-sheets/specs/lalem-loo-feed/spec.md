# Spec Delta

## ADDED Requirements

### Requirement: Public chat POST returns a funny poop reply

`POST` of the public 拉了么 chat endpoint MUST accept a locale (`cn` or `en`) and a visitor message and MUST return one funny poop-science reply. When the live text model is configured it MAY write the reply; when the model is missing, errors, or returns empty/invalid/diagnostic text, the response MUST still be a canned funny poop fallback. Distinct calls MAY reuse canned lines. The reply MUST NOT diagnose the visitor.

#### Scenario: Locale-matched reply

- **WHEN** a client posts a chat message with locale `cn` (or `en`)
- **THEN** the body includes one non-empty reply in that lounge language

#### Scenario: Model down still jokes

- **WHEN** the live model is unset or fails
- **THEN** the POST still returns 200 with a canned funny poop line, not an empty error page

#### Scenario: Not a diagnosis payload

- **WHEN** the chat JSON is produced
- **THEN** the reply does not claim the visitor has a disease and does not prescribe treatment
