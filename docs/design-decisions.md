# Engineering Design Decisions

The architecture documentation explains how YoMeets is organized.

This document explains why I designed it that way.

When I started building YoMeets, I expected the difficult part of the project to be connecting a language model to meeting transcripts.

That wasn't what happened.

Getting a model to recognize that someone had made a decision or agreed to complete a task was relatively straightforward.

The difficult part was everything around that model.

How should the system know who made the commitment?

What happens when someone changes a deadline later in the meeting?

How should a decision made twenty minutes ago be updated without processing the entire transcript again?

When is an extracted action safe to execute?

What happens if an external API succeeds but YoMeets never receives the response?

How should information from hundreds of previous conversations remain useful without sending entire meeting histories back to a model?

As the project grew, these questions became much more important than prompt design.

Most of the architecture eventually formed around one principle:

> **Conversation understanding, organizational memory, and external execution should remain separate responsibilities.**

This document captures the reasoning behind those decisions.

---

# Why I Separated Meeting Intelligence from Execution

The first versions of YoMeets were centered around a simple idea.

If someone says:

> "I'll create the authentication ticket after this meeting."

the system should understand the commitment and create the ticket.

Initially those felt like two parts of the same problem.

The longer I worked on the system, the less comfortable I became with that architecture.

Understanding a conversation and modifying an external system have completely different reliability requirements.

Meeting language is naturally ambiguous.

Someone might say:

> "Maybe we should create a ticket for that."

That is different from:

> "I'll create a ticket for that."

And both are different from:

> "YoMeets, create a ticket for that."

A language model can reason about those differences, but its interpretation should not automatically become an external side effect.

Eventually I separated the responsibilities completely.

The Meeting Engine answers:

> **What happened in the conversation?**

The Task Engine answers:

> **What executable operation represents that commitment?**

The Agent Core answers:

> **Is this operation approved and safe to perform?**

The integration answers:

> **Did the external system actually change?**

This became one of the most important architectural boundaries in YoMeets.

It allows meeting intelligence to remain probabilistic while execution remains controlled and deterministic.

---

# Why I Did Not Let the LLM Directly Call Integrations

Once meeting intelligence and execution were separated, another design decision followed naturally.

The language model should never directly control GitHub, Google Calendar, or Gmail.

It would certainly make the implementation simpler.

The model could receive a transcript, decide what happened, and immediately call the appropriate tool.

But that would combine reasoning and authority inside the same component.

I did not want a model misunderstanding a sentence to be enough to create an external side effect.

Instead, model output is treated as proposed structured state.

For example:

```text
CREATE_ACTION

Owner: S2
Task: Create authentication issue
Deadline: Friday
```

That operation is validated and persisted before anything external happens.

Only later can the action become an executable plan.

The execution pipeline then applies approval, policy, idempotency, and verification independently.

This creates a useful boundary.

The model can be wrong without automatically making the external world wrong.

---

# Why I Store Structured Meeting State Instead of Only Transcripts

At first, storing the complete meeting transcript seemed sufficient.

Everything that happened was technically there.

If I needed to know what was decided, I could ask a model.

If I needed the action items, I could ask the model again.

If I needed unresolved questions, I could ask again.

The problem became obvious once I started thinking about live meetings.

Suppose someone says:

```text
Sarah:
I'll finish the migration by Friday.
```

Twenty minutes later:

```text
Sarah:
Actually, I'll need until Monday.
```

If the transcript is the only source of state, every consumer has to reconstruct the current truth from those two statements.

That becomes increasingly difficult as meetings grow.

I therefore started treating the transcript as evidence rather than the entire state of the system.

YoMeets maintains structured objects for:

- actions,
- decisions,
- questions,
- participants,
- speaker clusters,
- evidence,
- execution results.

The transcript still matters.

In fact, it remains the primary source of provenance.

But downstream systems no longer need to repeatedly reconstruct basic meeting state from raw conversation.

That made both live assistance and post-meeting retrieval considerably easier to reason about.

---

# Why I Process Meetings Incrementally

One of the first scaling problems I noticed was repeated context.

The simplest live meeting implementation would work like this:

```text
New sentence
     ↓
Send complete transcript to model
     ↓
Update meeting
```

Then another sentence arrives:

```text
New sentence
     ↓
Send complete transcript again
     ↓
Update meeting
```

