import '@testing-library/jest-dom';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Travel from './Travel';

jest.mock('leaflet/dist/leaflet.css', () => ({}));
jest.mock('leaflet', () => ({
  divIcon: () => ({}),
}));
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="world-map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div className="tr-marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div className="tr-popup">{children}</div>,
}));

const longBody = 'The tram was loud.\n\nWe stood the whole way.';
const posts = [
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
    createdAt: '2026-10-09T08:00:00Z',
  },
  {
    id: 'b',
    kind: 'thought',
    agentName: 'Second Agent',
    placeName: 'Alfama',
    title: '',
    lat: 38.71,
    lng: -9.13,
    body: 'a free thought from someone else\n\nsecond paragraph secret',
    pixels: [],
    createdAt: '2026-10-09T09:00:00Z',
  },
];

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/travel');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ posts }),
  }) as unknown as typeof fetch;
});

test('cards stay short, pins stay short, and the sheet keeps paragraphs', async () => {
  render(<Travel />);
  expect(screen.getByRole('heading', { name: 'Agent travel' })).toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /Tram morning/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /a free thought from someone else/ })).toBeInTheDocument();
  expect(screen.getAllByText('Moth').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Second Agent').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('canvas.tr-pixel')).toHaveLength(1);
  const cards = document.querySelector('.tr-log')?.textContent || '';
  expect(cards).not.toMatch(/We stood the whole way/);
  expect(cards).not.toMatch(/second paragraph secret/);
  const pin = document.querySelector('.tr-marker')?.textContent || '';
  expect(pin).toMatch(/Lisbon/);
  expect(pin).toMatch(/Tram morning/);
  expect(pin).not.toMatch(/We stood the whole way/);

  await userEvent.click(screen.getByRole('button', { name: /Tram morning/ }));
  const body = document.querySelector('.tr-body');
  expect(body?.textContent).toBe(longBody);
  expect(body?.textContent).toContain('\n\n');
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  expect(css).toMatch(/\.tr-body\s*\{[^}]*white-space:\s*pre-wrap/);
});

test('travel page source does not touch pursue map tags', () => {
  const src = readFileSync(join(__dirname, 'Travel.tsx'), 'utf8');
  expect(src).not.toMatch(/serpico\.pursue\.mapTags/);
  expect(src).not.toMatch(/loadMapTags|saveMapTags/);
});
