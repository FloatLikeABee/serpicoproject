import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DataViewer from './DataViewer';
import { adminAPI } from '../services/api';

jest.mock('../services/api', () => ({
  API_BASE_URL: 'https://serpicoproject.onrender.com/api/v1',
  adminAPI: {
    getAllUsers: jest.fn(),
    listInvites: jest.fn(),
    createInvite: jest.fn(),
  },
}));

function renderUsers() {
  return render(
    <MemoryRouter initialEntries={['/data/users']}>
      <Routes>
        <Route path="/data/:module" element={<DataViewer />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  (adminAPI.getAllUsers as jest.Mock).mockResolvedValue({ data: { users: [] } });
  (adminAPI.listInvites as jest.Mock).mockResolvedValue({ data: { invites: [] } });
  (adminAPI.createInvite as jest.Mock).mockResolvedValue({
    data: {
      code: 'abc123invite-code-that-is-long-enough-hex',
      username: 'offk3mnpqrst',
      password: 'GeneratedPass12',
    },
  });
});

test('Generate creates an invite and shows the returned code', async () => {
  renderUsers();
  expect(await screen.findByRole('heading', { name: /Users/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Generate/i }));
  await waitFor(() => {
    expect(adminAPI.createInvite).toHaveBeenCalled();
  });
  expect(await screen.findByText('abc123invite-code-that-is-long-enough-hex')).toBeInTheDocument();
  expect(screen.getByText(/offk3mnpqrst/)).toBeInTheDocument();
});
