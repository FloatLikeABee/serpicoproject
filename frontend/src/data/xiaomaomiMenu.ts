export type XiaomaomiKind = 'coffee' | 'tea' | 'fusion';

export type XiaomaomiDrink = {
  id: string;
  kind: XiaomaomiKind;
  title: string;
  titleEn: string;
  blurb: string;
  blurbEn: string;
  imageUrl: string;
};

export const XIAOMAOMI_DRINKS: XiaomaomiDrink[] = [
  {
    id: 'siamese-sugar',
    kind: 'coffee',
    title: '暹罗糖云',
    titleEn: 'Siamese Baby Kitten Sugar Coffee',
    blurb: '厚牛奶和一点糖的拿铁，给想拍照的下午。',
    blurbEn: 'A milky latte with a little sugar, for an afternoon photo.',
    imageUrl: '/xiaomaomi/drinks/siamese-sugar.jpg',
  },
  {
    id: 'citrus-americano',
    kind: 'coffee',
    title: '橘座美式',
    titleEn: 'Orange-Seat Kitten Americano',
    blurb: '柑橘皮香的美式，早课和通勤提神，不加奶。',
    blurbEn: 'A citrus Americano for morning class and the commute, with no milk.',
    imageUrl: '/xiaomaomi/drinks/citrus-americano.jpg',
  },
  {
    id: 'snow-cold-brew',
    kind: 'coffee',
    title: '冷萃小雪',
    titleEn: 'Snowdrift Kitten Cold Brew',
    blurb: '冷萃，干净的苦，适合晚自习还想清醒。',
    blurbEn: 'Cold brew with a clean bitterness for night study.',
    imageUrl: '/xiaomaomi/drinks/snow-cold-brew.jpg',
  },
  {
    id: 'salt-roll',
    kind: 'coffee',
    title: '咸奶卷卷',
    titleEn: 'Salt-Milk Roll Kitten',
    blurb: '一点海盐和厚乳的拿铁，咸甜，不是甜腻奶盖。',
    blurbEn: 'A salted milk-fat latte, savory and sweet.',
    imageUrl: '/xiaomaomi/drinks/salt-roll.jpg',
  },
  {
    id: 'oat-cloud',
    kind: 'coffee',
    title: '燕麦云朵',
    titleEn: 'Oat-Cloud Kitten Latte',
    blurb: '燕麦奶拿铁，轻一点的奶咖，上班和早课都能喝。',
    blurbEn: 'An oat latte, a lighter milk coffee for work and morning class.',
    imageUrl: '/xiaomaomi/drinks/oat-cloud.jpg',
  },
  {
    id: 'yunnan-pour',
    kind: 'coffee',
    title: '云南日晒',
    titleEn: 'Sun-Dried Kitten Pour-over',
    blurb: '手冲风味故事，云南日晒豆的果香。不是合作庄园。',
    blurbEn: 'A pour-over flavor story of Yunnan sun-dried beans, not a partner farm.',
    imageUrl: '/xiaomaomi/drinks/yunnan-pour.jpg',
  },
  {
    id: 'jasmine-velvet',
    kind: 'tea',
    title: '茉莉奶绒',
    titleEn: 'Jasmine-Velvet Kitten',
    blurb: '茉莉绿茶加鲜奶的轻乳茶，下午解腻。',
    blurbEn: 'Jasmine green tea with fresh milk, a light milk tea for the afternoon.',
    imageUrl: '/xiaomaomi/drinks/jasmine-velvet.jpg',
  },
  {
    id: 'peach-soft',
    kind: 'tea',
    title: '白桃软软',
    titleEn: 'Peach-Soft Kitten Fruit Tea',
    blurb: '白桃水果茶，鲜果香，给想出片的杯子。',
    blurbEn: 'White-peach fruit tea for a photo-friendly cup.',
    imageUrl: '/xiaomaomi/drinks/peach-soft.jpg',
  },
  {
    id: 'grape-fizz',
    kind: 'tea',
    title: '青提气泡',
    titleEn: 'Green-Grape Fizz Kitten',
    blurb: '青提气泡水果茶，清爽，适合课间和夏天。',
    blurbEn: 'Green-grape fizzy fruit tea, bright for a break or a hot day.',
    imageUrl: '/xiaomaomi/drinks/grape-fizz.jpg',
  },
  {
    id: 'salty-cheese',
    kind: 'tea',
    title: '咸酪小山',
    titleEn: 'Salty Cheese Kitten Milk Tea',
    blurb: '咸奶茶，奶酪咸香压住甜。',
    blurbEn: 'Salted cheese milk tea, the savory tea-shop cup.',
    imageUrl: '/xiaomaomi/drinks/salty-cheese.jpg',
  },
  {
    id: 'jasmine-yuanyang',
    kind: 'fusion',
    title: '茉莉鸳鸯',
    titleEn: 'Jasmine Yuanyang Kitten',
    blurb: '茉莉茶、咖啡和奶的分层鸳鸯，茶咖一起喝。',
    blurbEn: 'Jasmine tea, coffee, and milk in one layered cup.',
    imageUrl: '/xiaomaomi/drinks/jasmine-yuanyang.jpg',
  },
  {
    id: 'plum-study',
    kind: 'fusion',
    title: '话梅晚课',
    titleEn: 'Plum-Study Kitten Americano',
    blurb: '话梅香的美式，晚自习想要中国味。',
    blurbEn: 'A plum Americano for night study, with a Chinese flavor.',
    imageUrl: '/xiaomaomi/drinks/plum-study.jpg',
  },
];
