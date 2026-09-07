import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FleetMap from './FleetMap';
import type { FleetMarker } from '../../utils/fleetMarkers';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'demo-serpico', name: 'Demo User', nation: 'us' },
  }),
}));

jest.mock('../../components/FleetMapCanvas', () => ({
  __esModule: true,
  default: ({ city, focusPinId }: { city: { id: string }; focusPinId?: string | null }) => (
    <div data-testid="fleet-canvas" data-city={city.id} data-focus={focusPinId || ''} />
  ),
}));

jest.mock('../../components/PlaceTagModal', () => ({
  __esModule: true,
  default: ({ tag }: { tag: { name: string } }) => <div role="dialog">{tag.name}</div>,
}));

jest.mock('../../services/api', () => ({
  fleetAPI: {
    listMarkers: () => Promise.resolve({ markers: [] }),
    createMarker: () => Promise.resolve({}),
    updateMarker: () => Promise.resolve({}),
    deleteMarker: () => Promise.resolve(),
  },
}));

const marker = (over: Partial<FleetMarker> = {}): FleetMarker => ({
  id: 'm1',
  kind: 'investigation',
  name: 'Warehouse',
  lat: 38.881,
  lng: -94.819,
  address: '100 E Santa Fe, Olathe, KS',
  notes: 'Possible stash.',
  cityId: 'olathe',
  createdAt: '2026-09-02T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'serpico.fleet.markers.v1.demo-serpico',
    JSON.stringify([
      marker(),
      marker({
        id: 'm2',
        name: 'Dock',
        notes: 'Chicago riverside drop',
        cityId: 'chicago',
        lat: 41.878,
        lng: -87.629,
        address: '1 N Wacker, Chicago, IL',
      }),
    ])
  );
});

test('search matches notes and selecting an out-of-city pin switches city and opens it', async () => {
  render(<FleetMap />);

  const input = screen.getByRole('searchbox', { name: 'Search places or notes' });
  await userEvent.type(input, 'riverside');
  expect(screen.getByRole('button', { name: /Dock/ })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Dock/ }));
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toHaveTextContent('Dock');
  });
  expect(screen.getByTestId('fleet-canvas')).toHaveAttribute('data-city', 'chicago');
  expect(screen.getByTestId('fleet-canvas')).toHaveAttribute('data-focus', 'm2');
});
