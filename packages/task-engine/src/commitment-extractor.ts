import type { CommitmentType, MeetingCommitment } from "./commitment-planner.js";

export type CommitmentExtractionResult = {
  commitments: MeetingCommitment[];
};

function sentenceParts(transcript: string) {
  return transcript
    .split(/[.\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function makeCommitment(
  id: string,
  type: CommitmentType,
  summary: string,
  fields: Omit<MeetingCommitment, "id" | "summary" | "type"> = {}
): MeetingCommitment {
  return {
    ...fields,
    id,
    summary: clean(summary),
    type
  };
}

export function extractMeetingCommitments(transcript: string): CommitmentExtractionResult {
  const commitments: MeetingCommitment[] = [];

  for (const sentence of sentenceParts(transcript)) {
    const prefix = `commitment_${commitments.length + 1}`;
    const investigation = sentence.match(/^(.+?) will investigate (.+?)(?: by (.+))?$/i);

    if (investigation) {
      const owner = clean(investigation[1] ?? "");
      const subject = clean(investigation[2] ?? "");
      const due = investigation[3] ? clean(investigation[3]) : undefined;

      commitments.push(
        makeCommitment(prefix, "investigation", `${owner} will investigate ${subject}`, {
          due,
          owner,
          subject
        })
      );
      continue;
    }

    const schedule = sentence.match(/^(.+?) will move (.+?) to (.+)$/i);

    if (schedule) {
      const owner = clean(schedule[1] ?? "");
      const subject = clean(schedule[2] ?? "");
      const due = clean(schedule[3] ?? "");

      commitments.push(
        makeCommitment(prefix, "schedule_change", `${owner} will move ${subject} to ${due}`, {
          due,
          owner,
          subject
        })
      );
      continue;
    }

    const message = sentence.match(/^(.+?) will send (.+?) to (.+?)(?: by (.+))?$/i);

    if (message) {
      const owner = clean(message[1] ?? "");
      const subject = clean(message[2] ?? "");
      const recipient = clean(message[3] ?? "");
      const due = message[4] ? clean(message[4]) : undefined;

      commitments.push(
        makeCommitment(prefix, "follow_up_message", `${owner} will send ${subject} to ${recipient}`, {
          due,
          owner,
          recipient,
          subject
        })
      );
      continue;
    }

    const decision = sentence.match(/^(?:decision:|we decided to) (.+)$/i);

    if (decision) {
      const summary = clean(decision[1] ?? "");

      commitments.push(makeCommitment(prefix, "decision_record", summary));
    }
  }

  return { commitments };
}
