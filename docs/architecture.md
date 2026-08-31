# YoMeets Architecture

YoMeets is a real-time AI meeting system designed to understand conversations while they happen, preserve important information across meetings, and safely turn meeting commitments into real-world actions.

Rather than treating a meeting as a transcript that is summarized after the call ends, YoMeets treats the meeting as a continuously changing source of organizational state.

The architecture was designed around one central question:

> **How can a system understand what is happening in a meeting, remember it over time, and safely turn the conversation into real work?**

YoMeets separates this problem into several independent responsibilities: audio processing, speaker-aware transcription, meeting intelligence, persistent memory, action planning, execution, and verification.

This separation allows each part of the system to evolve independently while keeping language-model reasoning separate from external side effects.

---

# Architecture Overview

```text
                         LIVE MEETING
                              │
                              ▼
                    Real-Time Audio Capture
                              │
                              ▼
                           PCM Audio
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
          Streaming STT              Diarization
          WHAT + WHEN                WHO + WHEN
                 │                         │
                 └────────────┬────────────┘
                              ▼
                   Speaker-Aware Transcript
                              │
                              ▼
                     Speaker Resolution
                              │
                              ▼
                    Live Meeting Engine
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
             Actions       Decisions     Questions
                │             │             │
                └─────────────┼─────────────┘
                              ▼
                    Canonical Meeting State
                         │             │
                         │             │
             ┌───────────┘             └────────────┐
             ▼                                      ▼
      EXECUTION PIPELINE                      MEMORY PIPELINE
             │                                      │
             ▼                                      ▼
        Task Engine                             PostgreSQL
             │                                      │
             ▼                                      ▼
        Agent Core                         Meeting Memory Index
             │                                      │
             ▼                                      ▼
     Approval + Policy                            pgvector
             │                                      │
             ▼                                      ▼
        Integrations                           Ask YoMeets
      ┌──────┼──────┐                               │
      ▼      ▼      ▼                               ▼
   GitHub Calendar Gmail                    Grounded Answers
      │
      ▼
   Verification
      │
      ▼
 Execution State
```

YoMeets is intentionally divided into three major flows.

The **live intelligence pipeline** understands what is happening during the meeting.

The **memory pipeline** preserves what happened and makes previous meetings searchable.

The **execution pipeline** converts approved commitments into external actions and verifies that those actions actually occurred.

---

# Design Principles

Several principles guide the architecture.

### Understand conversation before acting

Meeting intelligence determines what happened in the conversation. It does not directly perform external actions.

### Preserve speaker identity independently

The system separates anonymous speaker clusters such as `S1`, `S2`, and `S3` from real participant identities. Meeting intelligence can therefore continue even when a speaker has not yet been identified.

### Maintain structured meeting state

YoMeets does not treat the transcript as the only representation of a meeting. Actions, decisions, questions, participants, speakers, and evidence are maintained as structured state.

### Process meetings incrementally

Only new transcript windows and the current meeting state are sent for reasoning rather than repeatedly processing the complete transcript.

### Separate reasoning from execution

Language-model output describes proposed state changes. Deterministic application code validates and applies those changes.

### Require approval before side effects

External actions are not executed simply because the model detected a commitment.

### Verify external state

Successful API execution is not assumed to mean the intended result exists. External state is checked after execution.

### Preserve meeting history

Information from previous meetings remains available through persistent storage and retrieval rather than disappearing after the live session ends.

---

# Runtime Overview

A YoMeets meeting begins when the local meeting assistant starts receiving audio.

The runtime then follows the same general sequence.

1. Audio is captured from the meeting.
2. Audio is streamed as PCM data.
3. Speech recognition determines what was said and when.
4. Speaker diarization determines which voice spoke during each interval.
5. Transcript and speaker timelines are aligned.
6. Speaker identity is resolved when sufficient evidence exists.
7. New transcript segments are processed by the meeting intelligence layer.
8. Structured actions, decisions, and questions update the current meeting state.
9. Approved actions may enter the execution pipeline.
10. Meeting information is persisted for later retrieval.
11. Ask YoMeets retrieves relevant historical evidence when users ask questions.

