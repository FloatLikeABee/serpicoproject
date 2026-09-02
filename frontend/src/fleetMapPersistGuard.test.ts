import { readFileSync } from 'fs';
import { join } from 'path';

test('Fleet persist still uses helper userId query param', () => {
  const api = readFileSync(join(__dirname, 'services/api.ts'), 'utf8');
  const fleetStart = api.indexOf('export const fleetAPI');
  expect(fleetStart).toBeGreaterThan(0);
  const fleet = api.slice(fleetStart, fleetStart + 1800);
  expect(fleet).toMatch(/helperParams\(userId\)/);
  expect(fleet).not.toMatch(/X-User-Id/);
});

test('Pursue pin kinds were not replaced by Chase Game revival', () => {
  const pursue = readFileSync(join(__dirname, 'pages/police/InPursue.tsx'), 'utf8');
  expect(pursue).toMatch(/MAP_TAG_KINDS/);
  expect(pursue).toMatch(/PlaceTagModal/);
  expect(pursue).not.toMatch(/ChaseGame/);
  const chase = readFileSync(join(__dirname, 'pages/police/ChaseGame.tsx'), 'utf8');
  expect(chase.length).toBeGreaterThan(0);
});
