# Live Meeting Pipeline

YoMeets is designed to understand a meeting while it is still happening.

The live meeting pipeline converts raw audio into speaker-aware transcript segments, updates structured meeting state, and surfaces important actions, decisions, and questions without waiting for the meeting to end.

The pipeline is intentionally separated into multiple stages so that audio capture, speech recognition, speaker attribution, language-model reasoning, and state updates can evolve independently.

The live system follows this path:

```text
Live Audio
    │
    ▼
Audio Capture
    │
    ▼
PCM Audio
    │
 ┌──┴───────────────┐
 │                  │
 ▼                  ▼
Streaming STT     Diarization
WHAT + WHEN       WHO + WHEN
 │                  │
 └────────┬─────────┘
          ▼
Speaker-Aware Transcript
          │
          ▼
Speaker Resolution
          │
          ▼
Rolling Transcript Windows
          │
          ▼
Meeting Intelligence
          │
   ┌──────┼──────┐
   ▼      ▼      ▼
Actions Decisions Questions
          │
          ▼
Canonical Meeting State
          │
          ▼
Live UI
```

Each stage performs one responsibility and exposes a stable interface to the next stage.

---

# Audio Capture

The live pipeline begins with audio.

YoMeets is intended to operate independently of a specific meeting platform.

Rather than depending on a Google Meet, Zoom, or Discord transcript API, the local meeting assistant can receive audio from the computer itself.

For online meetings, the relevant sources are typically:

```text
System Audio
     +
Microphone Audio
```

For an in-person meeting, microphone audio may be sufficient.

The capture layer is responsible for converting those sources into a stream of PCM audio that can be consumed by downstream speech-processing providers.

Conceptually:

```text
Microphone ──────┐
                 │
                 ├──► Capture Layer ──► PCM Audio
                 │
System Audio ────┘
```

The capture layer does not determine what anyone said.

It only produces audio and the metadata needed to associate that audio with the active meeting.

---

# Audio Chunks

Continuous audio is processed as smaller chunks.

A chunk represents a bounded interval of captured audio.

Conceptually:

```text
AudioChunk

meetingId
source
startMs
endMs
PCM data
```

The source describes where the audio came from, such as:

```text
microphone
system
mixed
```

This is not speaker identity.

It only describes the capture source.

For example, knowing that audio came from the system output does not tell YoMeets whether Sarah, John, or another remote participant was speaking.

That distinction is handled later by diarization.

---

# Why PCM Is Used

Speech-recognition providers operate on audio samples rather than meeting-specific application objects.

PCM provides a simple representation of those raw audio samples.

The live capture layer can therefore produce PCM audio and allow downstream providers to consume it without understanding the details of the operating system capture mechanism.

Conceptually:

```text
Operating System Audio
        │
        ▼
     PCM Samples
        │
        ▼
Speech Processing Providers
```

Keeping PCM as the provider boundary makes the speech-processing layer easier to replace.

A new STT provider or diarization model should not require changes to the rest of the meeting architecture as long as it can consume the expected audio representation.

---

# Streaming Speech Recognition

The speech-recognition stage determines:

> **What was said and when was it said?**

PCM audio is streamed to the configured STT provider.

The provider returns transcript hypotheses containing text and timestamps.

YoMeets normalizes those responses into a provider-independent representation.

Conceptually:

```text
PCM Audio
    │
    ▼
Streaming STT
    │
    ▼
SttSegment
```

A normalized segment contains information such as:

```text
id
meetingId
startMs
endMs
text
final
```

For example:

```text
startMs: 18400
endMs: 23100
text: "I'll finish the API migration by Friday."
final: true
```

The rest of YoMeets does not need to know how the STT provider represented that response internally.

This abstraction allows the speech-recognition provider to change without requiring modifications to the Meeting Engine.

---

# Interim and Final Transcript Segments

Streaming transcription does not always produce a complete sentence immediately.

While someone is speaking, the provider may return evolving hypotheses.

For example:

```text
"I'll finish..."
```

then:

```text
"I'll finish the API..."
```

then:

```text
"I'll finish the API migration by Friday."
```

