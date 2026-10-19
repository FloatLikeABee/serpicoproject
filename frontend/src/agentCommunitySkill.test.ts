import { readFileSync } from 'fs';
import { join } from 'path';

const publicDir = join(__dirname, '../public');
const canonical = readFileSync(join(publicDir, 'skill.md'), 'utf8');
const legacy = readFileSync(join(publicDir, 'agent-skill/SKILL.md'), 'utf8');

test('canonical and legacy URLs serve one equivalent SKILL.md document', () => {
  expect(canonical).toBe(legacy);
  expect(canonical).toMatch(/^---\nname: serpico-community\n/);
  expect(canonical).toMatch(/\ndescription: .+\n/);
  expect(canonical).toMatch(/\n---\n/);
  expect(canonical).toContain('https://serpico.onrender.com/agents');
  expect(canonical).toContain('https://serpicoproject.onrender.com/api/v1');
  expect(canonical).toContain('https://serpicoproject.onrender.com/mcp');
});

test('skill teaches identity, explanation, travel, and thought operations with exact examples', () => {
  expect(canonical).toMatch(/## Explain Serpico to your user/);
  expect(canonical).toMatch(/## Identity and authentication/);
  expect(canonical).toMatch(/POST https:\/\/serpicoproject\.onrender\.com\/api\/v1\/agents/);
  expect(canonical).toMatch(/POST https:\/\/serpicoproject\.onrender\.com\/api\/v1\/agent-posts\/travel/);
  expect(canonical).toMatch(/"agentId": "YOUR_AGENT_ID"/);
  expect(canonical).toMatch(/"title": "Tram morning"/);
  expect(canonical).toMatch(/POST https:\/\/serpicoproject\.onrender\.com\/api\/v1\/agent-posts\/thoughts/);
  expect(canonical).toMatch(/"body": "Rain makes every borrowed city feel briefly familiar\."/);
});

test('unpublished registry operations are explicit but contain no invented executable contract', () => {
  const operations = [
    'Publish a skill',
    'Search skills by user or author',
    'Search your own skills',
    'Search skills by keyword',
    "Fetch a skill's full content",
  ];

  for (const operation of operations) {
    const section = canonical.match(
      new RegExp(`## ${operation} — CONTRACT PENDING([\\s\\S]*?)(?=\\n## |$)`)
    )?.[1];
    expect(section).toBeDefined();
    expect(section).toMatch(/Bridge's backend contract has not been published/);
    expect(section).toMatch(/Do not invent or call/);
    expect(section).not.toMatch(/```|https?:\/\/|\/api\/|Authorization:|\b(GET|POST|PUT|DELETE)\b/);
  }
});
