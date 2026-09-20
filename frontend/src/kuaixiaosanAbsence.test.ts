import { readFileSync } from 'fs';
import { join } from 'path';

test('officer Navigation, Login, landing, Fridge Raid, 拉了么, and 睡了么 have no /kuaixiaosan; App mounts it publicly', () => {
  const nav = readFileSync(join(__dirname, 'components/Navigation.tsx'), 'utf8');
  const login = readFileSync(join(__dirname, 'pages/Login.tsx'), 'utf8');
  const landing = readFileSync(join(__dirname, 'pages/Landing.tsx'), 'utf8');
  const homeGate = readFileSync(join(__dirname, 'pages/HomeGate.tsx'), 'utf8');
  const app = readFileSync(join(__dirname, 'App.tsx'), 'utf8');
  const fridge = readFileSync(join(__dirname, 'pages/FridgeRaid.tsx'), 'utf8');
  const lalem = readFileSync(join(__dirname, 'pages/Lalem.tsx'), 'utf8');
  const shuileme = readFileSync(join(__dirname, 'pages/Shuileme.tsx'), 'utf8');
  for (const [name, src] of [
    ['nav', nav],
    ['login', login],
    ['landing', landing],
    ['homeGate', homeGate],
    ['fridge', fridge],
    ['lalem', lalem],
    ['shuileme', shuileme],
  ] as Array<[string, string]>) {
    expect({ name, hit: src.includes('/kuaixiaosan') }).toEqual({ name, hit: false });
    expect({ name, hit: src.includes('肾结石快消散') }).toEqual({ name, hit: false });
  }
  expect(app).toMatch(/path="\/kuaixiaosan"/);
  expect(app).toMatch(/path="\/kuaixiaosan\/chat"/);
  const chatIdx = app.indexOf('path="/kuaixiaosan/chat"');
  const pageIdx = app.indexOf('path="/kuaixiaosan"');
  const protectedIdx = app.indexOf('<ProtectedRoute>');
  expect(chatIdx).toBeGreaterThan(-1);
  expect(pageIdx).toBeGreaterThan(-1);
  expect(chatIdx).toBeLessThan(pageIdx);
  expect(pageIdx).toBeLessThan(protectedIdx);
  const spaRoutes = readFileSync(join(__dirname, '../scripts/spa-routes.js'), 'utf8');
  expect(spaRoutes).toMatch(/'kuaixiaosan'/);
  expect(spaRoutes).toMatch(/'kuaixiaosan\/chat'/);
});

test('肾结石快消散 page and stone CSS stay isolated', () => {
  const page = readFileSync(join(__dirname, 'pages/Kuaixiaosan.tsx'), 'utf8');
  expect(page).not.toMatch(/\bNotification\b/);
  expect(page).not.toMatch(/requestPermission/);
  expect(page).not.toMatch(/<video/);
  expect(page).not.toMatch(/ll-sit-alert|ll-companion|ll-world|sm-world|sm-breathe/);
  expect(page).not.toMatch(/\/lalem\//);
  expect(page).not.toMatch(/\/shuileme\//);
  expect(page).toMatch(/kx-world/);
  expect(page).toMatch(/kx-sheet-hero/);
  expect(page).toMatch(/textarea/);
  const anchors = Array.from(page.matchAll(/<a\b[^>]*>/g))
    .map((m) => m[0])
    .join('\n');
  expect(anchors).not.toMatch(/wikipedia\.org|wikiHref/i);
  const css = readFileSync(join(__dirname, 'index.css'), 'utf8');
  const start = css.indexOf('html.kx-world');
  expect(start).toBeGreaterThan(-1);
  const lounge = css.slice(start);
  expect(lounge).toMatch(/--kx-bg:\s*#12181c\b/i);
  expect(lounge).toMatch(/--kx-surface:\s*#1c262c\b/i);
  expect(lounge).toMatch(/--kx-text:\s*#e4eef2\b/i);
  expect(lounge).toMatch(/--kx-muted:\s*#8aa0aa\b/i);
  expect(lounge).toMatch(/--kx-accent:\s*#5f9ea8\b/i);
  expect(lounge).toMatch(/--kx-warm:\s*#c4a484\b/i);
  expect(lounge).not.toMatch(/#c6a56a/i);
  expect(lounge).not.toMatch(/#ff4d8d/i);
  expect(lounge).not.toMatch(/#7ee0ff/i);
  expect(lounge).not.toMatch(/#c9f07a/i);
  expect(lounge).toMatch(/\.kx-sheet-chip\s*\{/);
  expect(lounge).toMatch(/\.kx-sheet-hero\s*\{/);
  expect(lounge).toMatch(/prefers-reduced-motion/);
  const dock = /html\.kx-world[\s\S]*?\.kx-dock\s*\{([^}]*)\}/.exec(css)?.[1] || '';
  expect(dock).toMatch(/repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
});
