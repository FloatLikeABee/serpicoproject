import { readFileSync } from 'fs';
import { join } from 'path';

test('officer Navigation, Login, landing, Fridge Raid, and the other lounges do not link to 小茂密咖啡', () => {
  const files = [
    'components/Navigation.tsx',
    'pages/Login.tsx',
    'pages/Landing.tsx',
    'pages/HomeGate.tsx',
    'pages/FridgeRaid.tsx',
    'pages/Lalem.tsx',
    'pages/Shuileme.tsx',
    'pages/Kuaixiaosan.tsx',
  ];
  for (const rel of files) {
    const src = readFileSync(join(__dirname, rel), 'utf8');
    expect({ rel, hit: src.includes('/xiaomaomi') }).toEqual({ rel, hit: false });
    expect({ rel, hit: src.includes('Xiaomaomi') }).toEqual({ rel, hit: false });
    expect({ rel, hit: src.includes('小茂密咖啡') }).toEqual({ rel, hit: false });
  }
  const app = readFileSync(join(__dirname, 'App.tsx'), 'utf8');
  const pageIdx = app.indexOf('path="/xiaomaomi"');
  const protectedIdx = app.indexOf('<ProtectedRoute>');
  expect(pageIdx).toBeGreaterThan(-1);
  expect(pageIdx).toBeLessThan(protectedIdx);
  expect(app).not.toMatch(/xiaomaomi\/chat/);
  const spaRoutes = readFileSync(join(__dirname, '../scripts/spa-routes.js'), 'utf8');
  expect(spaRoutes).toMatch(/'xiaomaomi'/);
  expect(spaRoutes).not.toMatch(/xiaomaomi\/chat/);
});

test('小茂密咖啡 page and cream-rose CSS stay isolated', () => {
  const page = readFileSync(join(__dirname, 'pages/Xiaomaomi.tsx'), 'utf8');
  expect(page).not.toMatch(/\bNotification\b/);
  expect(page).not.toMatch(/requestPermission/);
  expect(page).not.toMatch(/<video/);
  expect(page).not.toMatch(/\/lalem\//);
  expect(page).not.toMatch(/\/shuileme\//);
  expect(page).not.toMatch(/\/kuaixiaosan\//);
  expect(page).not.toMatch(/from ['"].*Navigation['"]/);
  expect(page).toMatch(/xm-world/);
  expect(page).toMatch(/xm-sheet/);
  expect(page).not.toMatch(/textarea/);
  const css = readFileSync(join(__dirname, 'index.css'), 'utf8');
  const start = css.indexOf('html.xm-world');
  expect(start).toBeGreaterThan(-1);
  const lounge = css.slice(start);
  expect(lounge).toMatch(/--xm-bg:\s*#fff6f2\b/i);
  expect(lounge).toMatch(/--xm-surface:\s*#fffdfb\b/i);
  expect(lounge).toMatch(/--xm-text:\s*#4a3040\b/i);
  expect(lounge).toMatch(/--xm-muted:\s*#8d6d78\b/i);
  expect(lounge).toMatch(/--xm-accent:\s*#a84d6a\b/i);
  expect(lounge).toMatch(/--xm-blush:\s*#f3c1d0\b/i);
  expect(lounge).toMatch(/--xm-peach:\s*#f3c3a4\b/i);
  expect(lounge).not.toMatch(/#c6a56a/i);
  expect(lounge).not.toMatch(/#ff4d8d/i);
  expect(lounge).not.toMatch(/#7ee0ff/i);
  expect(lounge).not.toMatch(/#c9f07a/i);
  expect(lounge).toMatch(/prefers-reduced-motion/);
});
