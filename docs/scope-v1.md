# YoMeets V1 Scope

YoMeets V1 is a local meeting-to-execution system for engineering teams.

## In Scope

- Transcript input from typed or saved meeting notes
- Commitment extraction from engineering meeting transcripts
- Planning concrete actions for GitHub, Google Calendar, and Gmail
- Terminal approval before any external side effect
- GitHub issue creation through the GitHub API
- Google Calendar event creation or updates through the Calendar API
- Gmail draft creation through the Gmail API
- Local SQLite storage for meetings, commitments, planned actions, approvals, execution state, and verification results
- API read-back verification after each external write
- Benchmark fixtures for extraction and execution quality
- Open-commitment lookup before the next meeting

## Out Of Scope For Now

- LinkedIn workflows
- Browser automation as the primary execution path
- Live audio capture
- Entity resolution across people with the same or ambiguous names
- Cross-meeting temporal memory beyond open-commitment tracking
- Contradiction detection across transcripts
- Hosted multi-user service
- Packaged desktop app, installer, auto-update, or app icon
- Auto-sending email without human approval

## Dormant Fallbacks

The browser-core package, Chrome extension, and fake site fixtures remain in the repo as future fallback infrastructure for tools that do not expose reliable APIs. They are not on the V1 critical path.
