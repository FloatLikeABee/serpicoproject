import { FLEET_NAV_BODY_D, FLEET_NAV_WHEELS, fleetNavArtworkMinY } from './navIcons';

describe('Fleet nav icon size', () => {
  it('is not confined to the lower third of the 24 viewBox (y≥12)', () => {
    expect(fleetNavArtworkMinY()).toBeLessThan(12);
  });

  it('keeps a vehicle (body path + two wheels) in the shared 24 viewBox', () => {
    expect(FLEET_NAV_BODY_D.length).toBeGreaterThan(8);
    expect(FLEET_NAV_WHEELS).toHaveLength(2);
    FLEET_NAV_WHEELS.forEach((w) => {
      expect(w.cy + w.r).toBeLessThanOrEqual(24);
      expect(w.cy - w.r).toBeGreaterThanOrEqual(0);
    });
  });
});
