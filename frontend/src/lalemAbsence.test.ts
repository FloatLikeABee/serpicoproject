import { readFileSync } from 'fs';
import { join } from 'path';

test('officer Navigation, Login, and landing have no /lalem link; App mounts it publicly', () => {
  const nav = readFileSync(join(__dirname, 'components/Navigation.tsx'), 'utf8');
  const login = readFileSync(join(__dirname, 'pages/Login.tsx'), 'utf8');
  const landing = readFileSync(join(__dirname, 'pages/Landing.tsx'), 'utf8');
  const homeGate = readFileSync(join(__dirname, 'pages/HomeGate.tsx'), 'utf8');
  const app = readFileSync(join(__dirname, 'App.tsx'), 'utf8');
  expect(nav).not.toMatch(/\/lalem/);
  expect(login).not.toMatch(/\/lalem/);
  expect(landing).not.toMatch(/\/lalem/);
  expect(homeGate).not.toMatch(/\/lalem/);
  expect(nav).not.toMatch(/拉了么/);
  expect(login).not.toMatch(/拉了么/);
  expect(landing).not.toMatch(/拉了么/);
  expect(homeGate).not.toMatch(/拉了么/);
  expect(app).toMatch(/path="\/lalem"/);
  const lalemIdx = app.indexOf('path="/lalem"');
  const protectedIdx = app.indexOf('<ProtectedRoute>');
  expect(lalemIdx).toBeGreaterThan(-1);
  expect(protectedIdx).toBeGreaterThan(-1);
  expect(lalemIdx).toBeLessThan(protectedIdx);
  const spaRoutes = readFileSync(join(__dirname, '../scripts/spa-routes.js'), 'utf8');
  expect(spaRoutes).toMatch(/'lalem'/);
  const fridge = readFileSync(join(__dirname, 'pages/FridgeRaid.tsx'), 'utf8');
  expect(fridge).not.toMatch(/\/lalem/);
  expect(fridge).not.toMatch(/拉了么/);
  expect(fridge).not.toMatch(/ll-page|ll-world/);
  const lalemPage = readFileSync(join(__dirname, 'pages/Lalem.tsx'), 'utf8');
  expect(lalemPage).not.toMatch(/\bNotification\b/);
  expect(lalemPage).not.toMatch(/requestPermission/);
  expect(lalemPage).not.toMatch(/<video/);
  expect(lalemPage).not.toMatch(/youtube|douyin/i);
  const css = readFileSync(join(__dirname, 'index.css'), 'utf8');
  expect(css).not.toMatch(/#c6a56a/);
  expect(lalemPage).not.toMatch(/ll-chip-track/);
  const anchors = Array.from(lalemPage.matchAll(/<a\b[^>]*>/g))
    .map((m) => m[0])
    .join('\n');
  expect(anchors).not.toMatch(/wikipedia\.org|wikiHref/i);
  expect(lalemPage).toMatch(/ll-trend-tag/);
});

function loungeCss(): string {
  const css = readFileSync(join(__dirname, 'index.css'), 'utf8');
  const start = css.indexOf('html.ll-world');
  expect(start).toBeGreaterThan(-1);
  return css.slice(start);
}

function cssRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  return re.exec(css)?.[1] ?? '';
}

