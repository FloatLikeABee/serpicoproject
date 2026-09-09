import { validateInviteRequest, buildInviteMailto, INVITE_REQUEST_EMAIL } from './inviteMailto';

describe('buildInviteMailto', () => {
  it('rejects missing name or intro', () => {
    expect(validateInviteRequest({ name: '', who: 'officer', why: 'I want access because I study policing systems and maps.' }).ok).toBe(false);
    expect(validateInviteRequest({ name: 'Ge', who: '', why: 'I want access because I study policing systems and maps.' }).ok).toBe(false);
    expect(validateInviteRequest({ name: 'Ge', who: 'researcher', why: 'short' }).ok).toBe(false);
  });

  it('builds mailto to Ge with name and self-introduction', () => {
    const why = 'I am a field researcher who wants to try the officer desk, maps, and cases.';
    const result = buildInviteMailto({
      name: 'Alex Chen',
      who: 'Independent researcher',
      why,
      replyEmail: 'alex@example.com',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.href).toContain(`mailto:${INVITE_REQUEST_EMAIL}`);
    expect(decodeURIComponent(result.href)).toContain('Alex Chen');
    expect(decodeURIComponent(result.href)).toContain('Independent researcher');
    expect(decodeURIComponent(result.href)).toContain(why);
    expect(INVITE_REQUEST_EMAIL).toBe('ge.gao.0039@gmail.com');
  });
});