That approach becomes increasingly wasteful as the meeting continues.

Most of the conversation has already been processed.

Only a small portion is new.

YoMeets therefore maintains a processing cursor and reasons over new transcript windows together with the current meeting state.

Conceptually:

```text
Current Meeting State
          +
New Transcript Segments
          ↓
        Model
          ↓
State Changes Only
```

This changed the role of the language model.

Instead of repeatedly asking:

> "What happened in this meeting?"

the system asks:

> "Given what we already know, what changed in this new part of the conversation?"

That distinction significantly simplified live processing.

It also created a natural way to handle updates.

If an existing deadline changes, the model can produce an update instead of rediscovering every action from the beginning.

---

# Why I Use Structured Operations

Once incremental processing was introduced, I needed a reliable interface between model reasoning and application state.

Free-form text was not sufficient.

A response such as:

```text
Sarah seems to have agreed to finish the migration by Monday.
```

may be understandable to a person, but application code should not have to interpret natural language produced by another model.

I therefore restricted live meeting reasoning to structured operations.

Examples include:

```text
CREATE_ACTION
UPDATE_ACTION
CREATE_DECISION
CREATE_QUESTION
RESOLVE_QUESTION
IGNORE
```

Each operation follows a defined schema.

The model proposes the operation.

Application code validates it.

Only valid operations are applied to meeting state.

This gave the model enough flexibility to reason about conversation while keeping the state transition boundary predictable.

One principle from this decision became increasingly important throughout the project:

> **Models should reason about state changes; application code should own the state.**

---

# Why I Kept Speaker Clusters Separate from Participant Identity

Speaker attribution became one of the more interesting problems in YoMeets.

Initially I thought of speaker identification as one task.

The system hears someone speaking and determines who that person is.

That description hides two different problems.

The first problem is:

> **Which pieces of audio came from the same voice?**

The second problem is:

> **Who does that voice belong to?**

Those questions require different evidence.

Diarization can determine that several speech intervals belong to the same speaker and assign a label such as:

```text
S3
```

But that does not necessarily mean the system knows:

```text
S3 = Sarah
```

I therefore made the speaker cluster the stable technical identity.

Transcript segments reference:

```text
speakerClusterId = S3
```

Participant identity is a separate mapping:

```text
S3 -> Sarah
```

This turned out to have several advantages.

Meeting intelligence does not need to stop when real identity is unknown.

An action can belong to `S3`.

A decision can be attributed to `S3`.

Evidence can reference `S3`.

Later, if enough evidence appears to determine that `S3` is Sarah, the mapping can be updated without rewriting the original conversation.

This also makes corrections much safer.

If the system guesses incorrectly, correcting the participant mapping does not require changing every transcript segment individually.

---

# Why I Allow Speaker Identity to Remain Unknown

Once speaker clusters and participant identities were separated, another question appeared.

Should YoMeets always try to identify every speaker?

Initially that seemed desirable.

A meeting transcript containing `Sarah`, `John`, and `Nitin` looks much better than one containing `S1`, `S2`, and `S3`.

But some conversations simply do not provide enough information.

Two people may never address one another by name.

Several participants may have similar voices.

People may join late.

Audio quality may be poor.

Forcing the system to choose an identity in those situations creates false confidence.

I therefore designed speaker resolution so identity can remain:

```text
unknown
```

or:

```text
likely
```

until stronger evidence exists.

A conversational inference may be useful for suggesting:

```text
S3 -> likely Sarah
```

but it should not automatically become:

```text
S3 -> confirmed Sarah
```

Confirmation requires stronger evidence such as trusted participant metadata, local microphone ownership, or explicit user confirmation.

This is one of the places where abstaining is more valuable than guessing.

---

# Why I Kept Diarization Separate from Speaker Resolution

Another temptation was asking the language model to solve the entire speaker problem.

That would have simplified the conceptual pipeline.

The model could inspect the conversation and decide who everyone was.

The problem is that conversational reasoning and acoustic identity provide different information.

Diarization answers:

```text
Which voice spoke when?
```

Speaker resolution answers:

```text
Which participant is that voice likely to represent?
```

The first problem belongs primarily to audio processing.

The second can combine several signals:

- diarization,
- meeting participants,
- direct address,
- response patterns,
- local microphone ownership,
- platform metadata,
- manual correction,
- conversational reasoning.

