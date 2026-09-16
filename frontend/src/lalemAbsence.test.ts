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
});

test('lalem filter chips stay on one aligned row per category (no wrap jumble)', () => {
  const css = readFileSync(join(__dirname, 'index.css'), 'utf8');
  const row = css.match(/\.ll-chip-row\s*\{[^}]+\}/)?.[0] || '';
  const track = css.match(/\.ll-chip-track\s*\{[^}]+\}/)?.[0] || '';
  expect(row).toBeTruthy();
  expect(track).toBeTruthy();
  expect(row).not.toMatch(/flex-wrap:\s*wrap/);
  expect(track).toMatch(/flex-wrap:\s*nowrap/);
  expect(track).toMatch(/overflow-x:\s*auto/);
  expect(css).not.toMatch(/#ff4d8d/);
});
