# Spec Delta

## Purpose

Defines the unlisted 小茂密咖啡 landing page: one Chinese-default phone page for a cute kitten coffee-and-tea menu, isolated from officer chrome and the other lounges, without a shop address, prices, or checkout.

## ADDED Requirements

### Requirement: Unlisted Chinese-default café page

`/xiaomaomi` MUST be a public route outside the officer `ProtectedRoute`. Officer Navigation, Login, landing, HomeGate, Fridge Raid, 拉了么, 睡了么, and 肾结石快消散 MUST NOT link to it. The first visit MUST default to Simplified Chinese unless a stored 小茂密咖啡 language or `?lang=` / `?nation=` override is present. The page MUST use an isolated cream-and-rose skin (`html.xm-world` / `.xm-*`) and MUST NOT apply `ll-world`, `sm-world`, `kx-world`, or Fridge Raid kitchen classes. The skin MUST NOT use `#c6a56a`, `#ff4d8d`, `#7ee0ff`, or `#c9f07a`.

#### Scenario: Fresh visit is 小茂密咖啡, not officer nav

- **WHEN** a visitor opens `/xiaomaomi` with no stored language
- **THEN** the heading is 小茂密咖啡, there is no officer `navigation`, `html` has class `xm-world` and not `ll-world`, `sm-world`, or `kx-world`, and `.fr-page` is absent

#### Scenario: English browser does not become the default

- **WHEN** a first-time visitor has `navigator.language` of `en-US` and no stored 小茂密咖啡 language
- **THEN** the heading is still 小茂密咖啡 until they tap EN

### Requirement: One page, no lounge clock and no nested chat

The page MUST be a single scrolling landing page. It MUST NOT render a 已看 session clock or a 好了 / I'm done control. It MUST NOT register `/xiaomaomi/chat` or any other nested 小茂密咖啡 path. It MUST NOT include a chat transcript or `textarea`. It MUST NOT call `/api/v1/lalem/`, `/api/v1/shuileme/`, or `/api/v1/kuaixiaosan/`. It MUST NOT use the Notification API and MUST NOT embed `<video>`.

#### Scenario: The landing has no chat and no session clock

- **WHEN** a visitor opens `/xiaomaomi`
- **THEN** the document has no `textarea`, no text 已看, no button named 好了, and the path stays `/xiaomaomi`

#### Scenario: Unknown nested path is not this app

- **WHEN** a visitor opens `/xiaomaomi/chat` with no session
- **THEN** the 小茂密咖啡 heading is absent

### Requirement: Hero and on-page drink chips

The page MUST show one local hero image of a cute kitten with a drink at `/xiaomaomi/hero.jpg`, the kicker 茂密, and a short invite aimed at students and young workers. On the same page it MUST offer exactly four filter chips: 全部, 咖啡, 茶, and 茶咖. Choosing a chip MUST filter the visible cards and MUST NOT change the path away from `/xiaomaomi`.

#### Scenario: Chips filter without leaving the page

- **WHEN** a visitor taps 茶 and then 全部
- **THEN** the path remains `/xiaomaomi`, tea cards are the only drink cards while 茶 is selected, and all drink cards return when 全部 is selected

#### Scenario: Hero is a local kitten image

- **WHEN** the page renders
- **THEN** the hero image source is `/xiaomaomi/hero.jpg` and `querySelector('video')` is null

### Requirement: Cards open a cute sheet

Each visible drink MUST appear as a card with its Chinese name, its English kitten name, a reserved image box, and a local JPEG. Tapping the card title MUST open a bottom sheet with a large local JPEG, the cute name, and the cup story. The sheet MUST NOT show a price, a street address, a phone number, or a WeChat id. At most the first two visible card images MAY start loading immediately. Remaining card images MUST receive `src` one after another after the previous image `load` or `error`.

#### Scenario: Card titles appear before every photo finishes

- **WHEN** the menu has at least two drinks
- **THEN** two card titles are in the document before every card image has fired `load`, and each card has a reserved image box

#### Scenario: Sheet is a kitten cup, not a checkout

- **WHEN** a visitor opens 暹罗糖云
- **THEN** the sheet shows Siamese Baby Kitten Sugar Coffee, a large image under `/xiaomaomi/drinks/`, and no `¥`, `￥`, phone number, or WeChat id

### Requirement: No invented shop facts

Visible copy MUST NOT include a street address, a telephone number, a WeChat id, a price, or an online-order button. The page MUST NOT claim a chain partnership or name 瑞幸, Luckin, 喜茶, Heytea, 霸王茶姬, 星巴克, Starbucks, or 蜜雪冰城.

#### Scenario: The footer does not invent a location

- **WHEN** a visitor reads the page including the open sheet
- **THEN** there is no street address, no phone number, no WeChat id, and no 瑞幸 or Starbucks text
