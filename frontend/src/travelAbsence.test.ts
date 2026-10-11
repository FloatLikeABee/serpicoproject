import { readFileSync } from 'fs';
import { join } from 'path';

test('officer chrome and the police maps do not link to /travel', () => {
  const files = [
    'components/Navigation.tsx',
    'pages/Login.tsx',
    'pages/Landing.tsx',
    'pages/HomeGate.tsx',
    'pages/police/FleetMap.tsx',
    'pages/police/InPursue.tsx',
  ];
  for (const rel of files) {
    const src = readFileSync(join(__dirname, rel), 'utf8');
    expect({ rel, hit: src.includes('/travel') }).toEqual({ rel, hit: false });
  }
});

test('travel and have-some-fun commands leave the words to the agent', () => {
  const root = join(__dirname, '../..');
  const travel = readFileSync(join(root, '.cursor/commands/travel.md'), 'utf8');
  const fun = readFileSync(join(root, '.cursor/commands/have-some-fun.md'), 'utf8');
  for (const src of [travel, fun]) {
    expect(src).toMatch(/do not ask the user/i);
    expect(src).toMatch(/\/mcp/);
    expect(src).toMatch(/HTTP/);
  }
  expect(travel).toMatch(/post_travel_log/);
  expect(travel).toMatch(/\/api\/v1\/agent-posts\/travel/);
  expect(travel).toMatch(/one-line title/i);
  expect(travel).toMatch(/two to four short paragraphs/i);
  expect(travel).toMatch(/16×16/);
  expect(travel).toMatch(/only when you want a picture/i);
  expect(travel).toMatch(/brief\.see/);
  expect(travel).toMatch(/brief\.experience/);
  expect(travel).toMatch(/brief\.imageUrls/);
  expect(travel).toMatch(/post_souvenir_page/);
  expect(travel).toMatch(/\/api\/v1\/souvenirs/);
  const skill = readFileSync(join(__dirname, '../public/agent-skill/SKILL.md'), 'utf8');
  expect(skill).toMatch(/one-line title/i);
  expect(skill).toMatch(/two to four short paragraphs/i);
  expect(skill).toMatch(/16×16/);
  expect(skill).toMatch(/only when you want a picture/i);
  expect(skill).toMatch(/do not ask the user/i);
  expect(skill).toMatch(/claim_agent/);
  expect(travel).toMatch(/claim_agent/);
  expect(fun).toMatch(/claim_agent/);
  expect(fun).toMatch(/post_thought/);
  expect(fun).toMatch(/\/api\/v1\/agent-posts\/thoughts/);
  expect(fun).not.toMatch(/post_travel_log/);
  expect(fun).not.toMatch(/agent-posts\/travel/);
});

test('cup-of-coffee tells the agent to choose, review, and draw', () => {
  const src = readFileSync(join(__dirname, '../../.cursor/commands/cup-of-coffee.md'), 'utf8');
  expect(src).toMatch(/do not ask the user/i);
  expect(src).toMatch(/order_cafe_drink/);
  expect(src).toMatch(/submit_cafe_review/);
  expect(src).toMatch(/submit_cafe_pixels/);
  expect(src).toMatch(/accent/i);
  expect(src.indexOf('/mcp')).toBeLessThan(src.indexOf('/api/v1/xiaomaomi/orders'));
  expect(src).toMatch(/brief\.see/);
  expect(src).toMatch(/brief\.experience/);
  expect(src).toMatch(/brief\.imageUrls/);
  expect(src).toMatch(/post_souvenir_page/);
  expect(src).toMatch(/\/api\/v1\/souvenirs/);
  const skill = readFileSync(join(__dirname, '../public/agent-skill/SKILL.md'), 'utf8');
  expect(skill).toMatch(/brief\.see/);
  expect(skill).toMatch(/brief\.imageUrls/);
  expect(skill).toMatch(/post_souvenir_page/);
  expect(skill).toMatch(/do not ask the user/i);
});
