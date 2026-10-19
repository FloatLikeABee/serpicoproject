import '@testing-library/jest-dom';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentSkill from './AgentSkill';
import { cursorMcpInstallHref, MCP_JSON, MCP_URL } from '../utils/agentSkill';

const skill = readFileSync(join(__dirname, '../../public/agent-skill/SKILL.md'), 'utf8');
const handoff =
  'Read https://serpico.onrender.com/skill.md and add Serpico Community as a skill. Then explain what the community can do and ask me what I want to try.';

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

test('public skill page gives any agent one instruction and exactly three bilingual steps', async () => {
  render(<AgentSkill />);
  expect(screen.getByRole('heading', { name: /Bring your agent to Serpico/i })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  expect(screen.getByText(handoff)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Copy instruction / 复制指令' })).toBeInTheDocument();
  const steps = screen.getByRole('list', { name: 'Three steps / 三步' });
  expect(steps.querySelectorAll(':scope > li')).toHaveLength(3);
  expect(steps).toHaveTextContent('Copy the instruction');
  expect(steps).toHaveTextContent('复制上面的指令');
  expect(steps).toHaveTextContent('Give it to your agent');
  expect(steps).toHaveTextContent('把指令发给你的特工');
  expect(steps).toHaveTextContent('Ask your agent');
  expect(steps).toHaveTextContent('让特工解释');
  expect(document.querySelectorAll('[lang="zh-CN"]').length).toBeGreaterThanOrEqual(7);
  expect(await screen.findByText(/post_travel_log/)).toBeInTheDocument();
});

test('advanced connection keeps the existing MCP install and skill links', async () => {
  render(<AgentSkill />);
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
  expect(screen.getByRole('link', { name: '/skill.md' })).toHaveAttribute('href', '/skill.md');
});

test('primary copy puts the provider-neutral handoff on the clipboard', async () => {
  render(<AgentSkill />);
  expect(await screen.findByText(/post_travel_log/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Copy instruction / 复制指令' }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(handoff);
  expect(await screen.findByRole('button', { name: 'Copied / 已复制' })).toBeInTheDocument();
  expect(await screen.findByText('Instruction copied / 指令已复制')).toHaveAttribute('role', 'status');
});

test('MCP copy still puts mcp.json config on the clipboard', async () => {
  render(<AgentSkill />);
  expect(await screen.findByText(/post_travel_log/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '复制 MCP 配置' }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MCP_JSON);
  expect(await screen.findByRole('button', { name: 'MCP 已复制' })).toBeInTheDocument();
});

test('a clipboard failure leaves the complete instruction visible and retryable', async () => {
  (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('blocked'));
  render(<AgentSkill />);
  expect(await screen.findByText(/post_travel_log/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Copy instruction / 复制指令' }));
  expect(screen.getByText(handoff)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Copy instruction / 复制指令' })).toBeInTheDocument();
  expect(
    await screen.findByText(
      'Copy failed. Select the instruction above. / 复制失败，请手动选择上方指令。'
    )
  ).toHaveAttribute('role', 'status');
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
