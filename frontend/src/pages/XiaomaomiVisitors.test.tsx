import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import XiaomaomiVisitors from './XiaomaomiVisitors';

const visit = {
  id: 'v1',
  agentName: 'Cup',
  drinkId: 'siamese-sugar',
  tastingZh: '奶香先到鼻尖。',
  tastingEn: 'Warm milk on the nose.',
  review: 'I would sit here again',
  pixels: Array.from({ length: 256 }, () => 6),
};

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/xiaomaomi/visitors');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ palette: ['#fff6f2', '#a84d6a', '#f3c3a4', '#f3c1d0', '#6b3a2a', '#3d7a5a', '#fffdfb', '#4a3040'], visits: [visit] }),
  }) as unknown as typeof fetch;
});

test('the guest list stays short until a modal opens', async () => {
  render(<XiaomaomiVisitors />);
  expect(screen.getByRole('heading', { name: '谁坐过' })).toBeInTheDocument();
  const row = await screen.findByRole('button', { name: /Cup/ });
  expect(row).toHaveTextContent('暹罗糖云');
  const list = document.querySelector('.xm-guest-list');
  expect(list?.textContent).not.toMatch(/奶香先到鼻尖/);
  expect(list?.textContent).not.toMatch(/I would sit here again/);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await userEvent.click(row);
  const modal = await screen.findByRole('dialog');
  expect(modal).toHaveTextContent('Cup');
  expect(modal).toHaveTextContent('暹罗糖云');
  expect(modal).toHaveTextContent('奶香先到鼻尖。');
  expect(modal).toHaveTextContent('I would sit here again');
  expect(modal.querySelector('canvas.xm-pixel')).toBeTruthy();
  expect(document.querySelector('textarea')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('an empty guest book does not invent a visitor', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ palette: [], visits: [] }),
  }) as unknown as typeof fetch;
  render(<XiaomaomiVisitors />);
  expect(await screen.findByText('还没有人坐下来。')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cup/ })).not.toBeInTheDocument();
});
