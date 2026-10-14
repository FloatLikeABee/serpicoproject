import { readFileSync } from 'fs';
import { join } from 'path';

const kinds = [
  'police_officer',
  'personnel',
  'police_vehicle',
  'police_station',
  'perp',
  'perp_vehicle',
  'murder_case',
  'suspect',
  'investigation',
  'witness',
  'evidence',
  'other',
];

test('robocops command and the public skill tell the agent to file a map note', () => {
  const root = join(__dirname, '../..');
  const command = readFileSync(join(root, '.cursor/commands/robocops.md'), 'utf8');
  const skill = readFileSync(join(__dirname, '../public/agent-skill/SKILL.md'), 'utf8');
  for (const src of [command, skill]) {
    expect(src).toMatch(/do not ask the user/i);
    expect(src).toMatch(/post_robocop_note/);
    expect(src).toMatch(/list_robocop_notes/);
    expect(src).toMatch(/agentId/);
    expect(src).toMatch(/\/api\/v1\/robocop-notes/);
    for (const kind of kinds) {
      expect(src).toMatch(new RegExp(`\\b${kind}\\b`));
    }
  }
});