Separating the two means improvements in one layer do not require replacing the other.

A better diarization provider can improve speaker clustering.

A better contextual resolver can improve identity.

Neither needs to redefine the transcript model.

---

# Why Actions Can Exist Before Identity Is Resolved

One subtle consequence of speaker-aware meeting intelligence is that ownership and real-world identity do not always become available at the same time.

Consider:

```text
S3:
I'll handle the API migration tomorrow.
```

The system already knows something important.

There is an action.

The owner is the person represented by `S3`.

The deadline is tomorrow.

The only missing information is the person's real identity.

Discarding the action until `S3` becomes Sarah would lose useful meeting state.

YoMeets therefore allows actions to reference speaker clusters directly.

The action can exist immediately:

```text
Owner: S3
Status: needs_identity
```

If `S3` is later resolved:

```text
S3 -> Sarah
```

the action becomes safely attributable to Sarah.

This lets conversation understanding continue without pretending the system knows more than it actually does.

---

# Why I Require Approval Before External Side Effects

Once YoMeets could detect actionable commitments, the obvious next step was automatically executing them.

That is also where the risk increases significantly.

Creating the wrong internal note is easy to correct.

Sending the wrong email is different.

Moving the wrong calendar event is different.

Creating external work because the model misunderstood a conversation is different.

I therefore made approval an explicit boundary between meeting intelligence and external execution.

The system can automatically detect:

```text
"Create a GitHub issue for this."
```

It can prepare the operation automatically.

But the external side effect remains pending until approval is provided.

The state transition becomes:

```text
Suggested
    ↓
Approved
    ↓
Executing
    ↓
Verified
```

This keeps the useful part of automation while preserving human control over consequential actions.

---

# Why I Verify Actions After Execution

Initially I assumed that a successful API response was enough to consider an action complete.

That assumption became uncomfortable once I started thinking about failure modes.

Consider:

```text
YoMeets ─────► GitHub
              Issue created
      X
Connection lost
```

From YoMeets' perspective, the request appears uncertain.

From GitHub's perspective, the issue may already exist.

If the system simply retries, it may create another issue.

The same problem can happen with calendar operations or messages.

I therefore separated:

```text
execution
```

from:

```text
verification
```

After performing an external action, YoMeets observes the resulting external state.

Only after confirming that the expected state exists does the action become verified.

This distinction made the execution system considerably more robust.

It also changed how I thought about successful automation.

The important question is not:

> "Did the API call return successfully?"

The important question is:

> **"Does the external system now contain the state we intended to create?"**

---

# Why I Made Retries Idempotent

Verification naturally led to another problem.

Retries are dangerous when external side effects are involved.

For normal computation, retrying a failed operation is usually harmless.

For external actions, it may duplicate work.

If YoMeets cannot determine whether an operation succeeded, the safest behavior is not immediately repeating it.

Instead, the system first inspects external state.

Conceptually:

```text
Unknown Outcome
      │
      ▼
Inspect External State
      │
 ┌────┴─────┐
 │          │
Found    Not Found
 │          │
 ▼          ▼
Verify     Retry
```

This inspect-first approach became the basis of recovery.

The goal is not merely making failures recoverable.

The goal is making recovery safe.

---

# Why I Kept Integrations Narrow

It was tempting to add many integrations early.

Meeting commitments can create work almost anywhere.

Slack, Jira, Linear, Notion, Teams, Salesforce, and many other systems would all be reasonable extensions.

I deliberately avoided that.

Every external integration introduces more than another API call.

It introduces:

- authentication,
- authorization,
- execution semantics,
- verification semantics,
- retry behavior,
- failure states,
- idempotency concerns.

Adding many shallow integrations would make the system look broader while making execution harder to validate.

I therefore limited the first integration surface to:

```text
GitHub
Google Calendar
Gmail
```

Together they represent three common categories of meeting follow-up:

```text
engineering work
scheduling
communication
```

This gave me enough variety to design a general execution architecture without turning integration count into the main objective.

---

# Why I Separated Live State from Long-Term Memory

Live meetings and historical meeting search initially looked like the same storage problem.

Both involve meeting information.

Their runtime requirements are very different.

During a live meeting, the system repeatedly needs:

- the latest transcript segments,
- current actions,
- current decisions,
- unresolved questions,
- speaker mappings.

Latency matters.

Historical retrieval has a different problem.

