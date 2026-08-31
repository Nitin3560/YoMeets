# Quickstart

This guide covers the basic local setup for YoMeets.

YoMeets is organized as a pnpm monorepo with separate packages for meeting intelligence, audio processing, execution, integrations, model routing, and the local application.

---

# Prerequisites

Install:

```text
Node.js
pnpm
Docker
PostgreSQL with pgvector
```

You will also need credentials for the providers you want to use.

For the current live AI path:

```text
Gemini
Deepgram
```

External actions additionally require credentials for the corresponding integrations.

---

# Clone the Repository

```bash
git clone https://github.com/Nitin3560/YoMeets.git
cd YoMeets
```

Install dependencies:

```bash
pnpm install
```

---

# Environment Configuration

Create a local environment file from the example configuration.

```bash
cp .env.example .env.local
```

Configure the services you want to use.

Example:

```env
YOMEETS_POSTGRES_URL=postgres://USER:PASSWORD@HOST:PORT/DB

GEMINI_API_KEY=YOUR_KEY
GEMINI_MODEL=YOUR_MODEL

YOMEETS_STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=YOUR_KEY
```

Never commit `.env.local` or provider credentials to the repository.

---

# PostgreSQL and pgvector

YoMeets uses PostgreSQL and pgvector for persistent meeting memory and semantic retrieval.

Make sure PostgreSQL is running and pgvector is available.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The meeting-memory migration can then initialize the required storage.

---

# Verify the Environment

YoMeets includes a local readiness check.

```bash
pnpm yomeets doctor
```

Use this before running the live pipeline to identify missing configuration.

---

# Build

Build the complete workspace:

```bash
pnpm build
```

Run tests:

```bash
pnpm test
```

Run type checking:

```bash
pnpm typecheck
```

---

# Live Meeting Flow

The intended runtime pipeline is:

```text
System Audio + Microphone
          |
          v
       PCM Audio
          |
     +----+----+
     v         v
    STT    Diarization
     +----+----+
          v
Speaker-Aware Transcript
          |
          v
Meeting Intelligence
          |
          v
Actions / Decisions / Questions
```

The live meeting state can then be surfaced through the local application.

---

# Meeting Actions

Approved actions follow the normal execution path:

```text
Meeting Action
      |
      v
Task Engine
      |
      v
Approval
      |
      v
Agent Core
      |
      v
GitHub / Calendar / Gmail
      |
      v
Verification
```

Use dry-run execution while developing or testing integrations.

---

# Ask YoMeets

Meeting information can be indexed into the persistent memory layer.

The retrieval path is:

```text
Question
   |
   v
Meeting Memory
   |
   v
PostgreSQL + pgvector
   |
   v
Relevant Evidence
   |
   v
Gemini
   |
   v
Grounded Answer
```

This allows questions to be answered using information preserved from previous meetings.

---

# Development Status

Some parts of the local product may still require provider or platform-specific setup.

In particular, real system/microphone audio capture, production diarization, and OAuth configuration depend on the environment in which YoMeets is running.

Deterministic demos and dry-run execution are useful for testing the architecture without performing real external side effects.

---

# Development Commands

Common commands:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm yomeets doctor
```

Additional smoke tests and evaluation commands are documented alongside their corresponding packages and benchmark documentation.

---

# Next Steps

After the local environment is working, the easiest way to understand the system is to follow the two main pipelines:

```text
Live Meeting
-> Transcript
-> Meeting Intelligence
-> Actions / Decisions / Questions
-> Approval
-> Execution
-> Verification
```

and:

```text
Meeting History
-> Persistent Memory
-> Retrieval
-> Ask YoMeets
```

Together they represent the core of YoMeets: understanding meetings while they happen and making that information useful afterward.