These are useful for responsive live transcription, but meeting intelligence should avoid treating every partial hypothesis as a confirmed commitment.

YoMeets therefore preserves whether a transcript segment is finalized.

Finalized transcript segments provide more stable input to downstream reasoning.

The live UI may display interim text sooner, while structured meeting state should generally rely on stable conversation windows.

---

# Speaker Diarization

Speech recognition answers what was said.

It does not necessarily answer who said it.

Speaker diarization operates on the acoustic signal and determines which portions of the meeting were spoken by the same voice.

The output is a timeline of anonymous speaker labels.

For example:

```text
S1  00:00 - 00:08
S2  00:08 - 00:14
S1  00:14 - 00:21
S3  00:21 - 00:30
```

The important property is consistency.

If the same participant speaks several times, the diarization system should ideally assign the same speaker cluster.

The label itself does not need to contain a real name.

```text
S2
```

is sufficient for meeting intelligence to understand that the same person made multiple statements.

---

# Why Diarization Uses Audio

Speaker diarization is primarily an acoustic problem.

The text:

```text
"Yeah, I can do that."
```

contains very little information about who physically said it.

The audio contains information about the speaker's voice.

A diarization system can extract learned speaker representations from the audio and compare them across time.

Conceptually:

```text
PCM Audio
    │
    ▼
Acoustic Features
    │
    ▼
Speaker Representations
    │
    ▼
Speaker Change Detection
    │
    ▼
Clustering
    │
    ▼
S1 / S2 / S3
```

The result is not necessarily a real-world identity.

It is a stable acoustic cluster.

---

# Parallel Speech Processing

Speech recognition and diarization answer different questions.

STT provides:

```text
WHAT + WHEN
```

Diarization provides:

```text
WHO + WHEN
```

A robust live architecture can therefore process the same audio through both paths.

```text
                PCM Audio
                /       \
               /         \
              ▼           ▼
       Streaming STT   Diarization
        WHAT + WHEN     WHO + WHEN
              \           /
               \         /
                ▼       ▼
              Alignment
                  │
                  ▼
         Speaker-Aware Transcript
```

The timestamps provide the common reference between the two outputs.

This separation also allows the speech-recognition and diarization systems to evolve independently.

---

# Timestamp Alignment

STT segments and speaker intervals do not necessarily have identical boundaries.

For example, STT may return:

```text
00:20.0 - 00:25.8
"I'll create the issue tomorrow."
```

while diarization may indicate:

```text
S3
00:19.7 - 00:26.1
```

The alignment layer determines that the transcript segment belongs to `S3`.

The result becomes:

```text
S3 [00:20.0 - 00:25.8]
"I'll create the issue tomorrow."
```

If speech overlaps or speaker confidence is uncertain, the system can preserve that uncertainty rather than inventing a precise attribution.

---

# Speaker-Aware Transcript Segments

After alignment, transcript segments contain both linguistic and speaker information.

Conceptually:

```text
DiarizedSegment

id
meetingId
startMs
endMs
text
final
speakerLabel
confidence
source
```

For example:

```text
speakerLabel: S3
startMs: 20000
endMs: 25800
text: "I'll create the issue tomorrow."
```

These speaker-aware transcript segments form the primary input to the live Meeting Engine.

---

# Stable Speaker Clusters

The speaker label is intentionally treated as a stable cluster rather than a display name.

For example:

```text
S3
```

may later become:

```text
S3 -> Sarah
```

The original transcript still references `S3`.

This matters because participant identity can change as new evidence becomes available.

If the system initially believes:

```text
S3 -> likely Sarah
```

and later learns:

```text
S3 -> confirmed Priya
```

the transcript does not need to be rewritten.

Only the mapping between the speaker cluster and participant changes.

This gives the system a stable internal identity while allowing human-readable identity to evolve.

---

# Speaker Resolution

Diarization determines which voice spoke.

Speaker resolution attempts to connect that voice to a known meeting participant.

Possible evidence includes:

- local microphone ownership,
- known meeting participants,
- direct address,
- immediate conversational responses,
- platform metadata,
- explicit user confirmation,
- prior speaker information.

