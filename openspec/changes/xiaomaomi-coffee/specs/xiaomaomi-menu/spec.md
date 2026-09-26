# Spec Delta

## Purpose

Defines the 小茂密咖啡 drink menu: twelve original kitten-named coffee, tea, and tea-coffee cups with local generated images, grounded in China café trends and free of chain trademarks, prices, and invented shop facts.

## ADDED Requirements

### Requirement: Twelve kitten drinks across coffee, tea, and fusion

The menu MUST contain exactly these twelve ids, with the Chinese title and English kitten name below. Six MUST be `coffee`, four MUST be `tea`, and two MUST be `fusion`.

| id | kind | title | titleEn |
| --- | --- | --- | --- |
| siamese-sugar | coffee | 暹罗糖云 | Siamese Baby Kitten Sugar Coffee |
| citrus-americano | coffee | 橘座美式 | Orange-Seat Kitten Americano |
| snow-cold-brew | coffee | 冷萃小雪 | Snowdrift Kitten Cold Brew |
| salt-roll | coffee | 咸奶卷卷 | Salt-Milk Roll Kitten |
| oat-cloud | coffee | 燕麦云朵 | Oat-Cloud Kitten Latte |
| yunnan-pour | coffee | 云南日晒 | Sun-Dried Kitten Pour-over |
| jasmine-velvet | tea | 茉莉奶绒 | Jasmine-Velvet Kitten |
| peach-soft | tea | 白桃软软 | Peach-Soft Kitten Fruit Tea |
| grape-fizz | tea | 青提气泡 | Green-Grape Fizz Kitten |
| salty-cheese | tea | 咸酪小山 | Salty Cheese Kitten Milk Tea |
| jasmine-yuanyang | fusion | 茉莉鸳鸯 | Jasmine Yuanyang Kitten |
| plum-study | fusion | 话梅晚课 | Plum-Study Kitten Americano |

Each item MUST include a Chinese blurb and an English blurb that say what is in the cup. Blurbs MUST describe a real café habit (morning Americano, cold brew, oat latte, salted milk-fat, fruit tea, light jasmine milk tea, jasmine yuanyang, plum Americano, or Yunnan sun-dried pour-over) without naming a chain. Ids, titles, and image paths MUST be unique.

#### Scenario: The signature sugar kitten is on the menu

- **WHEN** the menu is read
- **THEN** `siamese-sugar` has title 暹罗糖云 and titleEn Siamese Baby Kitten Sugar Coffee, and the menu length is 12

#### Scenario: Kinds match the chip groups

- **WHEN** drinks are grouped by kind
- **THEN** coffee has 6 items, tea has 4 items, and fusion has 2 items

### Requirement: Every drink has its own local kitten JPEG

Each drink `imageUrl` MUST be `/xiaomaomi/drinks/<id>.jpg`. The file MUST exist, MUST start with a JPEG SOI marker, and MUST have a SHA-256 distinct from every other drink image and from `/xiaomaomi/hero.jpg`. Images MUST depict a cute kitten with the drink. They MUST NOT depict a recognizable human face, a real child, sexualized bodies, or a chain logo. The menu MUST NOT hotlink (`imageUrl` contains no `://`).

#### Scenario: Drink images are local unique JPEGs

- **WHEN** the menu image files are hashed
- **THEN** twelve drink JPEGs plus `hero.jpg` are present, each hash appears once, and every drink `imageUrl` ends with `.jpg` under `/xiaomaomi/drinks/`

### Requirement: Cute names stay original

Titles, English kitten names, and blurbs MUST NOT contain 瑞幸, Luckin, 喜茶, Heytea, 霸王茶姬, 星巴克, Starbucks, 蜜雪, 伯牙绝弦, 生椰拿铁, or 轻轻茉莉. They MUST NOT include a price, a street address, a phone number, or a WeChat id. The Yunnan pour-over blurb MUST present a flavor story and MUST NOT claim a farm partnership or licensed collaboration.

#### Scenario: Blurbs do not borrow a chain SKU

- **WHEN** every title and blurb is scanned
- **THEN** none of them contain 生椰拿铁, 轻轻茉莉, 瑞幸, or Starbucks, and none contain `¥` or `￥`
