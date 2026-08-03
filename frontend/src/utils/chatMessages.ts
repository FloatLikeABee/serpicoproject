/** Shared officer-voice greeting messages for AI chat (Markdown). */

const contextMessages: Record<string, string> = {
  'in-pursue': `### Officer Serpico — Pursuit Advisory

**10-4.** I'm on channel for pursuit operations — active units, suspect movement, and intercept strategy.

What do you need, officer?`,

  'perps-cases': `### Officer Serpico — Case Intel

**Copy that.** I can pull suspect profiles, serial offender case files, and cross-jurisdiction history.

What's your query?`,

  'perps': `### Officer Serpico — Suspect Intel

**Standing by.** Ask about known subjects, offender patterns, or case-linked suspects.

Go ahead with your question.`,

  'case-library': `### Officer Serpico — Case Library

**Ready.** I can search historical case files and offender records.

What case intel do you need?`,

  'mysteries': `### Officer Serpico — Board Desk

**Copy.** US missing persons, cold cases, unsolved crimes, and fugitives on the run — recent news and case updates.

What are you looking into?`,

  'leisure': `### Officer Serpico — Board Desk

**10-4.** Same desk as Board — missing persons, cold cases, and suspects still at large.

What's on your mind?`,

  'nearby-officers': `### Officer Serpico — Unit Status

**On channel.** I can help locate nearby Olathe PD units and availability.

Who or what are you trying to find?`,

  'nearby-perps': `### Officer Serpico — Area Intel

**Heads up.** I track recent criminal activity and suspect movement in the Olathe AO.

What intel do you need?`,

  'safe-routes': `### Officer Serpico — Route Advisory

**Copy that.** I'll factor recent crime patterns into route recommendations.

Where are you headed?`,

  'chase-game': `### Officer Serpico — Pursuit Training

**Ready for training.** Chase Game rules, pursuit codex, and debrief — or hit the **Chase** tab for a live scenario.

What do you need?`,

  'suspect-interview': `### Officer Serpico — Suspect Interview Helper

**10-4.** This channel coaches **legit, non-coercive interview questions** for a live suspect interview (PEACE · free recall · SUE).

#### How we work
1. I give you the **next question** to ask.
2. You ask the suspect.
3. You reply with **Suspect said:** … and **My thoughts:** …
4. I give the next question, backups, and actions.

#### Ask first (Engage / free account)
> Tell me everything that happened from your point of view — start wherever you want, and take your time. I won't interrupt.

**Optional:** Before you ask that, send a short case brief (offense, known facts/evidence, interview goal, rights status) and I'll tailor the opener.

Then paste the suspect's answer + your thoughts after each round.`,
};

export function getChatInitialMessage(context?: string): string {
  return (
    contextMessages[context || ''] ||
    `### Officer Serpico — Olathe PD Advisory

**10-4.** I'm your field AI advisor — pursuits, case intel, area crime data, and operational guidance.

How can I assist?`
  );
}
