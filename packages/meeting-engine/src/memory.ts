import { GeminiEmbeddingProvider, type EmbeddingProvider, type ModelProvider } from "@yomeets/model-router";
import postgres, { type Sql } from "postgres";
import {
  CanonicalMeetingActionRepository,
  MeetingDecisionRepository,
  MeetingQuestionRepository,
  MeetingRepository,
  TranscriptSegmentRepository,
  type Storage
} from "@yomeets/storage";
import type { Evidence } from "./types.js";

export type MeetingMemoryKind = "action" | "decision" | "question" | "transcript";

export type MeetingMemoryRecord = {
  id: string;
  kind: MeetingMemoryKind;
  meetingId: string;
  meetingCreatedAt?: string;
  text: string;
  evidence: Evidence[];
};

export type AskYoMeetsResult = {
  answer: string;
  citations: MeetingMemoryRecord[];
};

export type MeetingMemoryIndex = {
  search(query: string, limit?: number): Promise<MeetingMemoryRecord[]>;
  upsert(records: MeetingMemoryRecord[]): Promise<void>;
};

export class PostgresMemoryNotConfiguredError extends Error {
  constructor() {
    super("Postgres/pgvector memory is not configured");
    this.name = "PostgresMemoryNotConfiguredError";
  }
}

export class LocalMeetingMemoryIndex implements MeetingMemoryIndex {
  constructor(private readonly records: MeetingMemoryRecord[]) {}

  async search(query: string, limit = 5): Promise<MeetingMemoryRecord[]> {
    return searchMeetingMemory(query, this.records, limit);
  }

  async upsert(records: MeetingMemoryRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

class HashEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 768;

  async embed(text: string): Promise<number[]> {
    return embedText(text, this.dimensions);
  }
}

function defaultEmbeddingProvider(): EmbeddingProvider {
  return process.env.GEMINI_API_KEY ? new GeminiEmbeddingProvider() : new HashEmbeddingProvider();
}

export class PostgresPgvectorMemoryIndex implements MeetingMemoryIndex {
  private readonly sql?: Sql;

  constructor(
    private readonly connectionString = process.env.YOMEETS_POSTGRES_URL,
    private readonly embeddings = defaultEmbeddingProvider()
  ) {
    this.sql = connectionString ? postgres(connectionString, { max: 1, onnotice: () => undefined }) : undefined;
  }

  async search(query: string, limit = 5): Promise<MeetingMemoryRecord[]> {
    const sql = this.requireSql();
    const rows = await sql.begin(async (transaction) => {
      await transaction`set local enable_indexscan = off`;
      return transaction<Array<{
        evidence: Evidence[];
        id: string;
        kind: MeetingMemoryKind;
        meeting_id: string;
        text: string;
      }>>`
        select id, meeting_id, kind, text, evidence
        from yomeets_memory_embeddings
        order by embedding <=> ${vectorLiteral(await this.embeddings.embed(query))}::vector
        limit ${limit}
      `;
    });

    return rows.map((row) => ({
      evidence: row.evidence,
      id: row.id,
      kind: row.kind,
      meetingId: row.meeting_id,
      text: row.text
    }));
  }

  async upsert(records: MeetingMemoryRecord[]): Promise<void> {
    const sql = this.requireSql();

    await this.migrate();

    for (const record of records) {
      await sql`
        insert into yomeets_memory_embeddings (id, meeting_id, kind, text, evidence, embedding)
        values (
          ${record.id},
          ${record.meetingId},
          ${record.kind},
          ${record.text},
          ${sql.json(record.evidence)},
          ${vectorLiteral(await this.embeddings.embed(record.text))}::vector
        )
        on conflict (id) do update set
          meeting_id = excluded.meeting_id,
          kind = excluded.kind,
          text = excluded.text,
          evidence = excluded.evidence,
          embedding = excluded.embedding,
          updated_at = now()
      `;
    }
  }

