# Meeting Memory

YoMeets is designed so a meeting remains useful after it ends.

The live meeting pipeline understands what is happening in the moment.

The memory system preserves that information across time and makes it retrievable later.

The goal is not simply to store transcripts.

The goal is to preserve enough structure that YoMeets can answer questions about previous meetings, explain why decisions were made, identify unresolved work, and distinguish current information from outdated information.

The memory pipeline follows this path:

```text
Meeting
   │
   ▼
Transcript Segments
Speakers
Actions
Decisions
Questions
Evidence
   │
   ▼
Persistent Storage
   │
   ▼
Meeting Memory Index
   │
   ▼
PostgreSQL + pgvector
   │
   ▼
Retrieval
   │
   ▼
Ask YoMeets
   │
   ▼
Grounded Answer
```

The memory system intentionally combines structured data with semantic retrieval.

A meeting contains both.

---

# Why Meeting Memory Exists

Most meeting systems become much less useful once the meeting ends.

A transcript may still exist, but finding something from weeks ago usually means:

- opening the correct meeting,
- scanning a long transcript,
- remembering approximately when something was discussed,
- and manually reconstructing what the final decision actually was.

That problem becomes much worse across many meetings.

A team may discuss the same topic repeatedly.

A deadline may change.

A decision may be reversed.

An action may be completed.

A question may remain unresolved for several meetings.

If YoMeets only stores independent transcripts, it loses the relationship between those events.

Meeting memory is designed to preserve that continuity.

---

# The Meeting Is More Than a Transcript

The transcript remains the primary evidence source.

It is not the complete representation of the meeting.

YoMeets also preserves structured state such as:

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
   ├── Evidence
   └── Execution Results
```

This distinction is important.

A transcript tells the system what people said.

Structured state tells the system what those statements currently mean.

---

# Persistent Storage

Once meeting information becomes stable enough to preserve, it is written into persistent storage.

Structured records make common meeting questions directly queryable.

Examples include:

```text
Which actions are still open?

What decisions were made last week?

Which actions belong to Sarah?

What deadlines are due this week?

Which questions remain unresolved?
```

Those questions should not require semantic search or a language model every time.

They are structured queries.

This is one reason the memory architecture uses relational storage as its foundation.

---

# Why PostgreSQL

Meeting memory contains many relationships.

An action belongs to a meeting.

A transcript segment belongs to a speaker cluster.

A speaker cluster may map to a participant.

A decision may supersede another decision.

An execution result belongs to an action.

Evidence connects structured state back to transcript segments.

Relational storage represents these relationships naturally.

PostgreSQL provides a strong foundation for:

- meeting metadata,
- participants,
- transcript segments,
- actions,
- decisions,
- questions,
- execution state,
- timestamps,
- speaker relationships,
- evidence.

It also supports pgvector, allowing semantic retrieval to exist alongside structured state rather than requiring a completely separate storage system.

---

# Structured Meeting Retrieval

Many meeting questions contain structured constraints.

For example:

```text
"What did Sarah agree to do last Friday?"
```

contains at least three filters:

```text
participant = Sarah
type = action
date = last Friday
```

Similarly:

```text
"Which decisions from the API meeting are still current?"
```

contains:

```text
meeting = API meeting
type = decision
state = current
```

These constraints are better handled using relational queries than vector similarity alone.

The memory system therefore treats metadata as a first-class part of retrieval.

---

# Semantic Retrieval

Not every question matches the original wording used in a meeting.

Suppose the transcript contains:

```text
"We're seeing too much contention in the current cache layer, so let's move this state into Postgres."
```

Weeks later the user asks:

```text
"Why did we stop using Redis for meeting state?"
```

Those statements are related even though the wording is different.

Semantic retrieval helps find that connection.

Meeting records can therefore be converted into numerical representations and indexed for similarity search.

Conceptually:

```text
Meeting Record
      │
      ▼
Embedding
      │
      ▼
pgvector
```

The user question follows the same path:

```text
Question
   │
   ▼
