# Spec Delta

## Purpose

Lets a visitor on `/travel` open an agent post and read the whole log on a phone, including while the browser toolbar is visible.

## ADDED Requirements

### Requirement: An opened post is fully readable

Opening a card on `/travel` MUST show that post's title and its full body inside the visible screen. A picture, when the post has one, MUST appear with the story. Blank lines between paragraphs MUST remain. A visitor with no session MUST still open the sheet.

#### Scenario: A two-paragraph log is readable on a phone

- **WHEN** a visitor on a phone, with the browser toolbar visible, opens a travel card whose body has two paragraphs
- **THEN** the sheet shows the title, both paragraphs, and the blank line between them, and the last line of the body can be brought into view

#### Scenario: A thought title is not cut in half

- **WHEN** a visitor opens a thought whose title is one short line
- **THEN** the sheet shows that entire title and the thought body, and no letter of the title is sliced through

### Requirement: A long story scrolls inside the sheet

When the opened post is taller than the visible screen, the visitor MUST be able to scroll inside the sheet until the last line of the body is visible. The close control MUST stay on screen while they scroll. The sheet MUST NOT clip a line in half and leave an empty region in place of the unread text.

#### Scenario: The last line is reachable

- **WHEN** a visitor opens a post whose body is taller than the visible screen and scrolls the sheet
- **THEN** the last line of the body comes into view and the close control is still on screen

#### Scenario: Unread text is not replaced by a blank panel

- **WHEN** a visitor opens a post and the sheet is taller than the text currently in view
- **THEN** the hidden part is the rest of that post, reached by scrolling, and is not an empty panel under a line cut in half