  async migrate(): Promise<void> {
    const sql = this.requireSql();

    await sql`create extension if not exists vector`;
    await sql`
      create table if not exists yomeets_memory (
        id text primary key,
        meeting_id text not null,
        kind text not null,
        text text not null,
        evidence jsonb not null,
        embedding vector(32) not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql`
      create index if not exists yomeets_memory_embedding_idx
      on yomeets_memory
      using ivfflat (embedding vector_cosine_ops)
      with (lists = 8)
    `;
    await sql`
      create table if not exists yomeets_memory_embeddings (
        id text primary key,
        meeting_id text not null,
        kind text not null,
        text text not null,
        evidence jsonb not null,
        embedding vector(768) not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql`
      create index if not exists yomeets_memory_embeddings_idx
      on yomeets_memory_embeddings
      using ivfflat (embedding vector_cosine_ops)
      with (lists = 16)
    `;
  }

  async close(): Promise<void> {
    await this.sql?.end();
  }

  private requireSql() {
    if (!this.sql) {
      throw new PostgresMemoryNotConfiguredError();
    }

    return this.sql;
  }
}

function embedText(text: string, dimensions = 768) {
  const vector = new Array(dimensions).fill(0) as number[];
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

  for (const token of tokens) {
    let hash = 0;

    for (let index = 0; index < token.length; index += 1) {
      hash = ((hash << 5) - hash + token.charCodeAt(index)) | 0;
    }

    vector[Math.abs(hash) % vector.length] += 1;
  }

  const length = Math.hypot(...vector) || 1;

  return vector.map((value) => Number((value / length).toFixed(6)));
}

function vectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function tokenize(text: string) {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function evidenceFromJson(value: string) {
  return JSON.parse(value) as Evidence[];
}

function wantsRecent(query: string) {
  return /\b(latest|recent|current|now|currently|last|previous)\b/i.test(query);
}

function scoreRecord(query: string, queryTokens: Set<string>, record: MeetingMemoryRecord, newestMeetingAt?: number) {
  const recordTokens = tokenize(record.text);
  let score = 0;

  for (const token of queryTokens) {
    if (recordTokens.has(token)) {
      score += 1;
    }
  }

  if (record.kind === "decision") {
    score += 0.2;
  }

  if (record.kind === "action" && /\b(responsible|todo|task|action|due|owner|mine|my)\b/i.test(query)) {
    score += 0.5;
  }

  if (wantsRecent(query) && record.meetingCreatedAt) {
    const createdAt = Date.parse(record.meetingCreatedAt);

    if (createdAt === newestMeetingAt) {
      score += 0.75;
    }
  }

  return score;
}

export function loadMeetingMemory(storage: Storage, meetingId?: string): MeetingMemoryRecord[] {
  const meetingRows = new MeetingRepository(storage).listAll();
  const meetingById = new Map(meetingRows.map((meeting) => [meeting.id, meeting]));
  const meetingIds = meetingId ? [meetingId] : meetingRows.map((meeting) => meeting.id);
  const records: MeetingMemoryRecord[] = [];

  for (const id of meetingIds) {
    const meetingCreatedAt = meetingById.get(id)?.createdAt;

    records.push(...new CanonicalMeetingActionRepository(storage).listForMeeting(id).map((action) => ({
      evidence: evidenceFromJson(action.evidenceJson),
      id: action.id,
      kind: "action" as const,
      meetingId: id,
      meetingCreatedAt,
      text: `${action.description} ${action.deadline ?? ""} ${action.status}`
    })));
    records.push(...new MeetingDecisionRepository(storage).listForMeeting(id).map((decision) => ({
      evidence: evidenceFromJson(decision.evidenceJson),
      id: decision.id,
      kind: "decision" as const,
      meetingId: id,
      meetingCreatedAt,
      text: decision.text
    })));
    records.push(...new MeetingQuestionRepository(storage).listForMeeting(id).map((question) => ({
      evidence: evidenceFromJson(question.evidenceJson),
      id: question.id,
      kind: "question" as const,
      meetingId: id,
      meetingCreatedAt,
      text: `${question.text} ${question.status}`
    })));
    records.push(...new TranscriptSegmentRepository(storage).listForMeeting(id).map((segment) => ({
      evidence: [
        {
          clipEndMs: segment.endMs,
          clipStartMs: segment.startMs,
          segmentId: segment.id
        }
      ],
      id: segment.id,
      kind: "transcript" as const,
      meetingId: id,
      meetingCreatedAt,
      text: segment.text
    })));
  }

  return records;
}

export function searchMeetingMemory(query: string, records: MeetingMemoryRecord[], limit = 5) {
  const queryTokens = tokenize(query);
  const newestMeetingAt = Math.max(...records.map((record) => record.meetingCreatedAt ? Date.parse(record.meetingCreatedAt) : 0));

  return records
    .map((record) => ({
      record,
      score: scoreRecord(query, queryTokens, record, newestMeetingAt)
    }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((item) => item.record);
}

export async function askYoMeets(
  storage: Storage,
  input: {
    meetingId?: string;
    provider: ModelProvider;
    query: string;
  }
): Promise<AskYoMeetsResult> {
  const citations = searchMeetingMemory(input.query, loadMeetingMemory(storage, input.meetingId));
  const response = await input.provider.complete({
    system: [
      "Answer questions about meeting memory.",
      "Use only the provided records.",
      "If the records are insufficient, say what is missing.",
      "Mention citation ids inline using their record ids."
    ].join("\n"),
    user: JSON.stringify({
      query: input.query,
      records: citations
    })
  });

  return {
    answer: response.text.trim(),
    citations
  };
}
