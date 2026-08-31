import { applyNationToOfficerFields } from './officerContent';

describe('officer-authored content is not rewritten', () => {
  it('leaves note event and pin name unchanged when nation changes', () => {
    const note = { event: 'Suspect fled north on Santa Fe', name: 'Warehouse pin', notes: 'Possible stash location.' };
    expect(applyNationToOfficerFields(note, 'cn')).toEqual(note);
    expect(applyNationToOfficerFields(note, 'us')).toEqual(note);
  });
});