The live system therefore does not wait for the meeting to finish before producing useful state.

Meeting understanding evolves continuously as the conversation progresses.

---

# Audio Pipeline

The first layer of YoMeets is responsible for converting live meeting audio into a representation that downstream components can understand.

Audio enters the system from sources such as:

- microphone audio,
- system audio,
- or a combination of both.

The capture layer produces PCM audio that can be consumed by speech-processing providers.

```text
Microphone ──┐
             ├──► Audio Capture ──► PCM Audio
System Audio ┘
```

The audio layer intentionally remains separate from speech recognition.

Its responsibility is simply providing a continuous audio stream with enough metadata to associate the stream with the correct meeting and source.

This allows speech providers to change without redesigning the capture layer.

---

# Streaming Speech Recognition

Speech recognition determines **what was said and when it was said**.

The streaming STT provider receives PCM audio and produces normalized transcript segments.

Conceptually:

```text
PCM Audio
    │
    ▼
Streaming STT
    │
    ▼
Transcript Segment

start time
end time
text
finalization state
```

YoMeets uses a provider-independent transcript representation rather than allowing downstream components to depend directly on provider-specific responses.

A normalized transcript segment contains information such as:

```text
meetingId
startMs
endMs
text
final
```

This boundary allows alternative speech-recognition providers to be introduced without changing the meeting engine.

---

# Speaker Diarization

Transcription alone does not provide enough information for meeting intelligence.

The sentence:

```text
"I'll fix the authentication issue by Friday."
```

is only useful as an actionable commitment if the system also understands who made it.

Speaker diarization determines **which voice spoke during which portion of the meeting**.

Conceptually:

```text
PCM Audio
    │
    ▼
Speaker Diarization
    │
    ▼
Speaker Timeline

S1  00:00 - 00:08
S2  00:08 - 00:15
S1  00:15 - 00:22
S3  00:22 - 00:31
```

Diarization does not need to know that `S2` is Sarah.

Its responsibility is maintaining a stable distinction between voices.

This distinction is important because speaker recognition and participant identity are separate problems.

---

# Speaker-Aware Transcript

Speech recognition provides:

```text
WHAT + WHEN
```

Speaker diarization provides:

```text
WHO + WHEN
```

YoMeets combines these timelines to create a speaker-aware transcript.

```text
S1 [00:04]
We should move authentication into the new service.

S2 [00:11]
That makes sense.

S3 [00:14]
I'll handle the migration by Friday.
```

Each transcript segment maintains a stable reference to its speaker cluster.

This becomes the primary conversational input to the meeting intelligence layer.

---

# Speaker Resolution

Speaker clusters are intentionally separate from participant identities.

During the beginning of a meeting, YoMeets may only know:

```text
S1
S2
S3
```

As additional evidence becomes available, the system can resolve those clusters:

```text
S1 -> Nitin
S2 -> likely Sarah
S3 -> John
```

Possible identity evidence includes:

- local microphone ownership,
- known meeting participants,
- direct address followed by a response,
- conversational context,
- platform metadata,
- explicit user confirmation.

The stable speaker cluster remains unchanged even when participant identity changes.

Conceptually:

```text
Transcript Segment
       │
       ▼
speakerClusterId = S3
       │
       ▼
Speaker Cluster
       │
       ▼
participantId = Sarah
```

This means correcting an identity does not require rewriting the original transcript.

Actions and other meeting objects can also reference the stable speaker cluster before the person's real identity is known.

When identity remains ambiguous, the system can preserve the speaker as unknown rather than forcing a potentially incorrect assignment.

---

# Live Meeting Intelligence

The meeting engine is responsible for converting conversation into structured meeting state.

It receives speaker-aware transcript segments and evaluates new conversation windows.

The model is not asked to produce free-form meeting summaries during this process.

