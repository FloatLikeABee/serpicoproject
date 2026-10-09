import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

test('肾结石快消散 is not mounted in the app, static routes, or API', () => {
  const app = readFileSync(join(__dirname, 'App.tsx'), 'utf8');
  const spaRoutes = readFileSync(join(__dirname, '../scripts/spa-routes.js'), 'utf8');
  const css = readFileSync(join(__dirname, 'index.css'), 'utf8');
  const catalog = readFileSync(join(__dirname, 'i18n/catalog.ts'), 'utf8');
  const worlds = readFileSync(join(__dirname, 'utils/loungeWorld.ts'), 'utf8');
  const routes = readFileSync(join(__dirname, '../../backend/internal/api/routes.go'), 'utf8');

  expect(app).not.toMatch(/kuaixiaosan|Kuaixiaosan|肾结石快消散/);
  expect(spaRoutes).not.toMatch(/kuaixiaosan/);
  expect(css).not.toMatch(/kx-world|\.kx-/);
  expect(catalog).not.toMatch(/kuaixiaosan\./);
  expect(worlds).not.toMatch(/kx-world/);
  expect(routes).not.toMatch(/kuaixiaosan|Kuaixiaosan|肾结石/);
  expect(existsSync(join(__dirname, 'pages/Kuaixiaosan.tsx'))).toBe(false);
  expect(existsSync(join(__dirname, '../public/kuaixiaosan'))).toBe(false);
});
