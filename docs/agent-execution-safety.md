# Agent Execution and Safety

YoMeets can turn meeting commitments into external actions.

That capability is useful only if execution remains controlled.

A meeting conversation is naturally ambiguous.

External systems are not.

Creating a GitHub issue, moving a calendar event, or drafting a follow-up message changes the state of another application.

For that reason, YoMeets separates conversational understanding from execution and introduces explicit approval, policy, verification, and recovery boundaries before an action is considered complete.

The execution pipeline follows this path:

```text
Meeting Conversation
        │
        ▼
Meeting Engine
        │
        ▼
Canonical Action
        │
        ▼
Task Engine
        │
        ▼
Executable Plan
        │
        ▼
Agent Core
        │
        ▼
Approval + Policy
        │
        ▼
Integration
        │
        ▼
External System
        │
        ▼
Verification
        │
        ▼
Verified / Failed / Recovery
```

The language model never directly owns the external side effect.

That boundary is intentional.

---

# Why Execution Is Separate

The Meeting Engine is responsible for understanding the conversation.

It may determine that someone committed to:

```text
Create a GitHub issue for the authentication bug.
```

That statement is not yet an API request.

The conversation may still be ambiguous.

The repository may not yet be known.

The issue title may need to be normalized.

The user may not want the action executed automatically.

For this reason, the Meeting Engine produces a canonical action rather than performing the side effect itself.

The execution system begins only after that point.

---

# Canonical Actions

A canonical action represents what happened in the meeting.

For example:

```text
Action

Owner: Sarah
Task: Create GitHub issue for authentication bug
Deadline: Friday
Evidence: 12:22 - 12:31
```

This representation is conversational.

It describes the commitment without assuming how an external application should implement it.

That distinction allows the same meeting action to remain useful even if no integration is ever executed.

---

# Task Planning

The Task Engine translates a human commitment into an executable operation.

It answers:

> **What exact external operation represents this action?**

For example:

```text
Meeting Action

Create an issue for the authentication bug.
```

may become:

```text
Executable Plan

Integration: GitHub
Operation: create_issue
Repository: backend
Title: Authentication bug
Body: ...
```

Similarly:

```text
Schedule a follow-up with Sarah next Tuesday.
```

may become:

```text
Integration: Google Calendar
Operation: create_event
Participants: Sarah
Date: Tuesday
```

The purpose of this layer is to keep conversational meaning separate from provider-specific API details.

---

# Why Planning Is a Separate Layer

It would be possible for the Meeting Engine to directly generate GitHub, Calendar, or Gmail payloads.

I avoided that.

The Meeting Engine should remain focused on understanding meetings.

It should not need to know:

- GitHub issue schemas,
- Calendar event payloads,
- Gmail draft formats,
- OAuth token behavior,
- API retry rules.

Those responsibilities belong downstream.

This separation also makes the meeting model reusable.

A commitment can exist even when no integration is configured.

---

# Agent Core

The Agent Core controls external side effects.

Its responsibilities include:

- approval,
- execution policy,
- action state,
- idempotency,
- retry behavior,
- verification,
- recovery.

The Agent Core does not decide what someone meant in the meeting.

It receives an already-planned operation and determines whether that operation is allowed to proceed.

This keeps the most safety-sensitive logic deterministic.

---

# Approval Boundary

Meeting intelligence can operate automatically.

External side effects should not.

The default execution lifecycle is:

```text
Suggested
    │
    ▼
Approved
    │
    ▼
Executing
    │
    ▼
Verified
```

Alternative outcomes include:

```text
Failed
Needs Review
Unknown Outcome
```

Approval therefore acts as the boundary between:

```text
AI interpretation
```

and:

```text
external modification
```

The system can prepare work before approval.

It should not perform consequential side effects before approval.

---

# Why Approval Matters

Meeting language often contains weak commitments.

For example:

```text
"We should probably create a ticket for that."
```

is different from:

```text
"Create a ticket for that."
```

and both are different from:

```text
"I'll create the ticket."
```

Even when the model interprets the conversation correctly, the user may still want to review the exact operation.

Approval allows YoMeets to remain proactive without assuming authority.

---

# Approval Scope

Approval should apply to a specific executable plan.

For example:

```text
Create GitHub issue
Repository: backend
Title: Authentication timeout
```

The approval should not implicitly authorize unrelated future actions.

This keeps permissions narrow and understandable.

If the plan changes materially, approval should be reconsidered.

---

