import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { authAPI } from '../services/api';

jest.mock('../services/api', () => ({
  usersAPI: {
    getMe: jest.fn(() => Promise.resolve({ user: {} })),
    upsertNation: jest.fn(() => Promise.resolve()),
  },
  authAPI: {
    login: jest.fn(),
  },
}));

function Probe() {
  const { login, user, isAuthenticated } = useAuth();
  return (
    <div>
      <button type="button" onClick={() => login('offabc', 'secret-pass').catch((e) => {
        document.body.setAttribute('data-err', e.message);
      })}>
        invited
      </button>
      <button type="button" onClick={() => login('offabc', 'bad').catch((e) => {
        document.body.setAttribute('data-err', e.message);
      })}>
        bad
      </button>
      <button type="button" onClick={() => login('serpico', 'cops123').catch((e) => {
        document.body.setAttribute('data-err', e.message);
      })}>
        demo
      </button>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="id">{user?.id || ''}</span>
      <span data-testid="email">{user?.email || ''}</span>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.body.removeAttribute('data-err');
  (authAPI.login as jest.Mock).mockReset();
});

test('invited login applies the API user', async () => {
  (authAPI.login as jest.Mock).mockResolvedValue({
    user: { id: 'user-99', email: 'offabc', name: 'Officer offabc', role: 'police', rank: 'Officer' },
  });
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await userEvent.click(screen.getByText('invited'));
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'));
  expect(screen.getByTestId('id')).toHaveTextContent('user-99');
  expect(screen.getByTestId('email')).toHaveTextContent('offabc');
});

test('bad password throws', async () => {
  (authAPI.login as jest.Mock).mockRejectedValue({ response: { status: 401 } });
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await userEvent.click(screen.getByText('bad'));
  await waitFor(() => expect(document.body.getAttribute('data-err')).toMatch(/Invalid/));
  expect(screen.getByTestId('auth')).toHaveTextContent('no');
});

test('demo login still works when the API returns the demo user', async () => {
  (authAPI.login as jest.Mock).mockResolvedValue({
    user: { id: 'demo-serpico', email: 'serpico', name: 'Officer Serpico', role: 'police', rank: 'Officer' },
  });
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await userEvent.click(screen.getByText('demo'));
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'));
  expect(screen.getByTestId('id')).toHaveTextContent('demo-serpico');
});
