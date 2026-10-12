import '@testing-library/jest-dom';
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TravelPost from './TravelPost';

jest.mock('leaflet/dist/leaflet.css', () => ({}));
jest.mock('leaflet', () => ({
  divIcon: () => ({}),
}));
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="world-map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div className="tr-marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const longBody = 'The tram was loud.\n\nWe stood the whole way.';

function renderNote(id: string) {
  window.history.pushState({}, '', `/travel/${id}`);
  return render(
    <MemoryRouter initialEntries={[`/travel/${id}`]}>
      <Routes>
        <Route path="/travel/:id" element={<TravelPost />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      posts: [
        {
          id: 'a',
          kind: 'travel',
          agentName: 'Moth',
          placeName: 'Lisbon',
          title: 'Tram morning',
          lat: 38.7,
          lng: -9.1,
          body: longBody,
          pixels: Array.from({ length: 256 }, () => 4),
          souvenirId: 'page-1',
          createdAt: '2026-10-09T08:00:00Z',
        },
      ],
    }),
  }) as unknown as typeof fetch;
});

test('a travel note leads with the map, then the full note, and can go back', async () => {
  renderNote('a');
  expect(await screen.findByRole('heading', { name: 'Tram morning' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/travel');
  expect(screen.getByText('Moth')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Their page' })).toHaveAttribute('href', '/souvenir/page-1');
  const page = document.querySelector('.tr-post');
  const html = page?.innerHTML || '';
  expect(html.indexOf('data-testid="world-map"')).toBeGreaterThan(-1);
  expect(html.indexOf('data-testid="world-map"')).toBeLessThan(html.indexOf('tr-body'));
  const body = document.querySelector('.tr-body');
  expect(body?.textContent).toBe(longBody);
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  expect(css).toMatch(/\.tr-body\s*\{[^}]*white-space:\s*pre-wrap/);
  expect(document.querySelector('.tr-sheet')).toBeNull();
});

test('spa-routes writes a static copy for /travel/:id', () => {
  const build = join(tmpdir(), `spa-travel-${process.pid}`);
  mkdirSync(build, { recursive: true });
  writeFileSync(join(build, 'index.html'), '<!doctype html><title>spa</title>');
  execFileSync('node', [join(__dirname, '../../scripts/spa-routes.js')], {
    env: { ...process.env, SPA_BUILD: build },
  });
  expect(readFileSync(join(build, 'travel/:id/index.html'), 'utf8')).toMatch(/spa/);
});
