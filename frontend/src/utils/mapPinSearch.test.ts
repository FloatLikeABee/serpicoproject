import { matchMapPins, planPinFocus, type SearchablePin } from './mapPinSearch';

const pin = (over: Partial<SearchablePin> = {}): SearchablePin => ({
  id: 'p1',
  name: 'Warehouse',
  address: '100 E Santa Fe, Olathe, KS',
  notes: 'Possible stash.',
  kindLabel: 'Crime scene / event',
  cityId: 'olathe',
  lat: 38.88,
  lng: -94.81,
  ...over,
});

describe('matchMapPins', () => {
  it('returns nothing for an empty query', () => {
    expect(matchMapPins('   ', [pin()])).toEqual([]);
  });

  it('matches by place name, case-insensitive', () => {
    const hits = matchMapPins('ware', [pin(), pin({ id: 'p2', name: 'Station 4' })]);
    expect(hits.map((h) => h.id)).toEqual(['p1']);
  });

  it('matches by notes', () => {
    const hits = matchMapPins('stash', [pin({ notes: 'Possible stash.' }), pin({ id: 'p2', notes: 'clear' })]);
    expect(hits.map((h) => h.id)).toEqual(['p1']);
  });

  it('matches by AI brief', () => {
    const hits = matchMapPins('warrant', [
      pin({ enrichment: { summary: 'Open warrant nearby.' } }),
      pin({ id: 'p2', enrichment: { summary: 'Quiet block.' } }),
    ]);
    expect(hits.map((h) => h.id)).toEqual(['p1']);
  });

  it('matches by kind label', () => {
    const hits = matchMapPins('station', [
      pin({ id: 'p2', name: 'North', kindLabel: 'Station / facility' }),
      pin({ name: 'Alley', kindLabel: 'Crime scene / event' }),
    ]);
    expect(hits.map((h) => h.id)).toEqual(['p2']);
  });

  it('includes pins from another cityId', () => {
    const hits = matchMapPins('chicago stash', [
      pin({
        id: 'chi',
        cityId: 'chicago',
        name: 'Dock',
        notes: 'Chicago stash house',
      }),
    ]);
    expect(hits.map((h) => h.id)).toEqual(['chi']);
  });
});

describe('planPinFocus', () => {
  it('keeps the current city and still targets the pin lat/lng', () => {
    expect(planPinFocus('olathe', { cityId: 'olathe', lat: 38.88, lng: -94.81 })).toEqual({
      switchCityTo: undefined,
      skipCityCenter: true,
      lat: 38.88,
      lng: -94.81,
    });
  });

  it('switches city for an out-of-city pin and still targets that pin', () => {
    expect(planPinFocus('olathe', { cityId: 'chicago', lat: 41.87, lng: -87.62 })).toEqual({
      switchCityTo: 'chicago',
      skipCityCenter: true,
      lat: 41.87,
      lng: -87.62,
    });
  });
});
