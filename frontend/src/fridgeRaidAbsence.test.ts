import { readFileSync } from 'fs';
import { join } from 'path';

test('officer Navigation, Login, and landing have no fridge-raid link; App mounts it publicly', () => {
  const nav = readFileSync(join(__dirname, 'components/Navigation.tsx'), 'utf8');
  const login = readFileSync(join(__dirname, 'pages/Login.tsx'), 'utf8');
  const landing = readFileSync(join(__dirname, 'pages/Landing.tsx'), 'utf8');
  const homeGate = readFileSync(join(__dirname, 'pages/HomeGate.tsx'), 'utf8');
  const app = readFileSync(join(__dirname, 'App.tsx'), 'utf8');
  expect(nav).not.toMatch(/fridge-raid/);
  expect(login).not.toMatch(/fridge-raid/);
  expect(landing).not.toMatch(/fridge-raid/);
  expect(homeGate).not.toMatch(/fridge-raid/);
  expect(app).toMatch(/path="\/fridge-raid"/);
  const fridgeIdx = app.indexOf('path="/fridge-raid"');
  const protectedIdx = app.indexOf('<ProtectedRoute>');
  expect(fridgeIdx).toBeGreaterThan(-1);
  expect(protectedIdx).toBeGreaterThan(-1);
  expect(fridgeIdx).toBeLessThan(protectedIdx);
});
