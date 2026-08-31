# YoMeets

> **Real-time AI meeting assistant that understands who said what, tracks decisions and commitments as they happen, builds persistent meeting memory, and turns approved follow-ups into verified actions across GitHub, Google Calendar, and Gmail.**


---

## Demo

<p align="center">
<b>End-to-end meeting demonstration showing live transcription, speaker-aware meeting intelligence, action detection, approval-controlled execution, and post-meeting retrieval.</b>
</p>

Will be updated soon !!!!

---

## Key Capabilities

- Real-time meeting transcription
- Speaker diarization and speaker-aware transcript state
- Live extraction of actions, decisions, and unresolved questions
- Persistent meeting memory across historical meetings
- Ask YoMeets retrieval over previous conversations and decisions
- Approval-controlled GitHub, Google Calendar, and Gmail execution
- External action verification and duplicate-side-effect protection
- Incremental meeting processing instead of repeatedly processing full transcripts
- PostgreSQL + pgvector meeting retrieval
- Local-first meeting state and execution control

---

## Architecture

```text
┌──────────────────────────────────────────────┐
│              Live Meeting Source             │
│        Zoom / Google Meet / Discord / local   │
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│        Audio Capture and Transcription        │
│ macOS ffmpeg/AVFoundation → Deepgram STT      │
│ Deepgram speaker labels / diarization         │
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│        Live Meeting Intelligence Core         │
│ Gemini window processor emits typed ops       │
│ CREATE_ACTION / CREATE_DECISION / QUESTION    │
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│           Canonical Meeting State             │
│ transcript · speakers · actions · decisions   │
│ questions · evidence timestamps               │
└───────────────┬──────────────────┬───────────┘
                ▼                  ▼
┌────────────────────────┐  ┌────────────────────────┐
│ Speaker Resolver       │  │ Evidence System         │
│ unknown → likely →     │  │ recorded WAV clips      │
│ confirmed identity     │  │ clipStart/clipEnd       │
└───────────────┬────────┘  └────────────┬───────────┘
                ▼                        ▼
┌──────────────────────────────────────────────┐
│        Memory System + Local API / SSE        │
│ SQLite state · Postgres/pgvector · live stream│
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│          Desktop Product UI + Overlay         │
│ Tauri shell · live dashboard · play/approve   │
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│        Approval → Execution → Verification    │
│ GitHub issues · Calendar events · Gmail drafts│
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│           Ask YoMeets / Accountability        │
│ cross-meeting memory, citations, open items   │
└──────────────────────────────────────────────┘
```

YoMeets separates **conversation understanding**, **meeting memory**, **action planning**, and **external execution** into independent components.

The meeting intelligence layer understands what happened in the conversation.

The memory layer preserves what the team discussed across meetings.

The task and agent layers determine what should happen next and whether it is safe to execute.

External integrations perform and verify approved actions.

See the full architecture write-up in [docs/architecture.md](docs/architecture.md).

---

## Why YoMeets?

Most meeting tools stop after transcription or summarization.

That solves only part of the problem.

During a real meeting, important information is spread across a conversation:

- someone agrees to fix a bug,
- another person changes a deadline,
- the team makes a technical decision,
- an unresolved question is left for later,
- and someone needs to create a ticket or schedule a follow-up.

After the meeting, somebody still has to remember all of that.

YoMeets follows a different philosophy.

Instead of treating a meeting as a document that needs to be summarized, **YoMeets treats the meeting as a live stream of organizational state.**

The system continuously tracks:

- who is speaking,
- what was decided,
- what changed,
- who committed to something,
- what remains unresolved,
- and which commitments can become real work.

The result is not only a transcript.

It is a persistent representation of what the team knows and what the team needs to do next.

---

## System Pipeline

```text
Live Meeting Audio
        │
        ▼
Streaming Speech Recognition
        │
        ├───────────────┐
        ▼               ▼
Transcript         Speaker Diarization
WHAT + WHEN         WHO + WHEN
        │               │
        └──────┬────────┘
               ▼
       Speaker-Aware Transcript
               │
               ▼
       Live Meeting Intelligence
               │
     ┌─────────┼──────────┐
     ▼         ▼          ▼
  Actions   Decisions   Questions
     │
     ▼
Approval-Controlled Execution
     │
 ┌───┼─────────────┐
 ▼   ▼             ▼
GitHub Calendar   Gmail
     │
     ▼
Verification + Recovery
```

At the same time:

```text
Meeting State
      │
      ▼
Persistent Storage
      │
      ▼
PostgreSQL + pgvector
      │
      ▼
Meeting Retrieval
      │
      ▼
Ask YoMeets
      │
      ▼
Grounded answers from meeting history
```