Instead, it produces structured operations describing changes to meeting state.

Examples include:

```text
CREATE_ACTION
UPDATE_ACTION
CREATE_DECISION
CREATE_QUESTION
RESOLVE_QUESTION
IGNORE
```

A conversation such as:

```text
S2:
I'll fix the authentication issue by Friday.
```

may produce:

```text
CREATE_ACTION

Owner: S2
Task: Fix authentication issue
Deadline: Friday
Evidence: current transcript segment
```

The operation is validated before being applied to meeting state.

The language model therefore proposes changes.

Application code determines whether those changes are structurally valid and persists them.

---

# Incremental Meeting Processing

Long meetings create an important efficiency problem.

Sending the entire transcript to a model whenever something new is said would repeatedly process information that has already been understood.

YoMeets avoids this by maintaining a processing cursor over the transcript.

Conceptually:

```text
Already Processed
─────────────────────────────┐
                             │
S1 S2 S1 S3 S2 S1 S3 S2 S1  │
                     ▲       │
                     │       │
             processing cursor
```

Only new transcript segments after the cursor need to be considered.

The meeting engine combines:

```text
Current Meeting State
          +
New Transcript Window
```

and asks the model to determine what changed.

This also allows later statements to modify previous state.

For example:

```text
Sarah:
I'll finish the migration by Friday.

...

Sarah:
Actually, make that Monday.
```

The second statement should update the existing commitment rather than create another independent action.

Persistent meeting state provides the context necessary to make that distinction.

---

# Canonical Meeting State

YoMeets maintains structured state throughout the meeting.

The primary meeting objects include:

```text
Meeting
Participant
Speaker Cluster
Transcript Segment
Action
Decision
Question
Evidence
Execution Result
```

The transcript remains important, but it is not treated as the database itself.

Instead, the transcript provides evidence for structured information.

Conceptually:

```text
Meeting
   │
   ├── Participants
   ├── Speaker Clusters
   ├── Transcript Segments
   ├── Actions
   ├── Decisions
   ├── Questions
   └── Execution Results
```

This makes meeting information directly queryable without repeatedly asking a language model to reconstruct state from raw text.

---

# Evidence and Provenance

Every important meeting object should remain connected to the conversation that produced it.

An action is therefore not stored only as:

```text
Fix authentication by Friday.
```

It also retains evidence describing where that conclusion came from.

Conceptually:

```text
Action
  │
  └── Evidence
        │
        ├── meetingId
        ├── transcriptSegmentId
        ├── startMs
        └── endMs
```

This provides provenance for meeting intelligence.

If audio retention is disabled, evidence can still point to the corresponding timestamped transcript.

The architecture therefore keeps model-generated interpretation connected to source conversation data rather than treating generated state as independent truth.

---

# Meeting-to-Execution Pipeline

Understanding that someone agreed to perform work does not mean the system should immediately modify an external application.

YoMeets separates meeting understanding from execution.

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
```

Each layer has a different responsibility.

---

# Meeting Engine

The Meeting Engine answers:

> **What happened in the conversation?**

It is responsible for:

- actions,
- decisions,
- questions,
- owners,
- deadlines,
- evidence,
- meeting-state updates.

It does not directly call GitHub, Google Calendar, or Gmail.

---

# Task Engine

The Task Engine answers:

> **What executable operation represents this commitment?**

For example:

```text
Meeting Action

"Create a ticket for the authentication bug."
```

may become:

```text
Executable Intent

Integration: GitHub
Operation: Create Issue
Repository: selected repository
Title: Authentication bug
```

This translation separates conversational meaning from integration-specific operations.

---

# Agent Core

The Agent Core controls whether executable operations are allowed to proceed.

Its responsibilities include:

- approval,
- policy enforcement,
- execution state,
- idempotency,
- failure recovery,
- verification coordination.

This layer prevents model reasoning from directly becoming an external side effect.

---

# Approval Boundary

Consequential actions require approval before execution.

The intended flow is:

```text
Detected Action
      │
      ▼
