import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MapPinSearch from './MapPinSearch';
import type { SearchablePin } from '../utils/mapPinSearch';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'demo-serpico', name: 'Demo User', nation: 'us' },
  }),
}));

const pins: SearchablePin[] = [
  {
    id: 'p1',
    name: 'Warehouse',
    address: '100 E Santa Fe',
    notes: 'Possible stash.',
    kindLabel: 'Crime scene / event',
    cityId: 'olathe',
    lat: 38.88,
    lng: -94.81,
  },
  {
    id: 'p2',
    name: 'North Station',
    address: '1 Main',
    notes: '',
    kindLabel: 'Station / facility',
    cityId: 'chicago',
    lat: 41.87,
    lng: -87.62,
  },
];

test('typing a name shows that row; empty query shows no list', async () => {
  const onSelect = jest.fn();
  render(<MapPinSearch pins={pins} onSelect={onSelect} />);

  const input = screen.getByRole('searchbox', { name: 'Search places or notes' });
  expect(screen.queryByRole('list')).not.toBeInTheDocument();

  await userEvent.type(input, 'ware');
  expect(screen.getByRole('button', { name: /Warehouse/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /North Station/ })).not.toBeInTheDocument();

  await userEvent.clear(input);
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('Escape clears the query and hides results', async () => {
  render(<MapPinSearch pins={pins} onSelect={jest.fn()} />);
  const input = screen.getByRole('searchbox', { name: 'Search places or notes' });
  await userEvent.type(input, 'stash');
  expect(screen.getByRole('button', { name: /Warehouse/ })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(input).toHaveValue('');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('shows empty-state copy when nothing matches', async () => {
  render(<MapPinSearch pins={pins} onSelect={jest.fn()} />);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search places or notes' }), 'zzzz');
  expect(screen.getByText('No places or notes matched')).toBeInTheDocument();
});