A speaker cluster can have several resolution states:

```text
unknown
likely
confirmed
```

For example:

```text
S1 -> confirmed Nitin
S2 -> likely Sarah
S3 -> unknown
```

This distinction is intentional.

A conversational inference may be useful without being strong enough to represent confirmed identity.

---

# Identity Resolution During the Meeting

Speaker resolution is stateful.

The system may initially know nothing about `S2`.

Later, someone may say:

```text
Sarah, can you handle the database migration?
```

and the next speaker responds:

```text
Yeah, I'll handle it.
```

That provides evidence that the responding cluster may represent Sarah.

The mapping can become:

```text
S2 -> likely Sarah
```

If stronger evidence appears later, the same cluster can become confirmed.

This allows identity to improve over the lifetime of the meeting without stopping live intelligence.

---

# Meeting Intelligence Before Identity Resolution

Meeting understanding should not depend on every speaker having a real name.

Consider:

```text
S3:
I'll finish the API migration by Friday.
```

Even if `S3` has not yet been identified, YoMeets already knows:

```text
Task: Finish API migration
Owner: S3
Deadline: Friday
```

That information is useful immediately.

The action can therefore be created with:

```text
owner = S3
status = needs_identity
```

Later:

```text
S3 -> Sarah
```

can resolve the human identity.

This separation prevents identity uncertainty from blocking the entire meeting intelligence pipeline.

---

# Transcript Ingestion

Each speaker-aware transcript segment is inserted into canonical meeting state as it arrives.

The ingestion layer records information including:

```text
meetingId
sequence
speakerClusterId
startMs
endMs
text
final
source
```

A monotonic sequence number determines the order in which transcript segments entered the meeting pipeline.

The sequence number is different from the audio timestamp.

Timestamps describe when speech occurred.

Sequence describes processing order.

Both are useful.

---

# Processing Cursor

YoMeets tracks which transcript segments have already been processed by meeting intelligence.

Conceptually:

```text
sequence

1  2  3  4  5  6  7  8
               ▲
               │
       last processed
```

If segments `7` and `8` arrive, the model does not need to receive segments `1` through `6` again.

Instead, it receives:

```text
Current Meeting State
+
Segments 7 and 8
```

This reduces repeated context and creates a clear boundary between processed and unprocessed conversation.

---

# Rolling Meeting Windows

A single transcript segment may not contain enough context to understand what happened.

Consider:

```text
S1:
Can someone take the authentication bug?

S3:
Yeah.

S1:
Can you get it done by Friday?

S3:
That works.
```

Processing each segment independently would make ownership and deadline extraction difficult.

YoMeets therefore groups new conversation into small rolling windows.

The live processor can trigger after several new segments or after a time threshold is reached.

This creates a balance between:

```text
latency
context
cost
```

Short windows respond faster.

Larger windows provide more conversational context.

The system therefore avoids both extremes:

```text
one model call per word
```

and:

```text
one model call after the entire meeting
```

---

# Current Meeting State

The language model does not receive only the new transcript window.

It also receives a compact representation of the meeting state that has already been established.

Conceptually:

```text
Current State

Actions:
- Sarah owns authentication migration, Friday

Decisions:
- PostgreSQL selected for meeting memory

Questions:
- Deployment region unresolved
```

Then new conversation arrives:

```text
Sarah:
Actually, I'll need until Monday.
```

The model has enough state to determine that this should update an existing action rather than create another one.

This makes the reasoning task significantly more focused.

---

# Structured Meeting Operations

The language model is not asked to return arbitrary prose.

It returns structured state-change operations.

Examples include:

```text
CREATE_ACTION
UPDATE_ACTION
CREATE_DECISION
CREATE_QUESTION
RESOLVE_QUESTION
IGNORE
```

A response might conceptually represent:

```text
UPDATE_ACTION

actionId: action_12
deadline: Monday
evidence: segment_84
```

The model therefore describes what changed.

It does not directly modify storage.

---

# Validation Boundary

Model output must pass application-level validation before it can update meeting state.

This includes checks such as:

- operation type is supported,
- required fields exist,
- referenced action IDs exist,
- referenced question IDs exist,
- evidence points to valid transcript segments,
- speaker references exist.

Invalid responses can be rejected or retried.

This creates a strict boundary between probabilistic reasoning and deterministic state mutation.

Conceptually:

```text
Gemini
  │
  ▼
JSON Operations
  │
  ▼
Schema Validation
  │
  ├── Invalid ──► Retry / Reject
  │
  ▼
Valid
  │
  ▼
Apply to Meeting State
```

---

# Creating Actions

When the model detects a clear commitment, it can propose a new action.

For example:

```text
S2:
I'll fix the deployment script tomorrow.
```

may produce:

```text
CREATE_ACTION

owner: S2
task: Fix deployment script
deadline: tomorrow
```

The action is stored in canonical meeting state.

If the speaker's real identity is unresolved, the action can remain associated with `S2`.

---

# Updating Actions

Conversation changes over time.

YoMeets therefore supports updating existing actions.

For example:

```text
S2:
I'll finish it Friday.
```

later becomes:

```text
S2:
Actually, Monday is more realistic.
```

The correct state transition is:

```text
UPDATE_ACTION
```

not:

```text
CREATE_ACTION
```

Maintaining current meeting state allows the model to make this distinction.

---

# Creating Decisions

Meetings often contain decisions that are not action items.

For example:

```text
We're going with PostgreSQL for this.
```

This can become:

```text
CREATE_DECISION

Decision:
Use PostgreSQL

Evidence:
current transcript segment
```

Decisions are stored independently from actions because they represent organizational state rather than work ownership.

---

# Superseding Decisions

Decisions can also change.

For example:

```text
Earlier:
We'll use Redis.

Later:
Let's move this to PostgreSQL instead.
```

A mature meeting state should preserve both statements while representing the later decision as current.

Conceptually:

```text
Redis
status = superseded

PostgreSQL
status = current
```

This becomes important after the meeting because historical retrieval should distinguish:

```text
what was once discussed
```

from:

```text
what the team currently decided
```

---

# Questions

Not every important statement is a decision or action.

Meetings also create unresolved questions.

For example:

```text
Do we know whether the customer needs SSO?
```

This can become:

```text
CREATE_QUESTION
```

Later:

```text
Yes, they confirmed SAML yesterday.
```

can produce:

```text
RESOLVE_QUESTION
```

Tracking questions explicitly prevents unresolved discussion from disappearing inside a transcript.

---

# Evidence Windows

Structured state should remain connected to the conversation that produced it.

For that reason, actions, decisions, and questions retain evidence.

Evidence may contain:

```text
segmentId
startMs
endMs
```

The goal is to preserve the smallest useful portion of the conversation supporting the state change.

For example:

```text
Action:
Fix authentication by Friday

Evidence:
12:22 - 12:31
```

This provides provenance for both debugging and user inspection.

---

# Duplicate Prevention

Live windows can overlap conversationally.

The same commitment may therefore appear relevant across more than one model call.

Without protection, YoMeets could repeatedly create the same action.

The Meeting Engine uses existing meeting state when reasoning about new windows and also applies deterministic duplicate checks when persisting operations.

The goal is:

```text
One commitment
      ↓
One canonical action
```

rather than:

```text
One commitment
      ↓
Action
Action
Action
```

This is particularly important because downstream execution should never be triggered by accidental duplicate meeting state.

---

# Live UI

The live user interface is intentionally minimal.

During the meeting, the meeting platform remains the primary application.

YoMeets should remain mostly invisible.

The compact live interface can surface:

```text
Actions
Decisions
Questions
```

along with speaker information when useful.

The live assistant does not need to display the complete historical memory interface.

That belongs after the meeting.

The design principle is:

> **During the meeting, YoMeets should be almost invisible. After the meeting, YoMeets should become the team's memory.**

---

# Action Notifications

When a meaningful actionable commitment is detected, the UI can surface it without immediately performing the side effect.

For example:

```text
Action detected

Sarah
Create GitHub issue for authentication bug
Due Friday
```

The user can review the action before approving execution.

