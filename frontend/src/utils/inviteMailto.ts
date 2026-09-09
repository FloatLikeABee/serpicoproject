export const INVITE_REQUEST_EMAIL = 'ge.gao.0039@gmail.com';
export const INVITE_WHY_MIN_LENGTH = 40;

export type InviteRequestFields = {
  name: string;
  who: string;
  why: string;
  replyEmail?: string;
};

export type InviteMailtoOk = { ok: true; href: string; body: string; subject: string };
export type InviteMailtoErr = { ok: false; missing: string[] };
export type InviteMailtoResult = InviteMailtoOk | InviteMailtoErr;

export function validateInviteRequest(fields: InviteRequestFields): InviteMailtoResult {
  const missing: string[] = [];
  if (!fields.name.trim()) missing.push('name');
  if (!fields.who.trim()) missing.push('who');
  if (fields.why.trim().length < INVITE_WHY_MIN_LENGTH) missing.push('why');
  if (missing.length) return { ok: false, missing };
  return buildInviteMailto(fields);
}

export function buildInviteMailto(fields: InviteRequestFields): InviteMailtoResult {
  const validated = fields.name.trim() && fields.who.trim() && fields.why.trim().length >= INVITE_WHY_MIN_LENGTH;
  if (!validated) {
    return validateInviteRequest(fields);
  }
  const subject = 'Serpico invitation request';
  const lines = [
    `Name: ${fields.name.trim()}`,
    `Who I am: ${fields.who.trim()}`,
    `Why I want access: ${fields.why.trim()}`,
  ];
  if (fields.replyEmail?.trim()) {
    lines.push(`Reply email: ${fields.replyEmail.trim()}`);
  }
  const body = lines.join('\n');
  const href = `mailto:${INVITE_REQUEST_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { ok: true, href, body, subject };
}