Suggested
      │
      ▼
User Approval
      │
      ▼
Approved
      │
      ▼
Executing
      │
      ▼
Verified / Failed
```

The user therefore remains in control of external changes.

Meeting intelligence can operate automatically.

External side effects cannot.

---

# Integrations

YoMeets V1 intentionally keeps the integration surface narrow.

The primary external systems are:

```text
GitHub
Google Calendar
Gmail
```

These cover three common forms of work created during meetings.

GitHub represents engineering tasks.

Google Calendar represents follow-ups and scheduling.

Gmail represents external communication.

Each integration exposes operations through a common execution boundary rather than allowing application code to directly depend on provider-specific behavior throughout the system.

---

# Verification

Execution and verification are separate responsibilities.

Consider the following sequence:

```text
YoMeets
   │
   ├── Create GitHub Issue ─────► GitHub
   │
   │
   X  connection interrupted
```

The absence of a successful response does not prove that the issue was never created.

Blindly retrying could create a duplicate.

YoMeets therefore treats uncertain external outcomes as states that must be inspected before another side effect occurs.

The general pattern is:

```text
Execute
   │
   ▼
Observe External State
   │
   ├── Expected state exists ──► Verified
   │
   └── Expected state missing ─► Retry / Failure handling
```

This allows recovery behavior to remain separate from the language model.

---

# Persistent Meeting Memory

The second major branch of the architecture begins once meeting information has been structured.

YoMeets preserves meeting history so information remains useful after the live conversation ends.

Conceptually:

```text
Meeting State
     │
     ▼
Persistent Storage
     │
     ├── Transcript
     ├── Speakers
     ├── Actions
     ├── Decisions
     ├── Questions
     └── Evidence
```

Meeting memory therefore contains both raw conversational evidence and structured interpretations.

---

# PostgreSQL and pgvector

Long-term meeting retrieval uses PostgreSQL with pgvector support.

Relational storage is useful for structured queries involving:

```text
meeting
speaker
participant
date
action status
decision state
deadline
```

Vector retrieval is useful when the user asks semantically related questions whose wording differs from the original conversation.

The two forms of retrieval serve different purposes.

For example:

```text
"What did Sarah decide last Tuesday?"
```

contains structured constraints:

```text
speaker = Sarah
date = last Tuesday
```

while:

```text
"Why did we stop using Redis for meeting state?"
```

contains a semantic information need.

The architecture is designed so structured filtering and semantic retrieval can work together rather than treating vector similarity as the entire memory system.

---

# Ask YoMeets

Ask YoMeets provides the interface to historical meeting memory.

A query follows the general path:

```text
User Question
      │
      ▼
Query Understanding
      │
      ▼
Meeting Retrieval
   ┌──┴──────────────┐
   │                 │
   ▼                 ▼
Structured       Semantic
Retrieval        Retrieval
   │                 │
   └────────┬────────┘
            ▼
     Relevant Evidence
            │
            ▼
          Gemini
            │
            ▼
     Grounded Response
```

The language model generates the final response only after relevant meeting evidence has been retrieved.

This enables questions such as:

```text
"What did Sarah say about authentication?"

"Why did we choose PostgreSQL?"

"What am I supposed to finish this week?"

"What changed from the previous meeting?"

"Which decisions are still unresolved?"
```

The purpose of retrieval is not merely providing additional context.

It provides a connection between generated answers and actual meeting history.

---

# Live State and Long-Term Memory

YoMeets separates immediate meeting state from long-term organizational memory.

During a meeting, the system needs fast access to:

- recent transcript segments,
- current actions,
- current decisions,
- open questions,
- speaker mappings.

Afterward, the system needs durable retrieval across many meetings.

These workloads have different requirements.

The architecture therefore treats live state and searchable historical memory as separate concerns even when information eventually flows between them.

```text
             Meeting
                │
                ▼
          Live Meeting State
             /        \
            /          \
           ▼            ▼
   Live Assistance    Persistent Memory
           │            │
           ▼            ▼
       Actions UI    Ask YoMeets