# Integration Boundary

After approval, the operation is passed to the appropriate integration.

YoMeets V1 focuses on:

```text
GitHub
Google Calendar
Gmail
```

Each integration performs a narrow set of operations and returns enough information for verification.

The integration layer owns provider-specific details.

The rest of the system should not need to understand those details.

---

# GitHub Execution

GitHub represents engineering work created during meetings.

A meeting action may become:

```text
create_issue
```

The integration can use information such as:

```text
repository
title
body
assignee
labels
```

depending on the approved plan.

The important architectural property is that the issue creation happens only after the operation has passed through the normal approval path.

---

# Google Calendar Execution

Calendar actions represent scheduling and follow-up work.

Examples include:

```text
create_event
update_event
reschedule_event
```

Calendar execution requires particular care because the meaning of:

```text
"Let's move this to Friday."
```

depends on which event is being discussed.

The planned operation should therefore identify the target before execution.

Ambiguous targets should remain unresolved rather than modifying the wrong calendar entry.

---

# Gmail Execution

Email actions represent communication resulting from a meeting.

YoMeets can prepare:

```text
draft email
follow-up message
meeting recap
```

The system should distinguish between:

```text
creating a draft
```

and:

```text
sending a message
```

because those operations have different consequences.

A draft is easier to review and safer as a default.

---

# Execution States

Every external action should have an explicit lifecycle.

A useful state model includes:

```text
suggested
approved
executing
verified
failed
unknown
```

Each state represents something different.

`Suggested` means the system identified a possible action.

`Approved` means the user accepted the operation.

`Executing` means the external request is in progress.

`Verified` means the expected external state has been confirmed.

`Failed` means the operation did not produce the intended result.

`Unknown` means the system cannot yet determine whether the side effect occurred.

Making these states explicit makes recovery much easier to reason about.

---

# Why API Success Is Not Enough

An API request returning successfully does not automatically prove that the intended outcome exists.

Likewise, a failed response does not always prove that the side effect did not occur.

Consider:

```text
YoMeets
   │
   ├── Create Issue ─────► GitHub
   │
   │                     Issue created
   │
   X
Connection interrupted
```

YoMeets may never receive the success response.

If it immediately retries, a duplicate issue could be created.

This is why execution and verification are separate stages.

---

# Verification

After execution, YoMeets checks the external system.

The question is:

> **Does the intended external state actually exist?**

For a GitHub issue, verification might confirm:

```text
repository
issue title
issue identifier
expected content
```

For a calendar operation, it might confirm:

```text
event exists
correct time
correct participants
```

For Gmail, it may confirm:

```text
draft exists
correct recipient
expected subject
```

The exact verification behavior depends on the integration.

The architectural principle remains the same.

Execution proposes a change.

Verification confirms the change.

---

# Verified State

An action should be marked complete only after verification succeeds.

Conceptually:

```text
Execute
   │
   ▼
External System
   │
   ▼
Verify
   │
   ├── Expected state exists
   │          │
   │          ▼
   │       Verified
   │
   └── Expected state missing
              │
              ▼
        Recovery / Failure
```

This makes the final action state reflect external reality rather than only local intent.

---

# Unknown Outcomes

Unknown outcomes are one of the most important failure states.

An unknown outcome occurs when YoMeets cannot determine whether the external operation completed.

For example:

```text
request sent
connection lost
response unavailable
```

The wrong response is:

```text
retry immediately
```

because the original operation may already have succeeded.

The safer response is:

```text
inspect external state first
```

---

# Inspect-First Recovery

Recovery follows this pattern:

```text
Unknown Outcome
      │
      ▼
Inspect External State
      │
 ┌────┴────────┐
 │             │
 ▼             ▼
Found       Not Found
 │             │
 ▼             ▼
Verify       Safe Retry
```

If the intended state already exists, YoMeets records the action as verified.

If the intended state does not exist, the operation can be retried according to policy.

This prevents recovery logic from creating duplicate side effects.

---

# Idempotency

Idempotency means that repeating a workflow should not create additional unintended effects.

This matters particularly for actions such as:

```text
Create GitHub issue
Create Calendar event
Create Gmail draft
```

A retry should not produce:

```text
Issue 1
Issue 2
Issue 3
```

for one meeting commitment.

The execution system therefore needs stable identifiers and enough external-state inspection to determine whether work has already occurred.

---

# Idempotency Keys

An executable operation can be associated with a stable internal identity.

Conceptually:

