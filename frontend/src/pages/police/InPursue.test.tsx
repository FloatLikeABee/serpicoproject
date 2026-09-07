import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InPursue from './InPursue';
import type { MapTag } from '../../utils/mapTags';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'demo-serpico', name: 'Demo User', nation: 'us' },
  }),
}));

jest.mock('../../components/PursuitMapCanvas', () => ({
  __esModule: true,
  default: ({ focusPinId }: { focusPinId?: string | null }) => (
    <div data-testid="pursue-canvas" data-focus={focusPinId || ''} />
  ),
}));

jest.mock('../../components/PlaceTagModal', () => ({
  __esModule: true,
  default: ({ tag }: { tag: { name: string } }) => <div role="dialog">{tag.name}</div>,
}));

const tag = (over: Partial<MapTag> = {}): MapTag => ({
  id: 't1',
  kind: 'witness',
  name: 'Alley witness',
  lat: 38.88,
  lng: -94.81,
  address: '200 E Santa Fe, Olathe, KS',
  notes: 'Saw a red sedan.',
  createdAt: '2026-09-02T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'serpico.pursue.mapTags.v1.demo-serpico',
    JSON.stringify([tag()])
  );
  localStorage.setItem(
    'serpico.fleet.markers.v1.demo-serpico',
    JSON.stringify([
      {
        id: 'fleet-only',
        kind: 'investigation',
        name: 'Fleet warehouse',
        notes: 'Should not appear on Pursue',
        cityId: 'olathe',
        lat: 38.88,
        lng: -94.81,
        address: '100 E Santa Fe',
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
      },
    ])
  );
});

test('Pursue search uses map tags only and selecting a tag opens it', async () => {
  render(<InPursue />);

  const input = screen.getByRole('searchbox', { name: 'Search places or notes' });
  await userEvent.type(input, 'sedan');
  expect(screen.getByRole('button', { name: /Alley witness/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Fleet warehouse/ })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Alley witness/ }));
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toHaveTextContent('Alley witness');
  });
  expect(screen.getByTestId('pursue-canvas')).toHaveAttribute('data-focus', 't1');
});
