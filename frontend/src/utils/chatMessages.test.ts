import { getChatInitialMessage } from './chatMessages';

describe('interview welcome follows nation', () => {
  it('uses Simplified Chinese for China interview helper', () => {
    const msg = getChatInitialMessage('suspect-interview', 'cn');
    expect(msg).toMatch(/案情/);
    expect(msg).not.toMatch(/residential burglary/);
  });

  it('keeps English example for United States', () => {
    const msg = getChatInitialMessage('suspect-interview', 'us');
    expect(msg).toMatch(/case brief/i);
  });
});

describe('Action desk greeting', () => {
  it('names Action Desk, not Fleet Desk', () => {
    const msg = getChatInitialMessage('chase-game', 'us');
    expect(msg).toMatch(/Action Desk/);
    expect(msg).not.toMatch(/Fleet Desk/);
    expect(msg).not.toMatch(/\bFleet\b/);
  });
});
