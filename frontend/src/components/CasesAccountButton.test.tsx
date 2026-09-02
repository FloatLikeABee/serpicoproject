import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CasesAccountButton from './CasesAccountButton';

const mockAuth = {
  logout: jest.fn(),
  setNation: jest.fn(),
  nation: 'us' as 'us' | 'cn',
  name: 'Demo User',
};

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'demo-serpico', name: mockAuth.name, nation: mockAuth.nation },
    logout: mockAuth.logout,
    setNation: mockAuth.setNation,
  }),
}));

function PathProbe() {
  const loc = useLocation();
  return <div data-testid="path">{loc.pathname}</div>;
}

function renderBtn() {
  return render(
    <MemoryRouter initialEntries={['/notes']}>
      <Routes>
        <Route
          path="/notes"
          element={
            <>
              <PathProbe />
              <CasesAccountButton />
            </>
          }
        />
        <Route path="/login" element={<PathProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockAuth.logout.mockReset();
  mockAuth.setNation.mockReset();
  mockAuth.nation = 'us';
  mockAuth.name = 'Demo User';
});

test('user button is labeled Account and does not show the account card until opened', () => {
  renderBtn();
  expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
});

test('opening the user button shows a small modal with nation, logout, and name; backdrop closes it', async () => {
  renderBtn();
  await userEvent.click(screen.getByRole('button', { name: 'Account' }));
  expect(screen.getByRole('dialog', { name: 'Account' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'United States' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'China' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  expect(screen.getByText('Demo User')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('presentation'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('path')).toHaveTextContent('/notes');
});

test('dismiss control closes the modal and stays off a login route', async () => {
  renderBtn();
  await userEvent.click(screen.getByRole('button', { name: 'Account' }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  expect(screen.getByTestId('path')).toHaveTextContent('/notes');
});

test('nation and logout use existing auth helpers', async () => {
  renderBtn();
  await userEvent.click(screen.getByRole('button', { name: 'Account' }));
  await userEvent.click(screen.getByRole('button', { name: 'China' }));
  expect(mockAuth.setNation).toHaveBeenCalledWith('cn');
  await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
  expect(mockAuth.logout).toHaveBeenCalled();
  expect(screen.getByTestId('path')).toHaveTextContent('/login');
});

test('China account labels the user button 账户', () => {
  mockAuth.nation = 'cn';
  renderBtn();
  expect(screen.getByRole('button', { name: '账户' })).toBeInTheDocument();
});
