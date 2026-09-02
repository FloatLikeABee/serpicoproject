import { readFileSync } from 'fs';
import { join } from 'path';

test('Cases header places CasesAccountButton after New case and drops the scroll Account card', () => {
  const notes = readFileSync(join(__dirname, 'pages/Notes.tsx'), 'utf8');
  const headerIdx = notes.indexOf('{showCaseForm ? t(\'cases.cancel\') : t(\'cases.new\')}');
  const btnIdx = notes.indexOf('<CasesAccountButton');
  expect(headerIdx).toBeGreaterThan(0);
  expect(btnIdx).toBeGreaterThan(headerIdx);
  expect(notes).not.toMatch(/logout\(\);\s*navigate\('\/login'\)/);
});

test('Fleet, Pursue, Board, and Chat do not gain an account panel', () => {
  const dir = join(__dirname, 'pages');
  const files = [
    join(dir, 'police/FleetMap.tsx'),
    join(dir, 'police/InPursue.tsx'),
    join(dir, 'police/Mysteries.tsx'),
    join(dir, 'AIChat.tsx'),
  ];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/account\.logout/);
    expect(src).not.toMatch(/CasesAccountButton/);
  }
});
