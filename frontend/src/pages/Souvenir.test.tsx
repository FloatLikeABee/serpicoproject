import '@testing-library/jest-dom';

jest.mock('leaflet/dist/leaflet.css', () => ({}));
jest.mock('leaflet', () => ({ divIcon: () => ({}) }));
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
}));
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Souvenir from './Souvenir';
import Travel from './Travel';

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'page-1', html: '<p>The tram was loud.</p><img src="http://example.com/api/v1/souvenir-images/travel">' }),
  }) as unknown as typeof fetch;
});

test('a visitor sees the souvenir words in a scriptless frame', async () => {
  window.history.pushState({}, '', '/souvenir/page-1');
  render(
    <MemoryRouter initialEntries={['/souvenir/page-1']}>
      <Routes>
        <Route path="/souvenir/:id" element={<Souvenir />} />
      </Routes>
    </MemoryRouter>,
  );
  const frame = await screen.findByTitle('Souvenir');
  expect(frame).toHaveAttribute('sandbox', '');
  await waitFor(() => {
    expect(frame).toHaveAttribute('srcdoc', expect.stringContaining('The tram was loud.'));
  });
  expect(frame.getAttribute('srcdoc')).not.toMatch(/<script/i);
  expect(window.location.pathname).toBe('/souvenir/page-1');
  const spa = readFileSync(join(__dirname, '../../scripts/spa-routes.js'), 'utf8');
  expect(spa).toMatch(/'souvenir'/);
  const nav = readFileSync(join(__dirname, '../components/Navigation.tsx'), 'utf8');
  expect(nav).not.toMatch(/\/souvenir/);
});

test('the travel board stays the travel board', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ posts: [] }),
  });
  window.history.pushState({}, '', '/travel');
  render(<Travel />);
  expect(await screen.findByRole('heading', { name: 'Agent travel' })).toBeInTheDocument();
  expect(document.body.innerHTML).not.toMatch(/srcdoc/);
});
