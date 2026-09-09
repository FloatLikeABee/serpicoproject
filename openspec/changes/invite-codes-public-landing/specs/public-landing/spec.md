## Purpose

Gives unauthenticated visitors a public, simple futuristic landing that introduces Serpico and a way to request an invitation by emailing Ge with a required self-introduction.

## ADDED Requirements

### Requirement: Public landing at the officer app root

Unauthenticated visitors to the officer app root path `/` SHALL see a public landing page, not the login form and not the officer dashboard. The landing SHALL be reachable without an invitation code or an account.

#### Scenario: Visitor opens the site

- **WHEN** an unauthenticated visitor opens `/`
- **THEN** they see the public landing page

#### Scenario: Signed-in officer still gets the app

- **WHEN** an authenticated officer opens `/`
- **THEN** they see the officer dashboard, not the public landing

### Requirement: Landing introduces the full app

The landing SHALL introduce Serpico as the full officer app (desk, maps, cases, and related tools) in a futuristic synthwave/neon visual style that stays simple: short copy, not a dense marketing site.

#### Scenario: Intro copy is present

- **WHEN** a visitor views the landing
- **THEN** they see the product name and a short introduction of what the app is for

### Requirement: Invitation request requires a self-introduction by email

The landing SHALL let a visitor request an invitation by composing email to `ge.gao.0039@gmail.com`. The request MUST include a self-introduction so Ge can decide. The visitor MUST provide at least their name and a self-introduction of who they are and why they want access before the mail compose opens. The system MUST NOT send the email from the server and MUST NOT store invitation requests in an in-app queue.

#### Scenario: Complete request opens mail

- **WHEN** a visitor fills name and a self-introduction (who they are and why they want access) and chooses to send
- **THEN** their mail client opens a message to `ge.gao.0039@gmail.com` whose body includes that name and self-introduction

#### Scenario: Incomplete request is blocked

- **WHEN** a visitor tries to send without a name or without a self-introduction
- **THEN** the mail client is not opened and the missing fields are indicated

### Requirement: Landing links to redeem and sign-in

The landing SHALL provide a way to open the invitation-code page and the existing sign-in page.

#### Scenario: Has a code

- **WHEN** a visitor on the landing chooses to enter an invitation code
- **THEN** they reach the public redeem page

#### Scenario: Already has credentials

- **WHEN** a visitor on the landing chooses to sign in
- **THEN** they reach the officer login page

### Requirement: Redeem page is public

The invitation-code page SHALL be reachable without being signed in.

#### Scenario: Unauthenticated redeem

- **WHEN** an unauthenticated visitor opens the invitation-code page
- **THEN** they can enter a code without being redirected to login