The system may need to search information spread across dozens or hundreds of previous meetings.

Semantic similarity, participant filters, dates, decision history, and evidence become more important.

I therefore separated the concept of live canonical state from searchable long-term memory.

Live meeting processing remains focused on current state.

Historical indexing remains focused on retrieval.

Information flows from the first into the second without forcing retrieval infrastructure into the latency-critical live loop.

---

# Why I Used PostgreSQL and pgvector for Meeting Memory

Meeting memory contains two different kinds of information.

Some of it is naturally structured.

For example:

```text
speaker = Sarah
meeting date = August 27
action status = open
deadline = Friday
```

Other information is semantic.

A user may ask:

> "Why did we move away from Redis?"

even though nobody used those exact words in the meeting.

A relational database handles the first category extremely well.

Vector retrieval helps with the second.

PostgreSQL with pgvector allows both forms of information to remain close together.

Structured metadata can remain relational.

Semantic representations can be indexed for similarity retrieval.

This also avoids introducing a separate vector database before the system actually needs one.

The architecture can therefore combine:

```text
structured filtering
+
semantic retrieval
+
temporal meeting state
```

rather than treating vector similarity as the entire memory system.

---

# Why I Do Not Treat pgvector as the Memory System

One distinction became increasingly important while building retrieval.

A vector database does not understand a meeting.

It retrieves information that appears semantically relevant.

That is useful, but it is not enough.

Suppose one meeting contains:

```text
"We're going with Redis."
```

and a later meeting contains:

```text
"We're replacing Redis with PostgreSQL."
```

Both statements may be semantically relevant to a question about the database decision.

Only one represents the current decision.

That means meeting memory also needs structured and temporal state.

Vector retrieval provides evidence.

The meeting model determines relationships such as:

```text
current
historical
superseded
resolved
open
```

Keeping those responsibilities separate prevents retrieval infrastructure from becoming responsible for organizational truth.

---

# Why Ask YoMeets Retrieves Before Generating

Once historical meeting memory existed, it would have been possible to create a chatbot by simply sending large portions of meeting history to a language model.

I did not want that architecture.

The amount of historical information grows continuously.

Most of it is irrelevant to any individual question.

Ask YoMeets therefore retrieves evidence first.

The general flow is:

```text
Question
   ↓
Retrieval
   ↓
Relevant Meeting Evidence
   ↓
Language Model
   ↓
Grounded Answer
```

This has two advantages.

The model receives much less irrelevant context.

More importantly, answers remain connected to actual meeting evidence.

The goal is not simply producing a plausible answer.

The goal is producing an answer that can be traced back to what the team actually discussed.

---

# Why I Preserve Evidence with Meeting State

Structured extraction creates another risk.

Once a statement becomes an action or decision, it can begin to look like an independent fact.

It is not.

It is an interpretation of something that happened in the conversation.

I therefore wanted important meeting objects to retain evidence pointing back to their source transcript.

An action can contain:

```text
meeting
speaker
timestamp
transcript segment
```

alongside its structured representation.

This allows the user to inspect why YoMeets believes an action or decision exists.

It also makes debugging significantly easier.

If extraction is wrong, I can inspect the exact conversation that produced the state rather than only looking at the model output.

That became especially valuable when evaluating speaker attribution and action ownership.

---

# Why I Designed Failure Isolation into the Pipeline

A real-time meeting system contains several external dependencies.

Speech recognition may fail.

Diarization may fail.

The model provider may become temporarily unavailable.

An integration API may reject a request.

The database may experience a temporary problem.

I did not want one failure to destroy the entire meeting session.

For example, if the model becomes unavailable, transcription should continue.

If GitHub fails, meeting memory should continue.

If speaker identity cannot be resolved, the transcript should still remain useful.

This led to separating the runtime into failure boundaries.

Conceptually:

```text
Capture
   ↓
Transcription
   ↓
Meeting Intelligence
   ↓
Memory
   ↓
Execution
```

Each stage can preserve enough state for later recovery.

This made the system more complex than a single synchronous pipeline, but it also made failures much easier to reason about.

---

# Why I Built Deterministic Evaluation Before Real-World Evaluation

AI systems are difficult to debug when every layer is nondeterministic.

If a test fails, the problem could come from:

- model extraction,
- speaker attribution,
- planning,
- approval,
- integration behavior,
- verification,
- recovery.

