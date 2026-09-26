import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Xiaomaomi from './Xiaomaomi';

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/xiaomaomi');
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
  Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
});

test('fresh visit is 小茂密咖啡 in Chinese, with a hero and no officer chrome', () => {
  render(<Xiaomaomi />);
  expect(screen.getByRole('heading', { name: '小茂密咖啡' })).toBeInTheDocument();
  expect(screen.getByText('茂密')).toBeInTheDocument();
  expect(screen.getByText(/学生/)).toBeInTheDocument();
  expect(document.documentElement).toHaveClass('xm-world');
  expect(document.documentElement).not.toHaveClass('ll-world');
  expect(document.documentElement).not.toHaveClass('sm-world');
  expect(document.documentElement).not.toHaveClass('kx-world');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(document.querySelector('.fr-page')).toBeNull();
  expect(screen.getByRole('img', { name: '小茂密咖啡' })).toHaveAttribute('src', '/xiaomaomi/hero.jpg');
  expect(document.querySelector('video')).toBeNull();
  expect(document.querySelector('textarea')).toBeNull();
  expect(screen.queryByText(/已看/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '好了' })).not.toBeInTheDocument();
});

test('chips filter tea on the same path and a sheet shows the sugar kitten', async () => {
  render(<Xiaomaomi />);
  expect(screen.getByRole('button', { name: '全部' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '咖啡' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '茶' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '茶咖' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '暹罗糖云' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '茶' }));
  expect(window.location.pathname).toBe('/xiaomaomi');
  expect(screen.queryByRole('button', { name: '暹罗糖云' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '茉莉奶绒' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '全部' }));
  expect(window.location.pathname).toBe('/xiaomaomi');
  await userEvent.click(screen.getByRole('button', { name: '暹罗糖云' }));
  expect(document.querySelector('.xm-sheet')).toHaveTextContent('Siamese Baby Kitten Sugar Coffee');
  expect(document.body.textContent).not.toMatch(/[¥￥]/);
});

test('card titles render before every drink photo has a src', async () => {
  render(<Xiaomaomi />);
  expect(screen.getByText('暹罗糖云')).toBeInTheDocument();
  expect(screen.getByText('橘座美式')).toBeInTheDocument();
  expect(document.querySelectorAll('.xm-ph').length).toBeGreaterThanOrEqual(2);
  await waitFor(() => {
    const queued = Array.from(document.querySelectorAll('.xm-gallery img')) as HTMLImageElement[];
    expect(queued.length).toBe(12);
    expect(queued.filter((img) => img.getAttribute('src')).length).toBe(2);
  });
  const imgs = Array.from(document.querySelectorAll('.xm-gallery img')) as HTMLImageElement[];
  const withSrc = imgs.filter((img) => img.getAttribute('src'));
  fireEvent.load(withSrc[0]);
  const later = imgs.find((img) => !withSrc.includes(img));
  expect(later?.getAttribute('src')).toBe('/xiaomaomi/drinks/snow-cold-brew.jpg');
});