Embedding
   │
   ▼
Similarity Search
```

The most relevant meeting evidence can then be passed to the language model.

---

# Why pgvector

YoMeets already needs relational storage for meeting state.

Using pgvector allows semantic retrieval to remain inside PostgreSQL.

This keeps:

```text
structured metadata
+
vector representations
```

inside the same database.

That simplifies relationships between retrieved text and the meeting objects that produced it.

A retrieved memory item can still reference:

```text
meetingId
speakerClusterId
participantId
timestamp
decisionId
actionId
evidence
```

without requiring synchronization between completely separate storage systems.

---

# What Gets Indexed

Not every piece of meeting data needs to become an independent memory record.

Useful memory units can include:

- transcript passages,
- decisions,
- actions,
- unresolved questions,
- meeting summaries,
- evidence-backed structured events.

The important property is that every indexed record remains connected to its source meeting.

Conceptually:

```text
Memory Record

id
meetingId
kind
text
speaker
timestamp
evidence
embedding
```

The `kind` might represent:

```text
transcript
decision
action
question
summary
```

This makes retrieval more expressive than searching one large transcript blob.

---

# Chunking Meeting Content

Long transcripts should not be embedded as one giant record.

A one-hour meeting may discuss many unrelated topics.

Embedding the entire transcript would make retrieval imprecise.

Instead, meeting content should be divided into smaller semantic units.

For example:

```text
Meeting
   │
   ├── Authentication discussion
   ├── Database decision
   ├── Deployment issue
   ├── Action ownership
   └── Follow-up scheduling
```

Each unit can retain timestamps and speaker information.

The objective is to create chunks that are large enough to preserve meaning while small enough to remain retrievable.

---

# Evidence-Aware Memory

A memory item should never become disconnected from the conversation that produced it.

For example, a stored decision may look like:

```text
Decision:
Use PostgreSQL for persistent meeting memory
```

but should also retain:

```text
meetingId
source transcript segment
speaker
startMs
endMs
```

This makes the memory system inspectable.

If YoMeets answers:

```text
"The team chose PostgreSQL because it simplified structured and vector storage."
```

the answer should be traceable to the meeting evidence supporting that claim.

The memory system therefore preserves provenance as part of retrieval rather than adding citations as an afterthought.

---

# Ask YoMeets

Ask YoMeets is the user-facing interface to meeting memory.

It allows questions across one meeting or many meetings.

Examples include:

```text
"What did Sarah say about authentication?"

"Why did we choose PostgreSQL?"

"What am I supposed to finish this week?"

"What changed from the previous meeting?"

"Which decisions are still unresolved?"

"When did we decide to move away from Redis?"
```

The important part is that the model should not answer those questions from general knowledge.

It should answer from retrieved meeting evidence.

---

# Ask YoMeets Pipeline

A question follows the general flow:

```text
User Question
      │
      ▼
Query Understanding
      │
      ▼
Retrieval Planning
      │
   ┌──┴────────────┐
   │               │
   ▼               ▼
Structured      Semantic
Retrieval       Retrieval
   │               │
   └──────┬────────┘
          ▼
   Relevant Evidence
          │
          ▼
       Gemini
          │
          ▼
   Grounded Response
```

The language model is used after retrieval.

It is not the primary storage mechanism.

---

# Query Understanding

User questions often contain several kinds of constraints simultaneously.

Consider:

```text
"What did Sarah decide about authentication last week?"
```

The system can recognize:

```text
participant = Sarah
topic = authentication
time = last week
type = decision
```

That information can guide retrieval.

Rather than performing one unrestricted vector search over everything, the system can narrow the search space before semantic ranking.

This makes retrieval both faster and more accurate.

---

# Hybrid Retrieval

A mature meeting memory system should not rely on only one retrieval technique.

YoMeets is designed around hybrid retrieval.

Conceptually:

```text
                   User Question
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
      Metadata        Semantic      Temporal
       Filters         Search        Ranking
           │             │             │
           └─────────────┼─────────────┘
                         ▼
                    Candidate Set
                         │
                         ▼
                       Rerank
                         │
                         ▼
                  Relevant Evidence
