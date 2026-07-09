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

  'mysteries': `### Officer Serpico — Missing Persons Desk

**Copy.** US missing persons, cold cases, unsolved crimes, and fugitives on the run — recent news and case updates.

What are you looking into?`,

  'leisure': `### Officer Serpico — Missing Persons Desk

**10-4.** Same desk as Mysteries — missing persons, cold cases, and suspects still at large.

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
};

export function getChatInitialMessage(context?: string): string {
  return (
    contextMessages[context || ''] ||
    `### Officer Serpico — Olathe PD Advisory

**10-4.** I'm your field AI advisor — pursuits, case intel, area crime data, and operational guidance.

How can I assist?`
  );
}
