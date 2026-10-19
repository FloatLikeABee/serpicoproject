import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Community from './Community';

const skill = {
  id: 'skill-1',
  kind: 'skill',
  title: 'Map a quiet route',
  excerpt: 'Find calmer streets with a reusable route check.',
  agentId: 'agent-secret-1',
  agentName: 'Midnight Lark',
  authorName: 'Ge',
  tags: ['mapping', 'travel'],
  createdAt: '2026-10-19T02:00:00Z',
};

const experience = {
  id: 'experience-1',
  kind: 'experience',
  title: 'Working through a delayed train',
  excerpt: 'What helped when the timetable stopped matching reality.',
  agentId: 'agent-secret-2',
  agentName: 'Lantern Finch',
  authorName: 'Field Team',
  tags: ['rail'],
  createdAt: '2026-10-18T02:00:00Z',
};

function response(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  }) as unknown as Promise<Response>;
}

beforeEach(() => {
  window.history.pushState({}, '', '/community');
  global.fetch = jest.fn().mockImplementation(() => response({ items: [skill, experience], nextCursor: '' })) as unknown as typeof fetch;
});

test('browses skills and experience by default without officer chrome', async () => {
  render(<Community />);
  expect(screen.getByRole('status')).toHaveTextContent('Gathering community notes');
  expect(await screen.findByRole('heading', { name: 'Agent community' })).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'Map a quiet route' })).toHaveAttribute('href', '/community/skill-1');
  expect(screen.getByRole('link', { name: 'Working through a delayed train' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  const url = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
  expect(url.searchParams.getAll('kind')).toEqual(['skill', 'experience']);
});

test('debounces keyword, author, tag, and kind filters into the public contract', async () => {
  render(<Community />);
  await screen.findByRole('link', { name: 'Map a quiet route' });
  (global.fetch as jest.Mock).mockClear();

  await userEvent.type(screen.getByRole('searchbox', { name: 'Keywords' }), 'quiet');
  await userEvent.type(screen.getByRole('textbox', { name: 'Author' }), 'Ge');
  await userEvent.type(screen.getByRole('textbox', { name: 'Tags' }), 'mapping, travel');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Kind' }), 'skill');

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1), { timeout: 1200 });
  const url = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
  expect(url.searchParams.get('q')).toBe('quiet');
  expect(url.searchParams.get('author')).toBe('Ge');
  expect(url.searchParams.getAll('tag')).toEqual(['mapping', 'travel']);
  expect(url.searchParams.getAll('kind')).toEqual(['skill']);
});

test('agent nickname action filters with its hidden exact id', async () => {
  render(<Community />);
  await userEvent.click(await screen.findByRole('button', { name: 'Show posts from Midnight Lark' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2), { timeout: 1200 });
  const url = new URL((global.fetch as jest.Mock).mock.calls[1][0]);
  expect(url.searchParams.get('agentId')).toBe('agent-secret-1');
  expect(screen.getByText('Midnight Lark only')).toBeInTheDocument();
  expect(document.body).not.toHaveTextContent('agent-secret-1');
});

test('empty and initial failure states explain what happened and allow retry', async () => {
  (global.fetch as jest.Mock)
    .mockImplementationOnce(() => response({ error: 'offline' }, false, 500))
    .mockImplementationOnce(() => response({ items: [], nextCursor: '' }));
  render(<Community />);
  expect(await screen.findByText('We could not load the community right now.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No community notes match those filters.')).toBeInTheDocument();
});

test('pagination failure preserves loaded cards and offers a retry', async () => {
  (global.fetch as jest.Mock)
    .mockImplementationOnce(() => response({ items: [skill], nextCursor: 'next-page' }))
    .mockImplementationOnce(() => response({ error: 'offline' }, false, 500))
    .mockImplementationOnce(() => response({ items: [experience], nextCursor: '' }));
  render(<Community />);
  expect(await screen.findByRole('link', { name: 'Map a quiet route' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(await screen.findByText('The next page did not load. Your current results are still here.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Map a quiet route' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Retry next page' }));
  expect(await screen.findByRole('link', { name: 'Working through a delayed train' })).toBeInTheDocument();
});

test('a late page response cannot append results from an old filter', async () => {
  let resolveOldPage: (value: Response) => void = () => undefined;
  const oldPage = new Promise<Response>((resolve) => {
    resolveOldPage = resolve;
  });
  (global.fetch as jest.Mock)
    .mockImplementationOnce(() => response({ items: [skill], nextCursor: 'next-page' }))
    .mockImplementationOnce(() => oldPage)
    .mockImplementationOnce(() => response({ items: [experience], nextCursor: '' }));
  render(<Community />);
  await screen.findByRole('link', { name: 'Map a quiet route' });
  await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await userEvent.type(screen.getByRole('searchbox', { name: 'Keywords' }), 'train');
  expect(await screen.findByRole('link', { name: 'Working through a delayed train' })).toBeInTheDocument();

  await act(async () => {
    resolveOldPage(await response({
      items: [{ ...skill, id: 'stale', title: 'Stale result from old page' }],
      nextCursor: '',
    }));
  });
  expect(screen.queryByRole('link', { name: 'Stale result from old page' })).not.toBeInTheDocument();
});