```text
meetingId
actionId
operationType
target
```

Together these can form an idempotency identity for the operation.

The exact provider may not support native idempotency keys.

Even then, YoMeets can use the identity to track execution attempts and verification results locally.

This helps distinguish:

```text
retrying the same operation
```

from:

```text
performing a new operation
```

---

# Duplicate Prevention Before Execution

Duplicate prevention begins before the integration layer.

The Meeting Engine attempts to avoid creating duplicate canonical actions.

The Task Engine should avoid planning multiple equivalent operations for the same action.

The Agent Core should avoid executing an already-verified plan.

Each layer therefore contributes a different form of duplicate protection.

Conceptually:

```text
Conversation
    │
    ▼
Canonical dedupe
    │
    ▼
Planning dedupe
    │
    ▼
Execution idempotency
    │
    ▼
External verification
```

This layered approach is safer than relying on one final duplicate check.

---

# Retry Policy

Not every failure should be retried.

Failures can be divided into categories.

For example:

```text
Transient failure
Permanent failure
Authentication failure
Validation failure
Unknown outcome
```

A temporary network timeout may be retryable.

An invalid repository name is not.

Expired authentication may require user intervention.

An unknown outcome requires inspection before retry.

The retry policy should therefore depend on failure type rather than treating every error identically.

---

# Transient Failures

Examples include:

```text
temporary network failure
rate limiting
provider timeout
service unavailable
```

These may be eligible for controlled retries.

Retries should use bounded attempts and avoid aggressive loops.

The objective is recovery, not repeatedly hammering an unavailable provider.

---

# Permanent Failures

Some failures require changing the plan.

Examples include:

```text
repository does not exist
participant email unavailable
calendar target cannot be identified
operation not permitted
```

Retrying the same request will not help.

These actions should return to a review state rather than automatically repeating.

---

# Authentication Failures

External integrations require valid credentials.

Authentication failure should remain separate from execution failure.

For example:

```text
Action valid
Plan valid
Approval valid
OAuth token expired
```

The correct response is to repair authentication.

The system should not reinterpret the meeting or recreate the plan unnecessarily.

Keeping authentication at the integration boundary makes that separation possible.

---

# Policy Checks

Approval is one safety mechanism.

Policy checks provide another.

A policy can reject or pause an operation even after it has been planned.

Examples include:

```text
missing target
unresolved speaker identity
unsupported integration
unsafe operation type
missing approval
already verified operation
```

These checks should remain deterministic.

The model should not be responsible for deciding whether its own proposed action is safe.

---

# Unresolved Identity

An action may be understood before the owner's real identity is known.

For example:

```text
Owner: S3
Task: Send customer follow-up
```

That action can remain in meeting state.

Execution may still be unsafe.

If the operation requires a real email recipient, unresolved identity should block execution.

Conceptually:

```text
Action detected
      │
      ▼
Owner = S3
      │
      ▼
Needs Identification
      │
      ▼
S3 -> Sarah confirmed
      │
      ▼
Execution eligible
```

This preserves useful meeting intelligence without turning uncertainty into an external mistake.

---

# Dry-Run Execution

A dry-run mode is useful during development and evaluation.

Dry-run execution allows the system to exercise:

```text
planning
approval
policy
state transitions
verification logic
```

without performing a real external side effect.

This is particularly useful for deterministic evaluation.

Dry-run success should not be confused with real integration success.

The two should remain clearly separated in benchmarks and documentation.

---

# External Verification Contracts

Each integration needs a verification contract.

The contract describes how YoMeets determines that an operation succeeded.

For example:

```text
GitHub create_issue

Execute:
POST issue

Verify:
retrieve issue and confirm expected state
```

A Calendar operation may use:

```text
Execute:
update event

Verify:
retrieve event and confirm start time
```

The verification logic should be integration-specific but exposed through a common interface to the Agent Core.

---

# Why Integrations Verify Their Own State

The Agent Core should not need to understand GitHub issue fields or Calendar schemas.

The integration already understands its provider.

It is therefore the natural place to implement external-state verification.

Conceptually:

```text
Agent Core
    │
    ▼
Integration.execute()
    │
    ▼
Integration.verify()
    │
    ▼
Verification Result
```

This keeps provider knowledge contained inside the integration boundary.

---

# Audit Events

External side effects should be traceable.

Useful execution events include:

```text
action detected
plan created
approval received
execution started
provider response received
verification started
verification succeeded
verification failed
retry attempted
recovery completed
```