test('lounge chrome uses calm dark tokens, one gutter, and no candy gold/pink', () => {
  const lounge = loungeCss();
  const page = cssRule(lounge, '.ll-page');
  const card = cssRule(lounge, '.ll-card');
  const title = cssRule(lounge, '.ll-card-title');
  const filters = cssRule(lounge, '.ll-filters');
  const filterRow = cssRule(lounge, '.ll-filter-row');
  const top = cssRule(lounge, '.ll-top');
  const body = cssRule(lounge, '.ll-body');
  const dock = cssRule(lounge, '.ll-dock');
  const sheet = cssRule(lounge, '.ll-sheet');
  const sit = cssRule(lounge, '.ll-sit-alert');
  const sitDismiss = cssRule(lounge, '.ll-sit-alert-dismiss');

  expect(lounge).toMatch(/--ll-bg:\s*#22183a\b/i);
  expect(lounge).toMatch(/--ll-surface:\s*#33285a\b/i);
  expect(lounge).toMatch(/--ll-text:\s*#fff4e8\b/i);
  expect(lounge).toMatch(/--ll-muted:\s*#c9b8e0\b/i);
  expect(lounge).toMatch(/--ll-accent:\s*#3ee0c4\b/i);
  expect(lounge).toMatch(/--ll-pop:\s*#ff9a62\b/i);
  expect(lounge).not.toMatch(/--ll-bg:\s*#12161c\b/i);
  expect(lounge).toMatch(/--ll-line:/);
  expect(lounge).toMatch(/--ll-gutter:\s*1rem\b/);

  expect(lounge).not.toMatch(/#c6a56a/i);
  expect(lounge).not.toMatch(/#ff4d8d/i);
  expect(lounge).not.toMatch(/#2a1710/i);
  expect(page).toMatch(/var\(--ll-bg\)/);
  expect(page).not.toMatch(/radial-gradient/);
  expect(page).not.toMatch(/repeating-linear-gradient/);
  expect(page).toMatch(/40rem/);

  expect(card).toMatch(/minmax\(2\.75rem/);
  expect(title).toMatch(/-webkit-line-clamp:\s*2/);
  expect(title).toMatch(/line-clamp:\s*2/);
  expect(filters).toMatch(/grid-template-columns:\s*auto\s+1fr/);
  expect(filterRow).toMatch(/display:\s*contents/);

  expect(top).toMatch(/padding-inline:\s*var\(--ll-gutter\)/);
  expect(body).toMatch(/padding-inline:\s*var\(--ll-gutter\)/);
  expect(dock).toMatch(/padding-inline:\s*var\(--ll-gutter\)/);
  expect(dock).toMatch(/repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  expect(sheet).toMatch(/padding-inline:\s*var\(--ll-gutter\)/);

  expect(sit).not.toMatch(/#ffd36a/i);
  expect(sitDismiss).not.toMatch(/#ff4d8d/i);
  expect(sitDismiss).not.toMatch(/#ffd36a/i);

  const companion = cssRule(lounge, '.ll-companion');
  const sitZ = /z-index:\s*(\d+)/.exec(cssRule(lounge, '.ll-sit-alert-backdrop'));
  const companionZ = /z-index:\s*(\d+)/.exec(companion);
  expect(companion).toMatch(/z-index:\s*\d+/);
  expect(Number(sitZ?.[1])).toBeGreaterThan(Number(companionZ?.[1]));
});

test('lounge cards are photos; 拉榜 thumbs are compact; wiki reader sits under sit-alert', () => {
  const lounge = loungeCss();
  const cardImg = cssRule(lounge, '.ll-card img');
  expect(cardImg).toMatch(/object-fit:\s*cover/);
  expect(cardImg).not.toMatch(/image-rendering:\s*pixelated/);
  expect(cardImg).toMatch(/aspect-ratio:\s*1\s*\/\s*1/);
  const trendImg = cssRule(lounge, '.ll-trend img');
  expect(trendImg).toMatch(/3\.5rem/);
  expect(trendImg).toMatch(/object-fit:\s*cover/);
  expect(lounge).toMatch(/\.ll-trend-tag\s*\{/);
  expect(cssRule(lounge, '.ll-trend-tag')).toMatch(/var\(--ll-pop\)/);
  expect(cssRule(lounge, '.ll-wiki-backdrop')).toMatch(/z-index:\s*30/);
  expect(lounge).not.toMatch(/#c6a56a/i);
  expect(lounge).not.toMatch(/ll-chip-track/);
  const lalemPage = readFileSync(join(__dirname, 'pages/Lalem.tsx'), 'utf8');
  expect(lalemPage).not.toMatch(/target="_blank"[\s\S]{0,80}wikiHref|wikiHref[\s\S]{0,80}target="_blank"/);
});

test('医典 catalog JSON has at least fifty unique sourced articles', () => {
  const raw = readFileSync(join(__dirname, '../../backend/internal/ai/lalem_medicine.json'), 'utf8');
  const file = JSON.parse(raw) as {
    articles: Array<{ id: string; title: string; titleEn: string; body: string; bodyEn: string }>;
  };
  const articles = file.articles || [];
  const ids = Array.from(new Set(articles.map((item) => item.id)));
  expect(articles.length).toBeGreaterThanOrEqual(50);
  expect(ids.length).toBe(articles.length);
  expect(ids.length).toBeGreaterThanOrEqual(50);
});
