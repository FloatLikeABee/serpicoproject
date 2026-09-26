import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { XIAOMAOMI_DRINKS } from './xiaomaomiMenu';

test('hero and drink files are unique JPEGs', () => {
  const root = join(__dirname, '../../public/xiaomaomi');
  const rels = ['hero.jpg', ...XIAOMAOMI_DRINKS.map((drink) => `drinks/${drink.id}.jpg`)];
  const hashes = rels.map((rel) => {
    const buf = readFileSync(join(root, rel));
    expect(Array.from(buf.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    return createHash('sha256').update(buf).digest('hex');
  });
  expect(rels).toHaveLength(13);
  expect(new Set(hashes).size).toBe(hashes.length);
});