These events make it possible to reconstruct what happened during an execution workflow.

This is useful for both debugging and user trust.

---

# Evidence and Execution

The external action should remain connected to the meeting evidence that produced it.

For example:

```text
GitHub Issue
      │
      ▼
Execution Result
      │
      ▼
Canonical Action
      │
      ▼
Transcript Evidence
```

This allows the user to answer:

```text
Why did YoMeets create this issue?
```

The answer should trace back to the conversation, not only to a generated plan.

---

# Failure Isolation

Execution failures should not affect meeting capture.

If GitHub is unavailable:

```text
Meeting transcription continues.
Meeting state continues.
Memory continues.
GitHub action remains pending.
```

Likewise, a Gmail authentication failure should not prevent Calendar actions or post-meeting retrieval.

This is one reason integrations are independent downstream components.

---

# Recovery Across Restarts

Execution state should be durable enough that a process restart does not erase uncertainty.

Suppose YoMeets crashes after an external side effect but before verification.

After restart, the operation should not automatically begin again from the start.

The stored state should indicate:

```text
execution attempted
verification incomplete
```

The recovery process can then inspect external state before deciding what to do.

This makes persistence part of execution safety rather than only a storage concern.

---

# Human Correction

Automation should remain correctable.

A user may reject a proposed action.

They may change the target repository.

They may correct a participant identity.

They may modify a calendar time.

The execution architecture should support these corrections before the side effect occurs.

Once an action has already been verified externally, corrections may require a new operation rather than rewriting execution history.

This preserves an accurate audit trail.

---

# Why Browser Automation Is a Fallback

External APIs provide clearer execution semantics than browser automation.

With an API, YoMeets can usually determine:

```text
request
response
resource identifier
external state
```

Browser automation is less reliable.

The page may change.

Selectors may break.

Network state may be unclear.

Verification may become harder.

For those reasons, browser automation should remain a fallback when no suitable API exists rather than the default integration mechanism.

---

# Execution Evaluation

Execution safety should be measured independently from meeting extraction.

Useful metrics include:

```text
execution success rate
verification success rate
duplicate side-effect rate
recovery success rate
approval correctness
unknown-outcome recovery
human correction rate
```

A deterministic benchmark can deliberately inject failures such as:

```text
API timeout
authentication failure
network interruption
crash after execution
verification failure
```

The system can then measure whether the final external state remains correct.

---

# Why Extraction Accuracy Is Not Execution Accuracy

A system can extract actions perfectly and still execute them badly.

Likewise, execution logic can be perfectly reliable while the meeting model identifies the wrong action.

Those are separate evaluation problems.

The pipeline should therefore be measured in stages:

```text
Conversation
    │
    ▼
Extraction quality
    │
    ▼
Planning quality
    │
    ▼
Execution quality
    │
    ▼
Verification quality
```

This makes failures easier to diagnose.

---

# Security Boundaries

Execution integrations require credentials.

Those credentials should never be treated as ordinary meeting context.

The language model does not need:

```text
OAuth tokens
passwords
cookies
API secrets
```

to understand the conversation.

Credentials therefore remain inside the integration boundary.

Only the minimum information required for reasoning should be sent to the model provider.

This reduces unnecessary exposure of sensitive system state.

---

# Execution Pipeline Summary

The execution system follows one principle:

> **AI can propose what should happen, but deterministic software controls whether and how it happens.**

The Meeting Engine identifies the commitment.

The Task Engine converts it into an executable plan.

The Agent Core enforces approval and policy.

The integration performs the external operation.

Verification checks external reality.

Recovery handles uncertainty before retrying.

Each layer has a different responsibility.

That separation is what allows YoMeets to move beyond meeting notes without turning conversational inference into uncontrolled automation.

---

# Closing Remarks

Turning meeting conversations into real work is one of the most useful parts of YoMeets.

It is also the part where architectural discipline matters most.

A transcript error is inconvenient.

A wrong external action can affect other people and systems.

For that reason, execution is intentionally more conservative than meeting understanding.

The model is allowed to interpret.

It is not allowed to assume authority.

Approval establishes intent.

Policy establishes whether the operation is eligible.

Verification establishes whether the intended state actually exists.

Recovery handles uncertainty without blindly repeating side effects.

The result is an execution architecture designed around a simple idea:

> **A meeting commitment should become real work only when the system can explain what it intends to do, receive approval to do it, and verify that it happened exactly once.**