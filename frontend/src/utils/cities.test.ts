import {
  DEFAULT_FLEET_CITY_ID,
  defaultFleetCityId,
  fleetCitiesForNation,
  loadFleetCityId,
  saveFleetCityId,
} from './cities';

describe('fleet cities by nation', () => {
  beforeEach(() => localStorage.clear());

  it('defaults US to Olathe', () => {
    expect(defaultFleetCityId('us')).toBe(DEFAULT_FLEET_CITY_ID);
    expect(defaultFleetCityId('us')).toBe('olathe');
    expect(fleetCitiesForNation('us')[0].id).toBe('olathe');
  });

  it('defaults China to Shanghai', () => {
    expect(defaultFleetCityId('cn')).toBe('shanghai');
    expect(fleetCitiesForNation('cn').some((c) => c.id === 'shanghai')).toBe(true);
  });

  it('stores city per user and nation', () => {
    saveFleetCityId('u1', 'us', 'los-angeles');
    saveFleetCityId('u1', 'cn', 'beijing');
    expect(loadFleetCityId('u1', 'us')).toBe('los-angeles');
    expect(loadFleetCityId('u1', 'cn')).toBe('beijing');
    expect(loadFleetCityId('u2', 'cn')).toBe('shanghai');
  });
});
