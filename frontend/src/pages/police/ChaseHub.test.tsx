import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChaseHub, { hubTabFromLocation } from './ChaseHub';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'demo-serpico', name: 'Demo User', nation: 'us' },
  }),
}));

jest.mock('./FleetMap', () => () => <div>pin-map</div>);
jest.mock('./InvestigationHelper', () => () => <div>helper</div>);

describe('hubTabFromLocation', () => {
  it('selects the pin map for tab=fleet', () => {
    expect(hubTabFromLocation('/chase-game', '?tab=fleet')).toBe('fleet');
  });

  it('selects the pin map for tab=action', () => {
    expect(hubTabFromLocation('/chase-game', '?tab=action')).toBe('fleet');
  });

  it('selects investigation from the helper path', () => {
    expect(hubTabFromLocation('/investigation-helper', '')).toBe('investigation');
  });
});

describe('ChaseHub chrome', () => {
  it('labels the tablist as Action desk modules', () => {
    render(
      <MemoryRouter initialEntries={['/chase-game']}>
        <ChaseHub />
      </MemoryRouter>
    );
    expect(screen.getByRole('tablist', { name: 'Action desk modules' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Action' })).toBeInTheDocument();
  });
});
