import { loadFridgeRaidLang, saveFridgeRaidLang, FRIDGE_RAID_LANG_KEY } from './fridgeRaidLang';

describe('fridgeRaid lang storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves to serpico.fridgeRaid.lang and does not overwrite officer last nation', () => {
    localStorage.setItem('serpico.last.nation.v1', 'us');
    saveFridgeRaidLang('cn');
    expect(localStorage.getItem(FRIDGE_RAID_LANG_KEY)).toBe('cn');
    expect(localStorage.getItem('serpico.last.nation.v1')).toBe('us');
    expect(loadFridgeRaidLang()).toBe('cn');
  });
});
