import { pursueMapRegion, SHANGHAI_CENTER } from './mapRegions';
import { OLATHE_CENTER } from './pursuitSim';

describe('pursue map region', () => {
  it('keeps United States on Olathe', () => {
    const region = pursueMapRegion('us');
    expect(region.center).toEqual(OLATHE_CENTER);
  });

  it('points China at Shanghai', () => {
    const region = pursueMapRegion('cn');
    expect(region.center).toEqual(SHANGHAI_CENTER);
    expect(region.center[0]).toBeCloseTo(31.2304);
    expect(region.center[1]).toBeCloseTo(121.4737);
  });
});