```

Different retrieval techniques answer different parts of the question.

Metadata answers:

```text
Who?
When?
Which meeting?
What type of object?
```

Semantic retrieval answers:

```text
What topic or concept is this related to?
```

Temporal logic answers:

```text
Which information is current?
Which information was superseded?
```

Together they provide a much stronger memory system than vector similarity alone.

---

# Temporal Memory

Meetings contain information that changes over time.

This makes temporal reasoning especially important.

Consider:

```text
Meeting 1:
"We'll launch on Friday."

Meeting 2:
"We need to move launch to Monday."

Meeting 3:
"Monday is confirmed."
```

All three statements are historically true.

Only the latest one represents the current schedule.

The memory system should therefore preserve both history and current state.

Conceptually:

```text
Friday
status = superseded

Monday
status = current
```

This allows YoMeets to answer two different questions correctly:

```text
"What did we originally decide?"
```

and:

```text
"When are we launching now?"
```

---

# Decision History

Decisions are particularly sensitive to temporal state.

A decision can be:

```text
current
superseded
historical
```

For example:

```text
Decision 1:
Use Redis

Decision 2:
Use PostgreSQL

Decision 2 supersedes Decision 1
```

The system should not delete the old decision.

Historical context may still matter.

Instead, the relationship between the decisions should be preserved.

This allows Ask YoMeets to explain both:

```text
what changed
```

and:

```text
why it changed
```

---

# Action Lifecycle

Actions also change over time.

An action may move through states such as:

```text
detected
needs_identity
open
approved
executing
verified
failed
completed
```

The memory system should preserve that lifecycle.

A question such as:

```text
"What am I supposed to finish this week?"
```

should retrieve active actions.

A question such as:

```text
"What did I complete last week?"
```

should retrieve historical verified actions.

The underlying action object therefore matters more than simply finding transcript text mentioning the task.

---

# Questions Across Meetings

Unresolved questions can persist across meetings.

For example:

```text
Meeting 1:
"Do we know whether the customer needs SSO?"
```

The question remains open.

Later:

```text
Meeting 3:
"They confirmed SAML yesterday."
```

The memory system can resolve the earlier question using later evidence.

This allows YoMeets to track uncertainty across time rather than treating each meeting as an isolated document.

---

# Speaker-Aware Retrieval

Speaker attribution adds another useful retrieval dimension.

Because transcript segments reference stable speaker clusters and resolved participants when available, Ask YoMeets can answer questions such as:

```text
"What did Sarah say about the deployment?"

"What did John commit to?"

"What decisions did I make this month?"
```

If the speaker identity was resolved after the meeting, historical transcript segments can still inherit that relationship through the stable cluster mapping.

This is one reason speaker identity is separated from transcript text.

---

# Meeting-Level Retrieval

Users may sometimes want answers restricted to one meeting.

For example:

```text
"In yesterday's design review, why did we reject MongoDB?"
```

The retrieval system can first restrict candidates to:

```text
meetingId = yesterday's design review
```

before performing semantic search.

This avoids pulling unrelated evidence from other meetings discussing MongoDB.

Meeting scope therefore becomes an important retrieval constraint.

---

# Cross-Meeting Retrieval

Other questions intentionally span many meetings.

For example:

```text
"How has our authentication plan changed over the last month?"
```

This requires evidence from multiple meetings.

The system can retrieve relevant decisions and transcript passages ordered over time.

The final answer can then describe the evolution of the discussion rather than returning one isolated statement.

This is where persistent meeting memory becomes significantly more useful than individual transcript search.

---

# Retrieval Ranking

Similarity score alone should not determine the final evidence order.

Useful ranking signals can include:

```text
semantic similarity
meeting recency
speaker match
meeting match
object type
decision status
action status
temporal relevance
```

For example, a superseded decision may be semantically very similar to the user's question.

If the user asks for the current decision, the newer current record should rank higher.

Retrieval therefore needs to understand more than embedding distance.

---

# Grounded Answer Generation

After retrieval, the language model receives only the most relevant evidence.

Conceptually:

```text
Question

