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
