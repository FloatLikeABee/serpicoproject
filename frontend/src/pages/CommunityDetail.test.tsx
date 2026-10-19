import '@testing-library/jest-dom';
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CommunityDetail from './CommunityDetail';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => undefined }));

const skillMarkdown = '---\nname: map-a-quiet-route\ndescription: "Find calmer streets"\n---\n# Route\n\nUse sidewalks.';
const skill = {
  id: 'skill-1',
  kind: 'skill',
  title: 'Map a quiet route',
  summary: 'Find calmer streets',
  body: '# Route\n\n<script>window.hacked = true</script>\n\n**Use sidewalks.**',
  agentId: 'agent-secret-1',
  agentName: 'Midnight Lark',
  authorName: 'Ge',
  tags: ['mapping', 'travel'],
  skillMarkdown,
  downloadUrl: '/api/v1/agent-content/skill-1/download',
  createdAt: '2026-10-19T02:00:00Z',
};

function renderDetail(id = 'skill-1') {
  return render(
    <MemoryRouter initialEntries={[`/community/${id}`]}>
      <Routes>
        <Route path="/community/:id" element={<CommunityDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => skill,
  }) as unknown as typeof fetch;
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

test('renders safe complete Markdown and keeps the exact agent id out of visible copy', async () => {
  renderDetail();
  expect(await screen.findByRole('heading', { name: 'Map a quiet route' })).toBeInTheDocument();
  expect(screen.getByTestId('markdown')).toHaveTextContent('Use sidewalks.');
  expect(document.querySelector('script')).toBeNull();
  expect(screen.getByRole('link', { name: 'Midnight Lark' })).toHaveAttribute(
    'href',
    '/community?agentId=agent-secret-1&agentName=Midnight%20Lark',
  );
  expect(document.body).not.toHaveTextContent('agent-secret-1');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('skill copy and download use the same canonical Markdown document', async () => {
  renderDetail();
  await screen.findByRole('heading', { name: 'Map a quiet route' });
  await userEvent.click(screen.getByRole('button', { name: 'Copy SKILL.md' }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(skillMarkdown);
  expect(await screen.findByText('Copied SKILL.md')).toHaveAttribute('role', 'status');
  expect(screen.getByRole('link', { name: 'Download SKILL.md' })).toHaveAttribute(
    'href',
    'https://serpicoproject.onrender.com/api/v1/agent-content/skill-1/download',
  );
});

test('experience detail has no installable skill actions', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      ...skill,
      id: 'experience-1',
      kind: 'experience',
      title: 'Working through delays',
      skillMarkdown: '',
      downloadUrl: '',
    }),
  });
  renderDetail('experience-1');
  expect(await screen.findByRole('heading', { name: 'Working through delays' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Copy SKILL.md' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Download SKILL.md' })).not.toBeInTheDocument();
});

test('unknown detail explains not found and links back to browse', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 404,
    json: async () => ({ error: 'not found' }),
  });
  renderDetail('missing');
  expect(await screen.findByRole('heading', { name: 'Community note not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to community' })).toHaveAttribute('href', '/community');
});

test('spa-routes writes static copies for community browse and detail', () => {
  const build = join(tmpdir(), `spa-community-${process.pid}`);
  mkdirSync(build, { recursive: true });
  writeFileSync(join(build, 'index.html'), '<!doctype html><title>spa</title>');
  execFileSync('node', [join(__dirname, '../../scripts/spa-routes.js')], {
    env: { ...process.env, SPA_BUILD: build },
  });
  expect(readFileSync(join(build, 'community/index.html'), 'utf8')).toMatch(/spa/);
  expect(readFileSync(join(build, 'community/:id/index.html'), 'utf8')).toMatch(/spa/);
});
