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

  'chase-game': `### Officer Serpico — Fleet Desk

**10-4.** Fleet is the city map for stations, police vehicles, and crime-scene / event pins — not a chase game.

Drop a marker, add notes, then switch cities to jump the map.

What do you need?`,

  'suspect-interview': `### Officer Serpico — Suspect Interview Helper

**10-4.** I'll coach **legit, non-coercive interview questions** (PEACE · free recall · SUE).

#### Start with a case brief
Before the first question, send a short **case review**:

- **Offense** (what happened)
- **Known facts / evidence**
- **Interview goal**
- **Rights status** (Miranda / counsel / recording)

Example:
> Case brief: residential burglary ~02:30, prints on rear window, suspect denies being there. Goal: timeline + alibi. Rights given; interview recorded.

Once I have that, I'll give the **first question**. Then you ask the suspect and reply with **Suspect said:** … **My thoughts:** …`,
};

export function getChatInitialMessage(context?: string): string {
  return (
    contextMessages[context || ''] ||
    `### Officer Serpico — Olathe PD Advisory

**10-4.** I'm your field AI advisor — pursuits, case intel, area crime data, and operational guidance.

How can I assist?`
  );
}
