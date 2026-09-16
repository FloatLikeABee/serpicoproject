## 1. SQLite feed store

- [ ] 1.1 Add `lalem_trends`, `lalem_useful`, and `lalem_feed_meta` tables in `createTables` (locale, unique title/body per locale, `created_at`, Shanghai increment date) with newest-first indexes; verify a database test that a fresh init creates the three tables
- [ ] 1.2 Add insert/list/prune helpers: insert trend/useful ignoring unique conflicts, list by locale newest-first, delete rows older than 3 calendar months (Asia/Shanghai); verify tests: list order, duplicate title skipped, a row dated 4 months ago is pruned and a 1-month-old row remains, CN and EN lists do not mix

## 2. Daily increment advisor

- [ ] 2.1 Add an increment digest prompt (JSON only, exactly two entertainment/fashion trends, exactly one useful note, medical bans, no invented image URLs, locale-faithful) and parse it through the existing digest parser taking at most 2 trends + 1 useful; verify prompt tests include those needles and officer `BuildChatPrompt` still has no 拉了么 primer
- [ ] 2.2 Extend `AdviseLalemDigest` (or a sibling) with seed vs increment: seed keeps today’s full canned/live path; increment maps images onto the local trend pool, attaches no extra scrape, uses the same SiliconFlow live text client with no vision; verify stubbed increment returns 2 pictured trends + 1 useful and the missing-live-model path does not call vision

## 3. Digest GET from the store

- [ ] 3.1 Change `GET /api/v1/lalem/digest` to prune, read SQLite, compose existing JSON field names plus curated `videos[]`, and return newest-first archive without calling the adviser when rows exist and `last_increment_date` is today Shanghai; verify handler tests: pre-seeded memory DB returns those rows with adviser calls=0, payload has ≥1 video src, CN/EN stay separate
- [ ] 3.2 On empty locale store, rate-limit then seed (full advise or canned fallback) and persist rows + increment date; on a new Shanghai day with existing rows, rate-limit then append ~2 trends + 1 useful without deleting prior rows; on increment failure keep prior rows and do not bump the date; verify tests: first GET persists and second GET does not call advise, day-rollover appends and keeps yesterday, failed increment still 200 with old rows
- [ ] 3.3 Charge the existing lalem per-IP limiter (~8 / 10 min) only when seed or increment would call the live model; warm store-only GETs must not 429; verify tests: eight warm GETs stay 200, eight empty-store generation attempts 429, fridge-raid limiter still separate

## 4. Sit alerts and archive UI

- [ ] 4.1 Add CN/EN i18n keys for sit-alert copy at 5/10/15/20/25/30+ minutes that name elapsed time and get more dramatic; verify catalog tests that CN default keys exist and none of the alert strings diagnose or request notification permission
- [ ] 4.2 Implement a single in-page `role="dialog"` sit overlay on `/lalem` from the existing session timer (every 5 minutes, replace don’t stack, dismiss until next milestone, skip paint while `document.hidden`, stronger CSS class per tier, no Notification API); verify RTL with fake timers: 5:00 shows one dialog naming 5 minutes, dismiss stays gone at 9:59, 10:00 shows a more dramatic class/copy, hidden milestone appears only after visibility, no `Notification` in `Lalem.tsx`
- [ ] 4.3 Render 热榜/有用 from the digest arrays in given (newest-first) order so kept multi-day rows all show; verify RTL fixture with two trend days and two useful notes lists newest first with images and the disclaimer

## 5. Isolation and verify

- [ ] 5.1 Confirm officer `/chat`, Fridge Raid, Navigation, toilet catalog, and curated videos are untouched (no 拉了么 primer in `BuildChatPrompt`, `lalemAbsence` still passes, no luxury-theme PR files mixed in)
- [ ] 5.2 Run 拉了么 frontend tests plus `go test ./internal/ai ./internal/api ./internal/database -count=1` and verify they pass