---

## Live Meeting Intelligence

YoMeets does not wait until a meeting ends before understanding it.

Transcript segments are processed incrementally while the meeting is happening.

Rather than repeatedly sending the entire transcript to the model, YoMeets maintains structured meeting state and processes only new conversation windows.

The live engine can create or update:

- actions,
- decisions,
- unresolved questions,
- speaker ownership,
- deadlines,
- superseded decisions.

This allows the system to react when the conversation changes.

For example:

```text
Sarah: I'll finish the authentication fix by Friday.
```

YoMeets can create:

```text
Action
Owner: Sarah
Task: Fix authentication issue
Deadline: Friday
```

If Sarah later says:

```text
Actually, I'll need until Monday.
```

YoMeets updates the existing action rather than creating another one.

---

## Speaker-Aware Meeting State

Understanding the words alone is not enough.

Meeting intelligence also needs to understand **who said them**.

YoMeets separates speaker diarization from speaker identity.

The audio pipeline first produces stable speaker clusters:

```text
S1
S2
S3
```

Those clusters remain the permanent technical identity inside the meeting.

A speaker resolver can later associate them with known participants:

```text
S1 -> Nitin
S2 -> likely Sarah
S3 -> John
```

This separation allows meeting intelligence to continue operating even when a speaker's real identity has not yet been resolved.

Actions can therefore belong to `S2` immediately and later inherit the correct participant identity without rewriting the original transcript.

---

## Meeting Memory

A meeting should not become useless once it ends.

YoMeets stores structured meeting history so previous conversations become searchable organizational memory.

The system preserves information including:

- transcript segments,
- speakers,
- decisions,
- actions,
- questions,
- deadlines,
- evidence,
- execution results.

Historical meeting content is indexed for retrieval using PostgreSQL and pgvector.

This enables questions such as:

```text
"What did Sarah say about authentication?"

"Why did we move to PostgreSQL?"

"What did I agree to finish this week?"

"What changed between the last two meetings?"

"Which decisions are still unresolved?"
```

Rather than answering from general model knowledge, Ask YoMeets retrieves relevant meeting evidence before generating a response.

---

## Meeting-to-Execution

One of the defining parts of YoMeets is that commitments do not have to stop at meeting notes.

If someone agrees to perform an action, YoMeets can translate that commitment into an executable operation.

Supported V1 integrations include:

- GitHub
- Google Calendar
- Gmail

The execution path is intentionally separated into several responsibilities.

```text
Meeting Intelligence
        │
        ▼
Human Commitment
        │
        ▼
Task Planning
        │
        ▼
Approval + Policy
        │
        ▼
External Integration
        │
        ▼
Verification
```

The model never directly performs the external side effect.

Every consequential action passes through an approval and execution layer before reaching an external API.

---

## Why I Separated Understanding from Execution

The first versions of YoMeets made meeting understanding and execution feel like one problem.

The more I worked on the system, the less I liked that architecture.

Understanding a conversation and modifying an external system have completely different reliability requirements.

A model can be useful even when it is uncertain about conversational meaning.

External side effects cannot be treated that casually.

Creating the wrong GitHub issue is annoying.

Changing the wrong calendar event or sending the wrong message is much worse.

Eventually I separated those responsibilities completely.

The meeting engine determines:

> **What happened in the conversation?**

The task engine determines:

> **What executable operation represents that commitment?**

The agent layer determines:

> **Is this operation approved and safe to perform?**

The integration determines:

> **Did the external system actually change?**

That separation became one of the most important architectural decisions in YoMeets.

---

## Why I Kept Speaker Identity Separate from Diarization

Initially it was tempting to think of speaker identification as a single problem.

It is not.

Audio can tell the system that two pieces of speech probably came from the same person.

It cannot always tell the system that the person is Sarah.

That distinction matters.

I therefore separated:

```text
Speaker clustering
```

from:

```text
Participant identity
```

The transcript can safely retain `S2` even when the identity is unknown.

Later evidence such as local microphone ownership, participant metadata, conversation context, or explicit user confirmation can resolve:

```text
S2 -> Sarah
```

without modifying the original meeting history.

This also allows the system to abstain when identity is genuinely ambiguous instead of forcing a guess.

---

## Why I Process Meetings Incrementally

Sending an entire meeting transcript to an LLM every few seconds would be simple.

It would also be wasteful.

Most of the meeting has not changed.

Only the latest part of the conversation needs new reasoning.

YoMeets therefore maintains persistent meeting state and processes new transcript windows incrementally.

The current live pipeline can trigger processing after several new transcript segments or after a time window has elapsed.

The model receives:

```text
Current meeting state
+
New transcript segments
```

