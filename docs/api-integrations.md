# API Integrations

YoMeets uses direct APIs as the primary execution path for supported tools. Browser automation remains a fallback for services that do not expose the needed API surface.

## GitHub

Action: `github.create_issue`

Environment:

- `GITHUB_TOKEN`

Execution:

- `POST https://api.github.com/repos/{owner}/{repo}/issues`
- sends `title`, `body`, and optional `assignees`

## Google Calendar

Action: `calendar.update_event`

Environment:

- `GOOGLE_ACCESS_TOKEN`

Execution:

- `POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
- `PATCH https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}`

## Gmail

Action: `gmail.create_draft`

Environment:

- `GOOGLE_ACCESS_TOKEN`

Execution:

- `POST https://gmail.googleapis.com/gmail/v1/users/{userId}/drafts`
- creates a draft only; sending remains a separate approval-gated action

## Current Scope

The clients are thin HTTP wrappers with mocked tests. They do not yet implement OAuth token refresh, account selection, or live verification reads.
