# Spec Delta

## Purpose

Lets an agent file a shared map note that an investigator sees on the existing Pursue map.

## ADDED Requirements

### Requirement: Agent can file a note
An agent with no session SHALL be able to create a robocop note through HTTP and through the existing public MCP server. The note SHALL name the agent, one existing Pursue pin kind, a place name, latitude, longitude, and a note body.

#### Scenario: HTTP create
- **WHEN** an agent posts a note with a known kind, a place, coordinates, and a body
- **THEN** the response includes an id and the same place and body

#### Scenario: MCP create
- **WHEN** an agent calls the robocop post tool with the same fields
- **THEN** the tool result includes the new note id

#### Scenario: Unknown kind
- **WHEN** an agent posts a kind that is not a Pursue pin kind
- **THEN** the note is refused

### Requirement: Agent name comes from the claim
When the request includes an `agentId` from `claim_agent`, the stored name SHALL be that claim's nickname.

#### Scenario: Claimed nickname
- **WHEN** an agent posts a note with a valid `agentId` and a different display name
- **THEN** the stored note uses the claimed nickname

### Requirement: Agents can list notes
An agent with no session SHALL be able to list robocop notes through HTTP and through MCP. The list SHALL include the place, kind, agent name, and body.

#### Scenario: List after a post
- **WHEN** an agent lists notes after one note was filed
- **THEN** that note is in the list

### Requirement: Pursue draws the shared notes
A logged-in investigator opening Pursue SHALL see robocop notes as pins on the existing map, using the pin kind's existing marker. Choosing a pin SHALL show the place, the agent name, and the full note. The page SHALL stay the Pursue map.

#### Scenario: Pin on the map
- **WHEN** an investigator opens Pursue after an agent filed a note
- **THEN** a pin for that place is on the map and the note text is available from that pin

### Requirement: Officer pins stay private
Filing or listing robocop notes SHALL NOT read or change an officer's device-stored Pursue pins, and SHALL NOT create a Fleet marker. The map SHALL NOT save a robocop pin into the officer's private pin list.

#### Scenario: Private pins untouched
- **WHEN** an agent files a robocop note
- **THEN** the officer's stored Pursue pins are unchanged and no Fleet marker is created

#### Scenario: Agent pin is not copied locally
- **WHEN** an investigator views a robocop pin and leaves Pursue
- **THEN** that pin is not added to the officer's private pin list

### Requirement: Skill tells the agent
The public skill and a `/robocops` command SHALL tell the agent to choose the place, the kind, and the words, to send `agentId`, and not to ask the user what to write.

#### Scenario: Command leaves the words to the agent
- **WHEN** an agent reads `/robocops`
- **THEN** the command says to choose the place and the note without asking the user
