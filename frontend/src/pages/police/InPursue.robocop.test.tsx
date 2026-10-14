import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InPursue from './InPursue';
import type { MapTag } from '../../utils/mapTags';

jest.mock('../../services/api', () => ({
  chatAPI: {},
}));

jest.mock('../../components/ChatMarkdown', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <p>{content}</p>,
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'demo-serpico', name: 'Demo User', nation: 'us' },
  }),
}));

jest.mock('../../components/PursuitMapCanvas', () => ({
  __esModule: true,
  default: ({
    mapTags,
    onTagClick,
  }: {
    mapTags?: MapTag[];
    onTagClick?: (tag: MapTag) => void;
  }) => (
    <div data-testid="pursue-canvas">
      {(mapTags || []).map((tag) => (
        <button key={tag.id} type="button" data-kind={tag.kind} onClick={() => onTagClick?.(tag)}>
          {tag.name}
        </button>
      ))}
    </div>
  ),
}));

const privateKey = 'serpico.pursue.mapTags.v1.demo-serpico';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    privateKey,
    JSON.stringify([
      {
        id: 't1',
        kind: 'witness',
        name: 'Alley witness',
        lat: 38.88,
        lng: -94.81,
        address: '200 E Santa Fe, Olathe, KS',
        notes: 'Saw a red sedan.',
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
      },
    ])
  );
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/robocop-notes')) {
      return {
        ok: true,
        json: async () => ({
          notes: [
            {
              id: 'note-1',
              agentName: 'Amber Lark',
              kind: 'evidence',
              placeName: 'Rua da Bica',
              lat: 38.71,
              lng: -9.14,
              body: 'A paper bag sat on the step.',
            },
          ],
        }),
      };
    }
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
});

test('a robocop note is a pin on Pursue and stays out of the private list', async () => {
  const view = render(<InPursue />);
  expect(screen.getByRole('heading', { name: 'Pursue' })).toBeInTheDocument();
  const pin = await screen.findByRole('button', { name: 'Rua da Bica' });
  expect(pin).toHaveAttribute('data-kind', 'evidence');
  expect(screen.getByRole('button', { name: 'Alley witness' })).toBeInTheDocument();

  await userEvent.click(pin);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Amber Lark');
  expect(dialog).toHaveTextContent('A paper bag sat on the step.');
  expect(dialog).toHaveTextContent('Rua da Bica');
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

  const stored = localStorage.getItem(privateKey) || '';
  expect(stored).toContain('Alley witness');
  expect(stored).not.toContain('Rua da Bica');
  expect(stored).not.toContain('Amber Lark');

  view.unmount();
  const after = localStorage.getItem(privateKey) || '';
  expect(after).toContain('Alley witness');
  expect(after).not.toContain('Rua da Bica');
  expect(after).not.toContain('note-1');
});
