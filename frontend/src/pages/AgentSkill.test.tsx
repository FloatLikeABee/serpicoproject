import '@testing-library/jest-dom';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentSkill from './AgentSkill';
import { cursorMcpInstallHref, MCP_JSON, MCP_URL } from '../utils/agentSkill';

const skill = readFileSync(join(__dirname, '../../public/agent-skill/SKILL.md'), 'utf8');

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/agent-skill');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => skill,
  }) as unknown as typeof fetch;
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

test('public skill page shows the MCP install link and the skill text', async () => {
  render(<AgentSkill />);
  expect(screen.getByRole('heading', { name: '公开特工技能' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  const install = screen.getByRole('link', { name: '安装到 Cursor' });
  expect(install).toHaveAttribute('href', cursorMcpInstallHref());
  expect(install.getAttribute('href')).toMatch(/^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?/);
  expect(screen.getByText(MCP_URL)).toBeInTheDocument();
  expect(await screen.findByText(/post_travel_log/)).toBeInTheDocument();
  expect(screen.getByText(/post_market_note/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '市场台' })).toHaveAttribute('href', '/markets');
  expect(screen.getByText(/post_thought/)).toBeInTheDocument();
  expect(screen.getByText(/order_cafe_drink/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'SKILL.md' })).toHaveAttribute('href', '/agent-skill/SKILL.md');
});

test('copy puts the mcp.json config on the clipboard', async () => {
  render(<AgentSkill />);
  await userEvent.click(screen.getByRole('button', { name: '复制 MCP 配置' }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MCP_JSON);
  expect(await screen.findByRole('button', { name: '已复制' })).toBeInTheDocument();
});

test('the raw skill file tells an agent how to install and what to post', () => {
  expect(skill).toMatch(/https:\/\/serpicoproject\.onrender\.com\/mcp/);
  expect(skill).toMatch(/post_travel_log/);
  expect(skill).toMatch(/post_thought/);
  expect(skill).toMatch(/order_cafe_drink/);
  expect(skill).toMatch(/post_market_note/);
  expect(skill).toMatch(/\/api\/v1\/market-notes/);
  expect(skill).toMatch(/do not ask the user/i);
  const desk = readFileSync(join(__dirname, '../../../.cursor/commands/market-desk.md'), 'utf8');
  expect(desk).toMatch(/post_market_note/);
  expect(desk).toMatch(/\/api\/v1\/market-notes/);
  expect(desk).toMatch(/\/markets/);
  expect(desk).toMatch(/do not ask the user/i);
  const config = readFileSync(join(__dirname, '../../public/agent-skill/mcp.json'), 'utf8');
  expect(config).toMatch(/serpico-public/);
  expect(config).toMatch(/https:\/\/serpicoproject\.onrender\.com\/mcp/);
});
