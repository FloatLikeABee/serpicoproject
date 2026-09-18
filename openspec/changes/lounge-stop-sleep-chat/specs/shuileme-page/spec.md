# Spec Delta

## ADDED Requirements

### Requirement: Wake stop ends the lie session in place

`/shuileme` MUST show a header control labeled 醒了 (EN: I'm up) that ends the current lie session without leaving the page. Activating it MUST stop sound playback, freeze the 已躺 timer, and MUST NOT open officer Navigation, Fridge Raid, or `/lalem`. A second tap MUST be a no-op. The control MUST NOT use the Notification API.

#### Scenario: 醒了 freezes the clock and stops sound

- **WHEN** a visitor has started a sound scene and then taps 醒了
- **THEN** playback is stopped, the 已躺 value no longer increases, the heading is still 睡了么, and the location stays `/shuileme`

#### Scenario: 醒了 does not navigate away

- **WHEN** a visitor taps 醒了
- **THEN** there is no officer `navigation`, `html` still has class `sm-world`, and no request is made to `/lalem/*`

### Requirement: Sixth dock is a boring lecture chat

`/shuileme` MUST offer six dock tabs: beds (床), bedrooms (卧), sleep lore (典), sound (声), wind-down (息), and chat (聊 / Chat). The chat dock MUST show a transcript and a `<textarea>` composer. Replies MUST be dry lectures on law, science, or math in short easy sentences. Replies MUST NOT joke, MUST NOT diagnose, and MUST NOT contain `you have` or `你患有`. Off-topic asks (officer work, Fridge Raid, poop, news) MUST be steered back to a dull lecture. The client MUST POST only to the 睡了么 chat endpoint, never `/lalem/*`. The dock MUST NOT use the Notification API and MUST NOT embed `<video>`.

#### Scenario: Dock is six buttons including chat

- **WHEN** the lounge renders
- **THEN** there are six `.sm-dock` buttons and the chat dock contains a `textarea`

#### Scenario: Boring lecture reply

- **WHEN** the visitor sends a message on the 聊 dock
- **THEN** a dry law, science, or math reply appears in short sentences and does not contain `you have` or `你患有`

#### Scenario: Off-topic is steered to a dull lecture

- **WHEN** the visitor asks about officer work, Fridge Raid, or poop
- **THEN** the reply returns to an easy law, science, or math lecture instead of answering as Serpico, the kitchen, or 拉了么

### Requirement: Sleepy thinking indicator while chat is busy

While a 睡了么 chat request is in flight, the transcript MUST show a thinking status with `role="status"` and the log MUST set `aria-busy="true"`. The indicator MUST be visually muted and slow (boring), MUST NOT use 拉了么 cyan/lime pops `#7ee0ff` / `#c9f07a`, and MUST NOT use luxury gold `#c6a56a`. When `prefers-reduced-motion: reduce`, the indicator MUST be static text with no looping animation. The status MUST disappear when the reply is appended.

#### Scenario: Busy chat shows a sleepy status

- **WHEN** the visitor sends a chat message and the reply has not arrived
- **THEN** a `role="status"` thinking row is visible, the transcript is `aria-busy="true"`, and the indicator computed style does not use `#7ee0ff`, `#c9f07a`, or `#c6a56a`

#### Scenario: Reduced motion thinking is static

- **WHEN** the visitor has `prefers-reduced-motion: reduce` and a chat request is in flight
- **THEN** the thinking status is present and does not use a looping transform or opacity animation

### Requirement: Beds and bedrooms reveal real photos sequentially

The beds and bedrooms docks MUST show catalog cards as soon as item JSON is available, including a reserved image box, so the gallery is not empty while photographs decode. Photographs MUST be local JPEGs of real beds or bedrooms (not geometric illustrations). At most the first two visible images MAY start loading immediately (`fetchpriority=high`, `loading=eager`). Remaining images MUST receive `src` one after another after the previous image `load` or `error`, not as a single all-at-once burst, and MUST NOT wait for every image before showing the first card. Sheets MUST still show a large local JPEG hero when `imageUrl` exists.

#### Scenario: Cards appear before every photo finishes

- **WHEN** bed catalog JSON arrives with at least two items
- **THEN** two card titles are in the document before every card image has fired `load`, and each card has a reserved image box

#### Scenario: Later photos wait their turn

- **WHEN** three or more bedroom cards are visible
- **THEN** only the first two images have `src` set at first, and a later card receives `src` only after an earlier image `load` or `error`

#### Scenario: Bed sheet still has a real photo

- **WHEN** a visitor opens a bed title into the bottom sheet
- **THEN** the sheet shows a large local JPEG under `/shuileme/beds/` and `querySelector('video')` is null

### Requirement: Sound dock plays and can be stopped

The sound dock MUST start an audible scene on the same visitor tap that chose it, MUST show which scene is playing, and MUST offer a 停 (EN: Stop) control that silences playback without leaving `/shuileme`. Sound MUST still stop on 醒了 and when the page unmounts. Autoplay without a tap MUST remain forbidden. Scenes MUST stay generated or packaged locally — not YouTube, Douyin, TikTok, or a remote media CDN. Hiding the tab MUST NOT force-stop playback.

#### Scenario: Tap is audible and labeled playing

- **WHEN** the visitor taps a named sound scene
- **THEN** playback starts from that tap, the dock marks that scene as playing, and a 停 control is available

#### Scenario: 停 silences without leaving

- **WHEN** a scene is playing and the visitor taps 停
- **THEN** playback is stopped, the location stays `/shuileme`, and no scene is marked playing
