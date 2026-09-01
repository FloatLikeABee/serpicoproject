import { readFileSync } from 'fs';
import { join } from 'path';

test('officer Navigation and Login have no hardware-registry link; /x-hard-data remains', () => {
  const nav = readFileSync(join(__dirname, 'components/Navigation.tsx'), 'utf8');
  const login = readFileSync(join(__dirname, 'pages/Login.tsx'), 'utf8');
  const app = readFileSync(join(__dirname, 'App.tsx'), 'utf8');
  expect(nav).not.toMatch(/\/hardware/);
  expect(login).not.toMatch(/\/hardware/);
  expect(app).toMatch(/path="\/x-hard-data"/);
});
