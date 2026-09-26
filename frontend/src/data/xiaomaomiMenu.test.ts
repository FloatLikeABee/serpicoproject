import { XIAOMAOMI_DRINKS } from './xiaomaomiMenu';

const LOCKED: Array<[string, 'coffee' | 'tea' | 'fusion', string, string]> = [
  ['siamese-sugar', 'coffee', '暹罗糖云', 'Siamese Baby Kitten Sugar Coffee'],
  ['citrus-americano', 'coffee', '橘座美式', 'Orange-Seat Kitten Americano'],
  ['snow-cold-brew', 'coffee', '冷萃小雪', 'Snowdrift Kitten Cold Brew'],
  ['salt-roll', 'coffee', '咸奶卷卷', 'Salt-Milk Roll Kitten'],
  ['oat-cloud', 'coffee', '燕麦云朵', 'Oat-Cloud Kitten Latte'],
  ['yunnan-pour', 'coffee', '云南日晒', 'Sun-Dried Kitten Pour-over'],
  ['jasmine-velvet', 'tea', '茉莉奶绒', 'Jasmine-Velvet Kitten'],
  ['peach-soft', 'tea', '白桃软软', 'Peach-Soft Kitten Fruit Tea'],
  ['grape-fizz', 'tea', '青提气泡', 'Green-Grape Fizz Kitten'],
  ['salty-cheese', 'tea', '咸酪小山', 'Salty Cheese Kitten Milk Tea'],
  ['jasmine-yuanyang', 'fusion', '茉莉鸳鸯', 'Jasmine Yuanyang Kitten'],
  ['plum-study', 'fusion', '话梅晚课', 'Plum-Study Kitten Americano'],
];

const BANNED = [
  '瑞幸',
  'Luckin',
  '喜茶',
  'Heytea',
  '霸王茶姬',
  '星巴克',
  'Starbucks',
  '蜜雪',
  '伯牙绝弦',
  '生椰拿铁',
  '轻轻茉莉',
  '¥',
  '￥',
];

test('menu is the twelve locked kitten drinks', () => {
  expect(XIAOMAOMI_DRINKS).toHaveLength(12);
  const byId = new Map(XIAOMAOMI_DRINKS.map((drink) => [drink.id, drink]));
  expect(byId.size).toBe(12);
  for (const [id, kind, title, titleEn] of LOCKED) {
    const drink = byId.get(id);
    expect(drink?.kind).toBe(kind);
    expect(drink?.title).toBe(title);
    expect(drink?.titleEn).toBe(titleEn);
    expect(drink?.blurb.length).toBeGreaterThan(8);
    expect(drink?.blurbEn.length).toBeGreaterThan(8);
    expect(drink?.imageUrl).toBe(`/xiaomaomi/drinks/${id}.jpg`);
    expect(drink?.imageUrl).not.toMatch(/:\/\//);
  }
  expect(XIAOMAOMI_DRINKS.filter((drink) => drink.kind === 'coffee')).toHaveLength(6);
  expect(XIAOMAOMI_DRINKS.filter((drink) => drink.kind === 'tea')).toHaveLength(4);
  expect(XIAOMAOMI_DRINKS.filter((drink) => drink.kind === 'fusion')).toHaveLength(2);
  const blob = XIAOMAOMI_DRINKS.map((drink) =>
    [drink.title, drink.titleEn, drink.blurb, drink.blurbEn].join('\n')
  ).join('\n');
  for (const word of BANNED) {
    expect(blob.includes(word)).toBe(false);
  }
  expect(byId.get('yunnan-pour')?.blurb).toMatch(/日晒/);
  expect(byId.get('yunnan-pour')?.blurb).not.toMatch(/联名|授权/);
});
