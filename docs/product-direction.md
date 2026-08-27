# Product Direction

YoMeets should not compete with meeting summarizers.

The sharper problem is:

```text
Meetings create commitments, but execution happens elsewhere.
```

Engineering teams leave meetings with decisions, owners, deadlines, and follow-ups. The painful work starts after the call: someone has to create issues, assign owners, move calendar events, send recap messages, and remember what stayed unresolved.

YoMeets exists to close that gap safely.

## Core Promise

YoMeets converts decisions and commitments made during engineering meetings into verified actions in the tools where work actually happens.

It should:

- extract commitments from transcripts
- identify owners, deadlines, decisions, and references
- show proposed actions before execution
- require human approval for external side effects
- execute approved actions in GitHub, Google Calendar, and Gmail
- verify the resulting external state
- carry unresolved commitments into the next meeting

## V1 Workflow

```text
Transcript
-> detected commitments
-> proposed execution plan
-> approval
-> GitHub / Calendar / Gmail action
-> verification
-> commitment tracker
-> next-meeting context
```

## First Integrations

- GitHub: create or update issues, attach meeting context, assign owners
- Google Calendar: create follow-ups, reschedule review meetings
- Gmail: draft or send approved follow-up messages

Browser automation remains useful as a fallback, but supported services should prefer APIs.

The first API clients are intentionally thin: GitHub issue creation, Google Calendar event creation/moves, and Gmail draft creation. OAuth setup and live verification reads come after the action path is stable.

## Planning Rule

V1 starts with deterministic commitment-to-action mapping:

- investigation commitments become GitHub issues
- schedule changes become Calendar updates
- follow-up messages become Gmail drafts
- decisions become local decision records

## Metrics

- commitment extraction precision
- commitment extraction recall
- owner and deadline accuracy
- execution success rate
- verification accuracy
- duplicate side-effect rate
- recovery success rate
- human correction rate
- minutes of post-meeting admin eliminated
