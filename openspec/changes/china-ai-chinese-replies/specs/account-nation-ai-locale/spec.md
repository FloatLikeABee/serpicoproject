## Purpose

Makes China-nation AI replies, model-down fallbacks, and leftover interview/pin chrome Simplified Chinese so officers never get English dispatch errors or English field briefs in China mode.

## ADDED Requirements

### Requirement: China AI replies are Simplified Chinese including fallbacks

When account nation is China, Chat, Interview Helper, Investigation Helper, and map-pin Create AI info SHALL return Simplified Chinese. This SHALL apply to live model output **and** to canned/fallback text used when the live model is unavailable. When nation is United States, those replies SHALL remain English as today.

#### Scenario: Interview Helper with a Chinese case brief

- **WHEN** an officer with nation China sends a Chinese case brief in Interview Helper
- **THEN** the assistant reply is Simplified Chinese and MUST NOT be the English line “Heads up — I'm having trouble reaching dispatch systems right now. Try rephrasing your question or ask about pursuit tactics, case files, or area intel.”

#### Scenario: Interview Helper when the live model is down (China)

- **WHEN** nation is China and Gemini/Mistral cannot be reached
- **THEN** Interview Helper still replies in Simplified Chinese as an interview coach (acknowledge or request a case brief) and MUST NOT tell the officer to ask about pursuit tactics or Olathe area intel

#### Scenario: Map pin Create AI info when the live model is down (China)

- **WHEN** nation is China and the officer taps Create AI info on a Pursue pin
- **THEN** the field brief is Simplified Chinese (including the “live model lookup is down” case) and MUST NOT start with English “Copy that. Live model lookup is down…”

#### Scenario: United States unchanged

- **WHEN** nation is United States and the live model is down
- **THEN** Chat and pin fallbacks remain the current English copy

### Requirement: Interview Helper and pin chrome follow China nation

When nation is China, Interview Helper tabs, welcome/example, placeholder chips, Send, and pin-modal helper lines that are still hardcoded English SHALL be Simplified Chinese. Officer-typed pin names and notes SHALL remain unchanged.

#### Scenario: Interview Helper chrome on China

- **WHEN** an officer with nation China opens Interview Helper
- **THEN** Interview / General / example / placeholder / Send appear in Simplified Chinese

#### Scenario: Pin modal leftover English on China

- **WHEN** an officer with nation China opens a map pin
- **THEN** leftover English helper lines (such as “Fill name and notes or address, then tap Create AI info”) appear in Simplified Chinese

#### Scenario: Officer notes stay as typed

- **WHEN** the officer typed Chinese notes on a pin and nation is China
- **THEN** those notes are not rewritten or translated by the locale change
