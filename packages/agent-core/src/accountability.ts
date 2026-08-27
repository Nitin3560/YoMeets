import { MeetingCommitmentRepository, type Storage } from "@yomeets/storage";
import type { MeetingCommitment } from "@yomeets/task-engine";

export type OutstandingCommitment = {
  commitmentId: string;
  meetingId: string;
  commitment: MeetingCommitment;
  storedStatus: string;
  externalStatus?: string;
};

export type CommitmentStatusChecker = (commitment: OutstandingCommitment) => Promise<string>;

export async function loadOutstandingCommitments(
  storage: Storage,
  checkStatus?: CommitmentStatusChecker
): Promise<OutstandingCommitment[]> {
  const repository = new MeetingCommitmentRepository(storage);
  const rows = repository.listOpen();
  const outstanding: OutstandingCommitment[] = [];

  for (const row of rows) {
    const item = {
      commitment: JSON.parse(row.commitmentJson) as MeetingCommitment,
      commitmentId: row.id,
      externalStatus: row.externalStatus ?? undefined,
      meetingId: row.meetingId,
      storedStatus: row.status
    };

    if (checkStatus) {
      const externalStatus = await checkStatus(item);
      const storedStatus = externalStatus === "closed" || externalStatus === "sent" ? "completed" : "open";
      repository.updateExternalStatus(row.id, externalStatus, storedStatus);
      outstanding.push({
        ...item,
        externalStatus,
        storedStatus
      });
    } else {
      outstanding.push(item);
    }
  }

  return outstanding;
}

export function formatOutstandingCommitments(commitments: OutstandingCommitment[]) {
  return commitments
    .filter((commitment) => commitment.storedStatus === "open")
    .map((commitment) => {
      const owner = commitment.commitment.owner ? `${commitment.commitment.owner}: ` : "";
      const due = commitment.commitment.due ? ` due ${commitment.commitment.due}` : "";

      return `${owner}${commitment.commitment.summary}${due}`;
    });
}