instead of the full meeting history.

This reduces repeated context while still allowing new statements to update earlier commitments and decisions.

---

## Why I Added Verification After Execution

An API returning successfully does not always mean the intended work actually happened.

Network failures also create an uncomfortable problem.

If the connection disappears after an external system accepts a request but before YoMeets receives the response, blindly retrying can produce duplicate side effects.

For that reason, execution and verification are separate stages.

After performing an external action, YoMeets checks the resulting external state.

If the result is uncertain, the system inspects the external system before retrying.

This design is intended to preserve one important property:

> **Retrying a failed workflow should not repeat work that already happened.**

---

## Components

| Component        | Responsibility                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `audio-core`      | Live audio/STT/diarization provider boundaries                                          |
| `meeting-engine`  | Transcript ingestion, meeting state, actions, decisions, questions, speaker resolution   |
| `task-engine`     | Converts commitments into executable plans                                              |
| `agent-core`      | Approval, policy, execution, recovery, verification                                     |
| `integrations`    | GitHub, Google Calendar, Gmail, HTTP integrations                                       |
| `model-router`    | Gemini and model-provider abstraction                                                    |
| Meeting Memory    | PostgreSQL/pgvector retrieval and historical meeting indexing                            |
| Desktop/Local UI  | Live meeting state, actions, decisions, questions, speaker confirmation                  |

---

## Engineering Highlights

• Real-time streaming meeting pipeline
• Speaker-aware transcript state
• Incremental LLM processing
• Structured meeting operations
• Persistent cross-meeting memory
• PostgreSQL + pgvector retrieval
• Approval-controlled agentic execution
• GitHub, Google Calendar, and Gmail integrations
• External-state verification
• Idempotency and recovery safeguards
• Local-first execution architecture
• Deterministic benchmark and test infrastructure

---

## Build and Test Verification

YoMeets is designed around reproducible local development and evaluation.

### Core Verification

- ✅ TypeScript monorepo build
- ✅ Type checking
- ✅ Unit tests
- ✅ Meeting execution benchmark
- ✅ Deterministic live meeting demo
- ✅ Integration smoke-test paths
- ✅ PostgreSQL/pgvector memory path
- ✅ GitHub / Calendar / Gmail integration boundaries

### Evaluation

The system should be evaluated across several independent dimensions:

- commitment extraction precision and recall,
- speaker attribution accuracy,
- owner and deadline accuracy,
- live action-detection latency,
- execution success rate,
- verification accuracy,
- duplicate side-effect rate,
- recovery success rate,
- retrieval Recall@K,
- citation accuracy,
- human correction rate.

---

## Repository Status

| Component                               | Status |
| ---------------------------------------- | ------ |
| Canonical meeting state                  | ✅     |
| Live transcript ingestion                | ✅     |
| Incremental meeting reasoning            | ✅     |
| Actions / decisions / questions          | ✅     |
| Speaker cluster model                    | ✅     |
| Speaker resolution framework             | ✅     |
| macOS ffmpeg audio recorder boundary     | ✅     |
| Deepgram streaming STT adapter           | ✅     |
| Deepgram speaker-label diarization path  | ✅     |
| Tauri desktop shell and overlay scaffold | ✅     |
| Playable evidence audio path             | ✅     |
| Approval-controlled execution            | ✅     |
| GitHub integration                       | ✅     |
| Google Calendar integration              | ✅     |
| Gmail integration                        | ✅     |
| External action verification             | ✅     |
| PostgreSQL + pgvector memory             | ✅     |
| Ask YoMeets retrieval path                | ✅     |
| Live dashboard state                     | ✅     |
| Real macOS meeting capture verification  | 🚧     |
| BlackHole/system-audio device setup      | 🚧     |
| Production OAuth setup                   | 🚧     |
| Real-world meeting benchmark             | 🚧     |

---

## Documentation

- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Engineering Design Decisions](docs/design-decisions.md)
- [Live Meeting Pipeline](docs/live-meeting-pipeline.md)
- [Meeting Memory](docs/meeting-memory.md)
- [Agent Execution and Safety](docs/agent-execution-safety.md)
- [Integrations](docs/integrations.md)
- [Live Meeting Product](docs/live-meeting-product.md)
- [Local Live Demo](docs/local-live-demo.md)
- [API Integrations](docs/api-integrations.md)
- [Evaluation and Benchmarks](docs/evaluation-and-benchmarks.md)
- [Benchmark Results](docs/benchmark-results.md)
- [Product Direction](docs/product-direction.md)

---

> **YoMeets treats meetings as persistent organizational state: understand the conversation while it happens, remember what matters, and safely turn approved commitments into verified work.**
