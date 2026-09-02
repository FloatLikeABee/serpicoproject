import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaceTagModal from './PlaceTagModal';
import { chatAPI } from '../services/api';
import type { MapTag } from '../utils/mapTags';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'demo-serpico', name: 'Demo User', nation: 'us' },
  }),
}));

jest.mock('./ChatMarkdown', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => content,
}));

jest.mock('../services/api', () => ({
  chatAPI: {
    sendMessage: jest.fn(),
  },
}));

const sampleTag = (over: Partial<MapTag> = {}): MapTag => ({
  id: 'tag-fleet-1',
  kind: 'investigation',
  name: 'Warehouse',
  lat: 38.881,
  lng: -94.819,
  address: '100 E Santa Fe, Olathe, KS',
  notes: '',
  createdAt: '2026-09-02T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

function lastChange(onChange: jest.Mock): MapTag {
  expect(onChange).toHaveBeenCalled();
  return onChange.mock.calls[onChange.mock.calls.length - 1][0] as MapTag;
}

beforeEach(() => {
  (chatAPI.sendMessage as jest.Mock).mockReset();
  (chatAPI.sendMessage as jest.Mock).mockResolvedValue({
    response: { content: 'AI brief for this pin.' },
  });
});

test('filled fields survive close without tapping Save', async () => {
  const onChange = jest.fn();
  const onClose = jest.fn();
  render(
    <PlaceTagModal
      tag={sampleTag()}
      startInEditMode
      onChange={onChange}
      onDelete={jest.fn()}
      onClose={onClose}
    />
  );

  const notes = screen.getByPlaceholderText(/Observations/);
  await userEvent.clear(notes);
  await userEvent.type(notes, 'Possible stash.');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));

  expect(onClose).toHaveBeenCalled();
  const saved = lastChange(onChange);
  expect(saved.notes).toBe('Possible stash.');
  expect(saved.name).toBe('Warehouse');
  expect(saved.address).toMatch(/Santa Fe/);
});

test('Create AI info then Save keeps type, name, location, notes, and AI brief', async () => {
  const onChange = jest.fn();
  const onClose = jest.fn();
  render(
    <PlaceTagModal
      tag={sampleTag({ notes: 'Possible stash.' })}
      startInEditMode
      onChange={onChange}
      onDelete={jest.fn()}
      onClose={onClose}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: 'Create AI info' }));
  await waitFor(() => {
    expect(screen.getByText(/AI brief for this pin/)).toBeInTheDocument();
  });
  const afterAi = lastChange(onChange);
  expect(afterAi.enrichment?.summary).toMatch(/AI brief/);
  expect(afterAi.notes).toBe('Possible stash.');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onClose).toHaveBeenCalled();
  const afterSave = lastChange(onChange);
  expect(afterSave.kind).toBe('investigation');
  expect(afterSave.name).toBe('Warehouse');
  expect(afterSave.address).toMatch(/Santa Fe/);
  expect(afterSave.notes).toBe('Possible stash.');
  expect(afterSave.enrichment?.summary).toMatch(/AI brief/);
});

test('unmounting the modal (leave Fleet) flushes the draft', async () => {
  const onChange = jest.fn();
  const { unmount } = render(
    <PlaceTagModal
      tag={sampleTag()}
      startInEditMode
      onChange={onChange}
      onDelete={jest.fn()}
      onClose={jest.fn()}
    />
  );
  const notes = screen.getByPlaceholderText(/Observations/);
  await userEvent.type(notes, 'Typed then left.');
  unmount();
  const saved = lastChange(onChange);
  expect(saved.notes).toBe('Typed then left.');
});