Testing all of those simultaneously makes failures difficult to isolate.

I therefore built deterministic evaluation paths first.

Scripted meeting transcripts and controlled external systems allow specific behaviors to be tested repeatedly.

That is particularly useful for:

- approval handling,
- duplicate-side-effect prevention,
- verification,
- recovery,
- state transitions.

Deterministic tests do not measure real model quality.

They are not a replacement for real meeting evaluation.

Their purpose is proving that the surrounding software behaves correctly when given known inputs.

Real-world evaluation can then measure the probabilistic parts independently.

That separation made the evaluation strategy much clearer.

---

# Engineering Challenges

The most difficult problems in YoMeets were not individual API integrations or prompts.

They were boundaries.

Where should conversational reasoning stop?

Where should deterministic software begin?

When should speaker identity be trusted?

What information belongs in live state?

What belongs in long-term memory?

When is an external action safe to retry?

These questions repeatedly shaped the architecture.

One principle became especially useful:

> **Uncertainty should remain visible instead of being converted into false certainty.**

If speaker identity is unknown, preserve it as unknown.

If an external operation has an uncertain outcome, inspect it before retrying.

If retrieved meeting evidence does not support an answer, the system should not invent one.

Another recurring challenge was resisting the temptation to solve every problem with the language model.

Models are extremely useful for interpreting conversation.

They are much less appropriate for responsibilities that deterministic software can perform reliably.

Validation, state transitions, idempotency, persistence, approval, and external verification therefore remain application responsibilities.

That division became one of the defining engineering principles of the project.

---

# Lessons Learned

Looking back, the most valuable parts of YoMeets are not individual prompts or integrations.

They are the boundaries that allow probabilistic AI components to operate inside a predictable software system.

Several lessons became clear throughout development.

- Language models are most useful when their responsibility is narrow and structured.
- Probabilistic understanding and deterministic execution should remain separate.
- Speaker diarization and speaker identity are different problems.
- Unknown information should remain unknown until enough evidence exists.
- Structured state is more useful than repeatedly reconstructing truth from raw transcripts.
- External side effects require verification, not only execution.
- Safe recovery requires understanding whether an operation already happened.
- Vector retrieval is one part of memory, not the entire memory system.
- Evidence and provenance are essential when AI-generated state influences real work.
- Deterministic evaluation makes probabilistic systems considerably easier to debug.

Most of these lessons emerged only after the individual components began interacting.

The difficult part was rarely making one component work.

The difficult part was deciding how much responsibility that component should have.

---

# Future Directions

There are several areas where I would like to continue improving YoMeets.

Future work includes:

- stronger real-time speaker diarization,
- contextual speaker resolution using additional meeting evidence,
- richer temporal decision tracking,
- improved semantic embeddings,
- hybrid structured and semantic retrieval,
- larger real-world meeting evaluations,
- better failure recovery across external integrations,
- additional meeting platforms,
- team-level organizational memory,
- additional integrations where verification semantics can remain reliable.

The encouraging part is that most of these improvements do not require changing the central architectural boundaries.

Better speech recognition can replace the current provider.

Better diarization can improve speaker clusters.

Better retrieval can improve Ask YoMeets.

Additional integrations can extend execution.

The responsibilities of the Meeting Engine, Task Engine, Agent Core, and memory layer can remain stable.

---

# Closing Thoughts

When I started building YoMeets, I thought the defining part of the project would be using AI to understand meetings.

That became only one part of the problem.

The more interesting challenge was building a system around that intelligence that could remember information over time and safely interact with the outside world.

Meeting conversations are uncertain.

External actions should not be.

That difference shaped almost every major architectural decision in the project.

Separating speaker clusters from identity allows the system to operate without forcing guesses.

Separating transcripts from structured state allows meetings to evolve over time.

Separating reasoning from execution prevents model interpretation from directly becoming a side effect.

Separating execution from verification makes external automation safer to recover.

Separating live state from long-term memory allows both workloads to evolve independently.

If I were starting YoMeets again today, I would certainly change individual implementations as the available models and providers continue improving.

I would not fundamentally change those boundaries.

Ultimately, YoMeets taught me that building useful AI software is not only about making the model more capable.

It is about deciding **where the model should have authority, where deterministic software should take over, and how uncertainty should move through the system without becoming an unsafe action.**