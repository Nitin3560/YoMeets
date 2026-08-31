# Integrations

YoMeets connects meeting commitments to external systems.

The integration layer is intentionally small.

For V1, YoMeets focuses on three systems:

```text
GitHub
Google Calendar
Gmail
```

Together they cover three common outcomes of engineering meetings:

```text
Engineering Work → GitHub
Scheduling       → Google Calendar
Communication    → Gmail
```

Integrations do not decide what happened during the meeting.

They receive approved executable operations, perform them against the external system, and verify the resulting state.

---

# Integration Pipeline

Every integration follows the same general flow.

```text
Meeting Action
      │
      ▼
Task Engine
      │
      ▼
Executable Plan
      │
      ▼
Approval
      │
      ▼
Agent Core
      │
      ▼
Integration
      │
      ▼
External API
      │
      ▼
Verification
```

This keeps provider-specific behavior outside the Meeting Engine.

---

# GitHub

GitHub represents engineering work created during meetings.

For example:

```text
"We should create an issue for the authentication timeout."
```

can become:

```text
GitHub
Operation: Create Issue
Repository: backend
Title: Authentication timeout
```

After execution, the integration verifies that the expected issue exists.

This is important because a network failure does not necessarily mean the issue was never created.

---

# Google Calendar

Google Calendar handles scheduling commitments.

For example:

```text
"Let's move the follow-up to Friday."
```

can become:

```text
Google Calendar
Operation: Update Event
Target: Follow-up meeting
Time: Friday
```

The integration identifies the target event, performs the approved change, and verifies the resulting calendar state.

Ambiguous targets should remain unresolved rather than modifying the wrong event.

---

# Gmail

Gmail handles communication resulting from meetings.

For example:

```text
"I'll send the customer a follow-up."
```

can become:

```text
Gmail
Operation: Create Draft
Recipient: Customer
Purpose: Follow-up
```

Creating a draft provides a safer default than automatically sending a message.

The user can inspect the generated communication before anything is sent externally.

---

# Common Integration Contract

Although every provider has different APIs, YoMeets keeps the application-facing behavior consistent.

Conceptually:

```text
plan
  ↓
execute
  ↓
verify
  ↓
return result
```

Provider-specific details remain inside the integration.

The Meeting Engine therefore does not need to understand GitHub issue schemas, Google Calendar events, or Gmail message formats.

---

# Authentication

External APIs require credentials, but those credentials do not belong in meeting intelligence.

OAuth tokens and API credentials remain inside the integration boundary.

```text
Meeting Engine
      │
      │ no credentials
      ▼
Agent Core
      │
      ▼
Integration
      │
      ├── OAuth / Token
      │
      ▼
External API
```

The language model never needs access to authentication secrets in order to understand a meeting.

---

# Verification

Execution is not considered complete simply because an API request was sent.

Each integration verifies the external state afterward.

```text
Execute
   │
   ▼
External System
   │
   ▼
Verify
   │
 ┌─┴──────────┐
 │            │
 ▼            ▼
Expected    Missing
State       State
 │            │
 ▼            ▼
Verified    Recovery
```

This distinction becomes especially important when requests time out or connections fail after a side effect may already have occurred.

---

# Failure Handling

Integration failures should remain isolated from the meeting itself.

If GitHub becomes unavailable:

```text
Transcription      continues
Meeting state      continues
Meeting memory     continues
GitHub action      remains pending
```

The same principle applies to Calendar and Gmail.

External service availability should not determine whether YoMeets can continue understanding the meeting.

---

# Why Only Three Integrations

It would be easy to expand YoMeets with Jira, Linear, Slack, Notion, Teams, and many other systems.

I deliberately kept the initial integration surface narrow.

Every new integration introduces:

```text
authentication
execution semantics
verification
failure handling
idempotency
recovery
```

I would rather have a small number of integrations with reliable execution and verification than a large number of shallow connectors.

GitHub, Google Calendar, and Gmail provide enough variety to validate the architecture before expanding it further.

---

# Extending Integrations

A future integration should follow the same boundary.

```text
Executable Plan
      │
      ▼
Integration Adapter
      │
      ├── Execute
      └── Verify
```

This allows systems such as Jira, Linear, Slack, or Notion to be introduced without changing how meetings are understood.

The integration layer can grow while the Meeting Engine and Agent Core remain stable.

---

# Closing Remarks

Integrations are the point where YoMeets moves from understanding conversation to changing the outside world.

That boundary is intentionally strict.

The Meeting Engine understands the commitment.

The Task Engine prepares the operation.

The Agent Core controls approval and execution.

The integration communicates with the external service.

Verification confirms the result.

This keeps external automation useful without giving conversational AI direct control over user accounts and external systems.