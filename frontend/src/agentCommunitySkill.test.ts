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
});
