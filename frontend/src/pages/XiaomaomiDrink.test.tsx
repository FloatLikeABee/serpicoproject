import '@testing-library/jest-dom';
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import XiaomaomiDrink from './XiaomaomiDrink';

function renderDrink(id = 'siamese-sugar') {
  window.history.pushState({}, '', `/xiaomaomi/drinks/${id}`);
  return render(
    <MemoryRouter initialEntries={[`/xiaomaomi/drinks/${id}`]}>
      <Routes>
        <Route path="/xiaomaomi/drinks/:id" element={<XiaomaomiDrink />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

test('a drink page leads with the picture, then the words, and goes back', () => {
  renderDrink();
  expect(screen.getByRole('heading', { name: '暹罗糖云' })).toBeInTheDocument();
  expect(screen.getByText('Siamese Baby Kitten Sugar Coffee')).toBeInTheDocument();
  expect(screen.getByText(/厚牛奶/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '返回' })).toHaveAttribute('href', '/xiaomaomi');
  const page = document.querySelector('.xm-drink');
  const html = page?.innerHTML || '';
  const picture = html.indexOf('/xiaomaomi/drinks/siamese-sugar.jpg');
  expect(picture).toBeGreaterThan(-1);
  expect(picture).toBeLessThan(html.indexOf('厚牛奶'));
  expect(document.querySelector('.xm-sheet')).toBeNull();
  expect(document.documentElement).toHaveClass('xm-world');
});

test('spa-routes writes a static copy for /xiaomaomi/drinks/:id', () => {
  const build = join(tmpdir(), `spa-cafe-${process.pid}`);
  mkdirSync(build, { recursive: true });
  writeFileSync(join(build, 'index.html'), '<!doctype html><title>spa</title>');
  execFileSync('node', [join(__dirname, '../../scripts/spa-routes.js')], {
    env: { ...process.env, SPA_BUILD: build },
  });
  expect(readFileSync(join(build, 'xiaomaomi/drinks/:id/index.html'), 'utf8')).toMatch(/spa/);
});