"What did we decide about the database?"

Evidence

[Meeting A]
Use Redis for the prototype.

[Meeting B]
PostgreSQL will replace Redis for persistent state.

[Meeting C]
PostgreSQL decision confirmed.
```

The model can then generate:

```text
The team initially planned to use Redis for the prototype,
but later replaced it with PostgreSQL for persistent state.
The PostgreSQL decision was confirmed in the following meeting.
```

The answer is generated from evidence rather than from the model's general memory.

---

# Citation and Provenance

Ask YoMeets should expose where an answer came from.

A citation can point to:

```text
meeting
date
speaker
timestamp
transcript evidence
```

For example:

```text
Engineering Sync — Aug 27 — 18:42
```

If raw audio is retained, that timestamp could also represent a playable meeting moment.

If audio is not retained, the same evidence can point to the corresponding transcript segment.

The important property is that the user can inspect the underlying meeting evidence.

---

# Why Audio Is Not Required for Memory

Meeting memory does not fundamentally require storing raw audio.

Once the system has reliable transcript segments, speaker clusters, timestamps, and structured state, those records are sufficient for most retrieval tasks.

Conceptually:

```text
Audio
  ↓
Transcript + Speakers + Timestamps
  ↓
Persistent Memory
```

The raw audio can therefore be optional.

If audio retention is disabled, the memory system can still provide timestamped transcript evidence.

This also reduces storage and privacy requirements.

---

# Reconciliation Before Indexing

The final live state may contain unresolved or conflicting information.

For example:

- duplicate actions,
- uncertain speaker identities,
- conflicting deadlines,
- unresolved questions,
- superseded decisions.

Before the meeting becomes long-term memory, the system can perform reconciliation.

Conceptually:

```text
Live Meeting State
       │
       ▼
Reconciliation
       │
       ▼
Stable Meeting State
       │
       ▼
Memory Index
```

This reduces the chance that temporary live-state uncertainty becomes permanent retrieval noise.

---

# Incremental Indexing

Meeting memory does not need to wait until the entire meeting ends before indexing anything.

Stable content can be indexed incrementally.

For example:

```text
finalized transcript segments
confirmed decisions
stable actions
```

can become searchable while the meeting continues.

However, end-of-meeting reconciliation may later update or replace some records.

The memory system should therefore support upserts rather than assuming every indexed record is immutable.

---

# Updating Existing Memory

If an action or decision changes, the memory index should update rather than creating disconnected contradictory records.

For example:

```text
Action:
Finish migration Friday
```

later becomes:

```text
Action:
Finish migration Monday
```

The structured action remains the same logical object.

Its searchable representation can be updated while preserving the historical evidence explaining the change.

This prevents retrieval from treating every state transition as an unrelated fact.

---

# Memory Records and Evidence

A memory record should contain enough information to reconnect retrieval results with canonical state.

Conceptually:

```text
MemoryRecord

id
meetingId
kind
text
embedding
evidence
sourceObjectId
createdAt
updatedAt
```

The source object might be:

```text
action
decision
question
transcript segment
```

This means the memory index does not become a second independent source of truth.

It remains an index over canonical meeting information.

---

# Source of Truth

One design principle is particularly important:

> **The vector index is not the source of truth.**

Canonical meeting state remains in structured storage.

The memory index exists to find relevant information.

If the index says one thing and canonical meeting state says another, the canonical state wins.

This prevents retrieval infrastructure from accidentally becoming responsible for meeting semantics.

---

# Failure Handling

The memory pipeline should not block the live meeting pipeline.

If embedding generation or PostgreSQL indexing temporarily fails, transcript ingestion and meeting intelligence should continue.

Conceptually:

```text
Live Meeting
    │
    ▼
Canonical State
    │
    ├──► Memory indexing succeeds
    │
    └──► Memory indexing pending
