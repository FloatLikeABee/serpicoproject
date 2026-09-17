import { readFileSync } from 'fs';
import { join } from 'path';

test('officer Navigation, Login, landing, Fridge Raid, and 拉了么 have no /shuileme; App mounts it publicly', () => {
  const nav = readFileSync(join(__dirname, 'components/Navigation.tsx'), 'utf8');
  const login = readFileSync(join(__dirname, 'pages/Login.tsx'), 'utf8');
  const landing = readFileSync(join(__dirname, 'pages/Landing.tsx'), 'utf8');
  const homeGate = readFileSync(join(__dirname, 'pages/HomeGate.tsx'), 'utf8');
  const app = readFileSync(join(__dirname, 'App.tsx'), 'utf8');
  const fridge = readFileSync(join(__dirname, 'pages/FridgeRaid.tsx'), 'utf8');
  const lalem = readFileSync(join(__dirname, 'pages/Lalem.tsx'), 'utf8');
  for (const [name, src] of [
    ['nav', nav],
    ['login', login],
    ['landing', landing],
    ['homeGate', homeGate],
    ['fridge', fridge],
    ['lalem', lalem],
  ] as Array<[string, string]>) {
    expect({ name, hit: src.includes('/shuileme') }).toEqual({ name, hit: false });
    expect({ name, hit: src.includes('睡了么') }).toEqual({ name, hit: false });
  }
  expect(app).toMatch(/path="\/shuileme"/);
  const idx = app.indexOf('path="/shuileme"');
  const protectedIdx = app.indexOf('<ProtectedRoute>');
  expect(idx).toBeGreaterThan(-1);
  expect(idx).toBeLessThan(protectedIdx);
  const spaRoutes = readFileSync(join(__dirname, '../scripts/spa-routes.js'), 'utf8');
  expect(spaRoutes).toMatch(/'shuileme'/);
});

test('睡了么 page and night CSS stay isolated and dim', () => {
  const page = readFileSync(join(__dirname, 'pages/Shuileme.tsx'), 'utf8');
  expect(page).not.toMatch(/\bNotification\b/);
  expect(page).not.toMatch(/requestPermission/);
  expect(page).not.toMatch(/<video/);
  expect(page).not.toMatch(/ll-sit-alert|ll-companion|ll-world/);
  expect(page).toMatch(/sm-world/);
  expect(page).toMatch(/sm-breathe/);
  expect(page).toMatch(/sm-sheet-hero/);
  const anchors = Array.from(page.matchAll(/<a\b[^>]*>/g))
    .map((m) => m[0])
    .join('\n');
  expect(anchors).not.toMatch(/wikipedia\.org|wikiHref/i);
  const css = readFileSync(join(__dirname, 'index.css'), 'utf8');
  const start = css.indexOf('html.sm-world');
  expect(start).toBeGreaterThan(-1);
  const lounge = css.slice(start);
  expect(lounge).toMatch(/--sm-bg:\s*#0e1218\b/i);
  expect(lounge).not.toMatch(/#c6a56a/i);
  expect(lounge).not.toMatch(/#ff4d8d/i);
  expect(lounge).not.toMatch(/#7ee0ff/i);
  expect(lounge).toMatch(/\.sm-sheet-chip\s*\{/);
  expect(lounge).toMatch(/\.sm-sheet-hero\s*\{/);
  expect(lounge).toMatch(/prefers-reduced-motion/);
  const dock = /html\.sm-world[\s\S]*?\.sm-dock\s*\{([^}]*)\}/.exec(css)?.[1] || '';
  expect(dock).toMatch(/repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
});