This keeps live intelligence proactive while preserving the execution safety boundary.

---

# Live Approval Flow

The live meeting pipeline can connect directly to the action execution path.

Conceptually:

```text
Meeting Conversation
        │
        ▼
Action Detected
        │
        ▼
Live UI
        │
        ▼
User Approval
        │
        ▼
Task Engine
        │
        ▼
Agent Core
        │
        ▼
Integration
        │
        ▼
Verification
```

The meeting engine does not bypass the normal execution architecture simply because the action was detected live.

The same approval, policy, idempotency, and verification rules still apply.

---

# Failure Handling

A live meeting system should continue collecting useful information when one downstream component fails.

For example, if the model provider becomes temporarily unavailable:

```text
Audio
  ↓
STT
  ↓
Transcript Storage
  ↓
Meeting Intelligence unavailable
```

transcription should continue.

Unprocessed transcript windows can remain pending for later reasoning.

Similarly, if GitHub becomes unavailable, the meeting transcript and structured state should remain unaffected.

This separation keeps integration failures outside the core conversation pipeline.

---

# Meeting End

Ending the meeting does not simply stop the audio stream.

The system can perform a final reconciliation pass over the completed meeting state.

The purpose is to detect issues such as:

- duplicate actions,
- unresolved speaker identities,
- unresolved questions,
- superseded decisions,
- incomplete evidence,
- conflicting deadlines.

The final meeting state then becomes part of persistent meeting memory.

Conceptually:

```text
Live Meeting
    │
    ▼
Final Transcript
    │
    ▼
Reconciliation
    │
    ▼
Final Meeting State
    │
    ▼
Persistent Memory
```

---

# Relationship to Meeting Memory

The live pipeline is optimized for responsiveness.

The memory pipeline is optimized for retrieval.

Once transcript segments and structured meeting state are sufficiently stable, they can be indexed for historical search.

```text
Live Meeting State
      │
      ▼
Persistent Storage
      │
      ▼
Meeting Memory Index
      │
      ▼
Ask YoMeets
```

The live system therefore creates the information that the post-meeting memory system later retrieves.

---

# Component Boundaries

The live pipeline spans several packages but preserves clear responsibility boundaries.

| Component | Responsibility |
|---|---|
| `audio-core` | Audio stream, STT, and diarization provider contracts |
| `meeting-engine` | Transcript ingestion, speaker clusters, meeting windows, structured operations, and canonical state |
| `model-router` | Language-model provider abstraction |
| `task-engine` | Conversion from accepted actions to executable plans |
| `agent-core` | Approval, execution control, recovery, and verification |
| `integrations` | External application APIs |
| Local UI | Display of live actions, decisions, questions, and speaker state |

The pipeline should remain functional even as individual provider implementations change.

---

# Pipeline Summary

The live meeting pipeline follows one principle:

> **Turn continuous conversation into structured meeting state without making the language model responsible for the system itself.**

Audio capture produces PCM.

Speech recognition determines what was said.

Diarization determines which speaker said it.

Alignment creates speaker-aware transcript segments.

Speaker resolution connects anonymous voices to known participants when enough evidence exists.

Rolling meeting windows provide manageable context.

The language model proposes structured state changes.

Application code validates and applies those changes.

The UI surfaces important state.

Approved actions enter the normal execution pipeline.

Every stage remains independently testable and replaceable.

---

# Closing Remarks

Real-time meeting intelligence is not simply a transcription problem.

A useful system needs to understand conversation as it changes.

People interrupt one another.

Commitments are revised.

Deadlines move.

Decisions are reversed.

Speakers may initially be unknown.

Questions may remain unresolved until much later in the conversation.

YoMeets is designed around those realities.

Instead of waiting for the meeting to end and attempting to reconstruct everything afterward, the live pipeline maintains structured state as the conversation evolves.

The transcript remains the evidence.

Speaker clusters provide stable ownership.

Meeting state preserves the current interpretation.

The language model reasons about changes.

Deterministic software controls what those changes are allowed to do.

That separation is what allows YoMeets to provide live assistance without turning a probabilistic conversation model into an uncontrolled execution system.