# Evaluation and Benchmarks

YoMeets combines several systems with very different failure modes.

A meeting assistant can transcribe correctly but assign the wrong speaker.

It can identify the correct action but assign the wrong owner.

It can understand the commitment correctly but fail while executing it.

It can retrieve a relevant meeting but generate an unsupported answer.

For that reason, YoMeets evaluates each stage independently rather than relying on a single end-to-end accuracy number.

---

# Evaluation Pipeline

```text
Meeting
   |
   v
Transcription
   |
   v
Speaker Attribution
   |
   v
Meeting Intelligence
   |
   v
Memory Retrieval
   |
   v
Action Execution
   |
   v
Verification
```

Each layer has its own measurements.

---

# Meeting Intelligence

The Meeting Engine is evaluated on its ability to identify structured information from conversation.

Important measurements include:

```text
Action Precision / Recall
Decision Precision / Recall
Owner Attribution Accuracy
Deadline Extraction Accuracy
Question Detection Accuracy
```

Evaluation meetings contain known expected actions, decisions, owners, and deadlines.

The extracted state can then be compared against those labels.

---

# Speaker Attribution

Speaker evaluation measures whether transcript segments are assigned to the correct speaker and whether anonymous speaker clusters are resolved correctly.

Useful measurements include:

```text
Speaker Attribution Accuracy
Identity Resolution Accuracy
Unknown / Abstention Accuracy
Diarization Error Rate
```

The system should not receive credit for guessing a participant when the available evidence does not support that identity.

Correctly remaining uncertain is part of the evaluation.

---

# Live Performance

Live meeting intelligence also needs to respond quickly enough to remain useful.

Important measurements include:

```text
Action Detection Latency
Decision Detection Latency
p50 Processing Latency
p95 Processing Latency
Model Context Size
```

These measurements help evaluate the tradeoff between larger conversation windows and faster live responses.

---

# Meeting Memory

Ask YoMeets is evaluated separately from live extraction.

Useful retrieval measurements include:

```text
Recall@K
Citation Accuracy
Retrieval Latency
Temporal Accuracy
Grounded Answer Accuracy
```

A benchmark question includes expected supporting meeting evidence.

This allows retrieval quality to be measured before judging the final generated answer.

---

# Execution and Verification

External execution is evaluated on whether approved operations produce the intended state exactly once.

Important measurements include:

```text
Execution Success Rate
Verification Success Rate
Duplicate Side-Effect Rate
Recovery Success Rate
```

Tests can inject failures such as:

```text
API timeout
authentication failure
verification failure
network interruption
crash after execution
```

The important result is the final external state, not simply whether the first API request returned successfully.

---

# Deterministic Evaluation

YoMeets includes deterministic evaluation paths using controlled transcripts, scripted model outputs, and predictable external systems.

These tests are useful for validating:

```text
state transitions
approval handling
duplicate prevention
execution
verification
recovery
```

Deterministic evaluation is intentionally separated from model-quality evaluation.

A scripted model producing the expected extraction does not demonstrate real-world LLM extraction accuracy.

---

# Real-World Evaluation

Real meeting evaluation measures the probabilistic parts of the system using actual model outputs and realistic conversations.

This includes:

```text
STT quality
speaker attribution
action extraction
decision extraction
owner assignment
retrieval quality
live latency
```

Results from deterministic tests and real-world evaluations should always be reported separately.

This prevents infrastructure correctness from being confused with AI accuracy.

---

# Benchmark Philosophy

The goal of evaluation is not to produce one impressive number.

It is to answer a more useful question:

> **When YoMeets fails, which part of the system failed?**

Separating transcription, speaker attribution, meeting intelligence, retrieval, execution, and verification makes those failures measurable.

It also makes improvements easier to validate.

---

# Closing Remarks

YoMeets combines probabilistic AI with deterministic software.

Those two parts should not be evaluated in the same way.

Model quality is measured through extraction, attribution, retrieval, and grounded-answer accuracy.

Software reliability is measured through execution, verification, idempotency, and recovery.

Keeping those evaluations separate makes benchmark results easier to understand and much harder to overstate.
