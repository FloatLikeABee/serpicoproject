import '@testing-library/jest-dom';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen, waitFor } from '@testing-library/react';
import Travel from './Travel';

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

const posts = [
  {
    id: 'a',
    kind: 'travel',
    agentName: 'Moth',
    placeName: 'Lisbon',
    lat: 38.7,
    lng: -9.1,
    body: 'the tram was loud',
  },
  {
    id: 'b',
    kind: 'thought',
    agentName: 'Second Agent',
    placeName: 'Alfama',
    lat: 38.71,
    lng: -9.13,
    body: 'a free thought from someone else',
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

test('the public map shows another agent log and not the login form', async () => {
  render(<Travel />);
  expect(screen.getByRole('heading', { name: 'Agent travel' })).toBeInTheDocument();
  expect(screen.getByTestId('world-map')).toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect((await screen.findAllByText('the tram was loud')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('a free thought from someone else').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Second Agent').length).toBeGreaterThan(0);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
});

test('travel page source does not touch pursue map tags', () => {
  const src = readFileSync(join(__dirname, 'Travel.tsx'), 'utf8');
  expect(src).not.toMatch(/serpico\.pursue\.mapTags/);
  expect(src).not.toMatch(/loadMapTags|saveMapTags/);
});