```

This prevents retrieval infrastructure from becoming part of the latency-critical live processing path.

---

# Failure Isolation

One of the architectural goals of YoMeets is allowing individual components to fail without destroying the entire meeting session.

For example, if meeting intelligence temporarily becomes unavailable:

```text
Audio Capture
      │
      ▼
STT
      │
      ▼
Transcript Storage
      │
      ├──► Intelligence temporarily unavailable
      │
      ▼
Transcript continues
```

The transcript can continue accumulating and unprocessed reasoning can be handled later.

Similarly, failure of an external integration should not affect transcription or meeting memory.

The system therefore separates:

```text
Capture
Understanding
Memory
Execution
```

into boundaries where failures can be handled independently.

---

# Component Responsibilities

| Component | Responsibility |
|---|---|
| `audio-core` | Audio, STT, and diarization provider boundaries |
| `meeting-engine` | Transcript ingestion, speaker state, actions, decisions, questions, and live meeting reasoning |
| `task-engine` | Translation from meeting commitments to executable plans |
| `agent-core` | Approval, policy, execution, recovery, idempotency, and verification |
| `integrations` | GitHub, Google Calendar, Gmail, and external API communication |
| `model-router` | Model-provider abstraction and structured LLM requests |
| Storage | Canonical meeting and execution persistence |
| Meeting Memory | Historical indexing and retrieval |
| Local UI | Live meeting state, approval, speaker correction, and historical meeting interaction |

Each component has one primary responsibility.

This boundary is intentional.

Conversation understanding should not know how GitHub authentication works.

GitHub integration code should not determine whether a sentence represents a commitment.

Retrieval infrastructure should not control external side effects.

Keeping those responsibilities separate makes individual components easier to test, replace, and extend.

---

# Extending the Architecture

The architecture is designed so future capabilities can be introduced without changing the core meeting model.

Possible extensions include:

- alternative STT providers,
- alternative diarization systems,
- additional embedding models,
- improved speaker resolution,
- richer temporal reasoning,
- additional retrieval strategies,
- additional external integrations,
- team-level meeting memory,
- more advanced action planning.

A new speech provider only needs to produce the expected transcript representation.

A new integration only needs to implement the execution and verification contracts.

A new retrieval strategy can operate over existing meeting evidence without changing live transcription.

This allows the implementation to evolve while keeping the architectural boundaries stable.

---

# Architectural Summary

YoMeets is organized around one simple principle:

> **Understand the conversation, preserve what matters, and keep reasoning separate from external execution.**

The audio pipeline captures the conversation.

Speech recognition determines what was said.

Diarization determines which speaker said it.

Speaker resolution connects voices to participants.

The Meeting Engine converts conversation into structured state.

The memory layer preserves that state across meetings.

Ask YoMeets retrieves historical evidence.

The Task Engine translates commitments into executable intent.

The Agent Core controls approval and execution.

Integrations modify external systems.

Verification confirms that the intended work actually happened.

Each subsystem performs a distinct responsibility while communicating through stable interfaces.

---

# Closing Remarks

YoMeets began as a system for turning meeting commitments into external actions.

As the project evolved, the larger problem became clear.

Meetings do not only produce tasks.

They produce decisions, context, questions, ownership, deadlines, changes of direction, and information that may become important weeks later.

Treating the transcript as the final product loses much of that structure.

YoMeets instead treats the meeting as a continuously evolving source of organizational state.

The architecture separates real-time conversation understanding, persistent memory, and external execution so each can evolve independently.

That separation also creates a clear safety boundary.

A language model can interpret what people said without being given unrestricted authority to act on their behalf.

Ultimately, YoMeets is designed around the idea that meeting software should do more than remember words.

It should understand **who said what, what changed, what needs to happen next, and how to safely carry that work forward.**