# Spec Delta

## ADDED Requirements

### Requirement: Done-sitting stop ends the sit session in place

`/lalem` MUST show a header control labeled 完了 (EN: Done sitting) that ends the current sit session without leaving the page. Activating it MUST freeze the 已坐 timer, dismiss any sit-alert overlay, dismiss the companion bubble, and MUST NOT schedule further sit-alerts or companion fetches for that visit. It MUST NOT navigate to officer chrome, Fridge Raid, or `/shuileme`. A second tap MUST be a no-op. Chat, catalogs, and 拉榜 MUST remain usable. The control MUST NOT use the Notification API.

#### Scenario: 完了 freezes the clock and clears nags

- **WHEN** a sit-alert or companion is visible and the visitor taps 完了
- **THEN** the overlay and companion are gone, the 已坐 value no longer increases, and the location stays `/lalem`

#### Scenario: 完了 does not fire later sit-alerts

- **WHEN** the visitor taps 完了 and then five more minutes pass with the page visible
- **THEN** no 久坐警报 dialog appears and no new companion bubble is shown

### Requirement: Colorful thinking indicator while chat is busy

While a 拉了么 chat request is in flight, the transcript MUST show a thinking status with `role="status"` and the log MUST set `aria-busy="true"`. The indicator MAY use lounge pop colors inside `html.ll-world` and MUST NOT use luxury gold `#c6a56a` or `#ff4d8d`. When `prefers-reduced-motion: reduce`, the indicator MUST still be present as static status text. The status MUST disappear when the reply is appended. Sit-alert overlays MUST still stack above chat.

#### Scenario: Busy chat shows a fun status

- **WHEN** the visitor sends a chat message and the reply has not arrived
- **THEN** a `role="status"` thinking row is visible, the transcript is `aria-busy="true"`, and lounge CSS for that row does not contain `#c6a56a`

#### Scenario: Sit-alert still wins while thinking

- **WHEN** a sit-alert overlay is due while the chat thinking status is visible
- **THEN** the sit-alert is the blocking overlay, `querySelector('video')` is still null, and the thinking status remains in the transcript until the reply arrives or 完了 is tapped
