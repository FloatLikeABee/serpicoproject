## ADDED Requirements

### Requirement: Lounge wiki summary is fetched without leaving wikipedia hosts

The lounge MUST expose a public GET that accepts a Wikipedia article URL already stored in 拉了么 catalogs, allows only `https` `zh.wikipedia.org` and `en.wikipedia.org`, and returns a title plus extract suitable for an in-page reader. Other hosts MUST be rejected. The handler MUST use Wikipedia’s public REST summary (or equivalent official extract API), MUST NOT return scraped full-page HTML, and MUST NOT call the SiliconFlow live model.

#### Scenario: Allowlisted wiki URL returns an extract

- **WHEN** a client GETs the lounge wiki endpoint with a stored `https://zh.wikipedia.org/wiki/...` URL
- **THEN** the response is success JSON with a title and extract text, and the handler does not call the live chat model

#### Scenario: Off-host URL is rejected

- **WHEN** a client GETs the lounge wiki endpoint with `https://example.com/` or a non-https URL
- **THEN** the response is an error and no upstream Wikipedia request is made
