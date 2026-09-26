# Tasks

## 1. Failing contracts

- [x] 1.1 Add `frontend/src/data/xiaomaomiMenu.test.ts` for the locked twelve ids, kind counts (6 coffee, 4 tea, 2 fusion), titles 暹罗糖云 / Siamese Baby Kitten Sugar Coffee, local `/xiaomaomi/drinks/<id>.jpg` paths, no `://`, and a scan that rejects 瑞幸, Luckin, 喜茶, Heytea, 霸王茶姬, 星巴克, Starbucks, 蜜雪, 伯牙绝弦, 生椰拿铁, 轻轻茉莉, `¥`, and `￥`. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='xiaomaomiMenu.test'` **fails** while the module is missing
- [x] 1.2 Add `frontend/src/pages/Xiaomaomi.test.tsx` and extend `frontend/src/App.publicRoutes.test.tsx`: `/xiaomaomi` heading 小茂密咖啡, `html.xm-world`, no officer `navigation`, hero `/xiaomaomi/hero.jpg`, chips 全部/咖啡/茶/茶咖, 茶 chip keeps the path and hides 暹罗糖云, sheet for 暹罗糖云 shows Siamese Baby Kitten Sugar Coffee and no `¥`, no `textarea`, no 已看, no 好了, EN browser still starts in Chinese. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='Xiaomaomi.test|App.publicRoutes'` **fails** while the page and route are missing
- [x] 1.3 Add `frontend/src/xiaomaomiAbsence.test.ts`: page source has no officer Navigation, no fetch to `/lalem/`, `/shuileme/`, or `/kuaixiaosan/`, no `<video>`, no `Notification`, and `html.xm-world` CSS does not contain `#c6a56a`, `#ff4d8d`, `#7ee0ff`, or `#c9f07a`. Sibling pages do not import `Xiaomaomi`. Verify the absence test **fails** while those files are missing

## 2. Menu and kitten images

- [x] 2.1 Add `frontend/src/data/xiaomaomiMenu.ts` with the twelve locked drinks, bilingual blurbs for the trend habits in the menu spec, and `imageUrl` `/xiaomaomi/drinks/<id>.jpg`. Verify the menu unit test from 1.1 passes except JPEG file checks if those are split out
- [x] 2.2 Generate thirteen wholesome kitten-and-drink images (no human faces, no chain logos) and write unique JPEGs to `frontend/public/xiaomaomi/hero.jpg` and `frontend/public/xiaomaomi/drinks/<id>.jpg`, plus `frontend/public/xiaomaomi/ATTRIBUTION.md` stating they are original generated art. Verify a test that each file starts with JPEG SOI and that all thirteen SHA-256 hashes are unique

## 3. Page, copy, route

- [x] 3.1 Add i18n `xiaomaomi.*` (title 小茂密咖啡, kicker 茂密, chips 全部/咖啡/茶/茶咖, EN counterparts) and `frontend/src/utils/xiaomaomiLang.ts` using `serpico.xiaomaomi.lang`, default **cn**, without reading the other lounges' language keys. Verify a lang-helper test and `catalog.test` for the new keys
- [x] 3.2 Implement `frontend/src/pages/Xiaomaomi.tsx` and `html.xm-world` / `.xm-*` tokens from design.md (`--xm-bg: #fff6f2`, `--xm-text: #4a3040`, `--xm-accent: #a84d6a`, blush and peach fills). Extend `LoungeWorld` with `xm-world`. Hero, four chips, `queueLoungePhotos` on `.xm-gallery`, bottom sheet, CN title with EN kitten subtitle. No clock, no chat. Verify `Xiaomaomi.test` passes
- [x] 3.3 Register `/xiaomaomi` in `App.tsx` before `ProtectedRoute` and add `'xiaomaomi'` only to `frontend/scripts/spa-routes.js`. Verify the public-routes test passes and `spa-routes` does not list `xiaomaomi/chat`

## 4. Isolation

- [x] 4.1 Confirm this page does not restyle officer chrome, Fridge Raid, 拉了么, 睡了么, or 肾结石快消散, and does not merge PR #104 or archive other OpenSpec changes. Bump the stamp comment in `frontend/src/utils/hardDataUrls.ts`. Verify `xiaomaomiAbsence` plus `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='xiaomaomi|Xiaomaomi|shuileme|Shuileme|lalem|Lalem|kuaixiaosan|Kuaixiaosan|catalog.test|App.publicRoutes'` pass, and `unset CI && cd frontend && npm run build` writes `build/xiaomaomi/index.html` without a new iterator-spread TS2802