```

Pending records can be retried later.

This keeps retrieval infrastructure outside the latency-critical conversation path.

---

# Privacy

Meeting memory can contain sensitive organizational information.

The system therefore needs clear boundaries around what is preserved.

Important considerations include:

- whether raw audio is retained,
- how long transcripts are stored,
- whether meeting memory can be deleted,
- how authentication tokens are stored,
- what context is sent to model providers,
- whether speaker identity data is persistent.

Persistent voiceprints require especially careful handling because voice embeddings may be biometric data.

Speaker clustering inside an individual meeting is different from maintaining long-term biometric identity across meetings.

That distinction should remain explicit.

---

# Memory Evaluation

Meeting memory should be evaluated separately from live extraction.

Useful measurements include:

```text
Recall@K
citation accuracy
retrieval latency
answer groundedness
temporal accuracy
speaker-filter accuracy
abstention accuracy
```

For example, a retrieval benchmark might contain:

```text
Question
Expected evidence
Expected current decision
Expected speaker
Expected meeting
```

The system can then measure whether the correct evidence appears among the top retrieved records.

This is more informative than evaluating only whether the final language-model response sounds reasonable.

---

# Retrieval Failure

A good memory system should recognize when relevant evidence does not exist.

Suppose the user asks:

```text
"What did Sarah say about Kubernetes?"
```

but Kubernetes was never discussed.

The system should not generate a plausible answer from general model knowledge.

The correct response is some form of:

```text
I couldn't find that in the available meeting history.
```

Abstention is therefore part of retrieval quality.

A grounded meeting assistant should prefer missing an answer over inventing organizational history.

---

# Relationship to the Live Pipeline

The live meeting pipeline and memory pipeline solve different problems.

The live pipeline answers:

> **What is happening right now?**

The memory pipeline answers:

> **What has happened across time?**

Conceptually:

```text
               Meeting
                  │
                  ▼
            Live Meeting State
             /             \
            /               \
           ▼                 ▼
   Live Assistance      Persistent Memory
           │                 │
           ▼                 ▼
       Current Work      Ask YoMeets
```

The same underlying meeting objects support both systems.

The difference is how they are accessed and optimized.

---

# Component Responsibilities

| Component | Responsibility |
|---|---|
| Meeting Storage | Canonical meeting, transcript, speaker, action, decision, and question state |
| Memory Index | Searchable representation of meeting information |
| PostgreSQL | Relational meeting metadata and persistent state |
| pgvector | Semantic similarity retrieval |
| Embedding Layer | Converts memory records and queries into vector representations |
| Retrieval Layer | Combines semantic, metadata, and temporal signals |
| Ask YoMeets | Uses retrieved evidence to generate grounded answers |
| Meeting Engine | Produces the structured state that eventually becomes memory |

The retrieval layer is intentionally downstream from canonical meeting state.

---

# Memory Pipeline Summary

The meeting memory pipeline follows one principle:

> **Remember the meaning of the meeting without losing the evidence that produced it.**

Transcript segments preserve what was said.

Speaker clusters preserve who said it.

Structured state preserves actions, decisions, and questions.

PostgreSQL preserves relationships.

pgvector supports semantic retrieval.

Temporal state distinguishes current information from superseded information.

Ask YoMeets retrieves relevant evidence before generating a response.

Each part contributes something different.

No single component represents the entire memory system.

---

# Closing Remarks

A searchable transcript is useful.

A persistent meeting memory system is more useful.

Teams do not only need to remember individual sentences.

They need to remember:

- what was decided,
- who agreed to do something,
- what changed later,
- what remains unresolved,
- and why the current state became the current state.

That requires more than storing text.

It requires structure, time, speakers, evidence, and retrieval working together.

YoMeets is designed so meeting history becomes a continuously evolving organizational memory rather than a collection of disconnected transcripts.

The objective is not to make the language model remember every meeting.

The objective is to build a system that can retrieve the right evidence when that history becomes important.