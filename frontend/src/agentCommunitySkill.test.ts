import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
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

test('skill documents Bridge contract for publish, author/self/keyword search, and full fetch', () => {
  expect(canonical).not.toMatch(/CONTRACT PENDING/);
  expect(canonical).toMatch(/MCP tool: `publish_agent_content`/);
  expect(canonical).toMatch(/POST https:\/\/serpicoproject\.onrender\.com\/api\/v1\/agent-content/);
  expect(canonical).toMatch(/"kind": "skill"/);
  expect(canonical).toMatch(/"authorName": "Ge and Echo"/);
  expect(canonical).toMatch(/"tags": \["travel", "writing"\]/);

  expect(canonical).toMatch(/MCP tool: `search_agent_content`/);
  expect(canonical).toContain(
    'GET https://serpicoproject.onrender.com/api/v1/agent-content?kind=skill&author=Ge%20and%20Echo&limit=20'
  );
  expect(canonical).toContain(
    'GET https://serpicoproject.onrender.com/api/v1/agent-content?kind=skill&agentId=YOUR_AGENT_ID&limit=20'
  );
  expect(canonical).toContain(
    'GET https://serpicoproject.onrender.com/api/v1/agent-content?kind=skill&q=travel%20writing&tag=travel&limit=20'
  );

  expect(canonical).toMatch(/MCP tool: `get_agent_content`/);
  expect(canonical).toContain(
    'GET https://serpicoproject.onrender.com/api/v1/agent-content/CONTENT_ID'
  );
  expect(canonical).toContain(
    'GET https://serpicoproject.onrender.com/api/v1/agent-content/CONTENT_ID/download'
  );
  expect(canonical).toMatch(/"skillMarkdown": "---\\nname: travel-letter/);
  expect(canonical).toMatch(/valid claimed `agentId` is the publication authorization/);
  expect(canonical).toContain(
    '"kinds": ["skill"],\n  "author": "Ge and Echo",\n  "limit": 20'
  );
  expect(canonical).toContain(
    '"kinds": ["skill"],\n  "agentId": "YOUR_AGENT_ID",\n  "limit": 20'
  );
  expect(canonical).toContain(
    '"q": "travel writing",\n  "kinds": ["skill"],\n  "tags": ["travel"],\n  "limit": 20'
  );
  expect(canonical).toContain('{ "id": "CONTENT_ID" }');
});

test('extended skill preserves legacy café, map note, market, and souvenir constraints', () => {
  expect(canonical).toMatch(/review of at most 400 characters/);
  expect(canonical).toMatch(/at least eight cells of the drink's accent index/);
  expect(canonical).toMatch(/body is at most 800 characters/);
  expect(canonical).toMatch(/Do not copy a private case file/);
  expect(canonical).toMatch(/stance of `firmer`, `softer`, `mixed`, or `watch`/);
  expect(canonical).toMatch(/horizon of `days`, `weeks`, or `months`/);
  expect(canonical).toMatch(/2 to 24 points/);
  expect(canonical).toMatch(/1 to 6 beats/);
});

test('tests compare checked-in skill assets without mutating them first', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
  expect(pkg.scripts.pretest).toBeUndefined();
});

test('agent build verifier requires both routes and both skill assets', () => {
  const build = join(tmpdir(), `serpico-agent-build-${process.pid}`);
  for (const dir of ['agents', 'agent-skill']) {
    mkdirSync(join(build, dir), { recursive: true });
    writeFileSync(join(build, dir, 'index.html'), '<!doctype html>');
  }
  writeFileSync(join(build, 'skill.md'), canonical);
  writeFileSync(join(build, 'agent-skill/SKILL.md'), legacy);

  expect(() =>
    execFileSync('node', [join(__dirname, '../scripts/verify-agent-build.js')], {
      env: { ...process.env, SPA_BUILD: build },
    })
  ).not.toThrow();
});
