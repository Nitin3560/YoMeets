import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CanonicalMeetingActionRepository,
  MeetingParticipantRepository,
  MeetingRepository,
  SpeakerClusterRepository,
  TranscriptSegmentRepository,
  openStorage,
  runMigrations
} from "@yomeets/storage";
import { ingestTranscriptSegment } from "./ingest.js";
import { confirmSpeakerIdentity, resolveSpeakerIdentities } from "./speaker-resolver.js";
import type { OwnerRef } from "./types.js";

const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-speaker-resolver-")), "test.sqlite"));

runMigrations(storage);

try {
  const meeting = new MeetingRepository(storage).create({
    title: "Identity test",
    transcript: ""
  });
  const participants = new MeetingParticipantRepository(storage);
  const sarah = participants.create({
    id: "participant_sarah",
    meetingId: meeting.id,
    name: "Sarah"
  });
  const nitin = participants.create({
    id: "participant_nitin",
    meetingId: meeting.id,
    name: "Nitin"
  });

  ingestTranscriptSegment(storage, {
    endMs: 1400,
    id: "seg_1",
    meetingId: meeting.id,
    sequence: 1,
    speakerLabel: "S1",
    startMs: 0,
    text: "Sarah, can you check the auth timeout?"
  });
  ingestTranscriptSegment(storage, {
    endMs: 3000,
    id: "seg_2",
    meetingId: meeting.id,
    sequence: 2,
    speakerLabel: "S2",
    startMs: 1500,
    text: "Yeah, I'll fix it tomorrow."
  });
  ingestTranscriptSegment(storage, {
    endMs: 4300,
    id: "seg_3",
    meetingId: meeting.id,
    sequence: 3,
    speakerLabel: "S3",
    startMs: 3100,
    text: "I can take notes from my mic."
  });

  const actions = new CanonicalMeetingActionRepository(storage);
  const action = actions.create({
    description: "Fix auth timeout",
    evidence: [],
    meetingId: meeting.id,
    ownerRef: {
      speakerClusterId: `${meeting.id}_S2`
    },
    status: "needs_identity"
  });

  const likely = resolveSpeakerIdentities(storage, {
    meetingId: meeting.id
  });
  const likelySarah = likely.find((resolution) => resolution.speakerClusterId === `${meeting.id}_S2`);
  const stillBlocked = actions.listForMeeting(meeting.id).find((item) => item.id === action.id);

  assert.equal(likelySarah?.status, "likely");
  assert.equal(likelySarah?.participantId, sarah.id);
  assert.deepEqual(likelySarah?.evidenceSegmentIds, ["seg_1", "seg_2"]);
  assert.equal(stillBlocked?.status, "needs_identity");
  assert.equal((JSON.parse(stillBlocked?.ownerRefJson ?? "{}") as OwnerRef).participantId, undefined);

  const local = resolveSpeakerIdentities(storage, {
    localMic: {
      participantId: nitin.id,
      speakerClusterId: `${meeting.id}_S3`
    },
    meetingId: meeting.id
  });
  const confirmedNitin = local.find((resolution) => resolution.speakerClusterId === `${meeting.id}_S3`);
  const thirdSegment = new TranscriptSegmentRepository(storage).listForMeeting(meeting.id).find((segment) => segment.id === "seg_3");

  assert.equal(confirmedNitin?.status, "confirmed");
  assert.equal(confirmedNitin?.reason, "local_mic");
  assert.equal(thirdSegment?.participantId, nitin.id);

  confirmSpeakerIdentity(storage, {
    meetingId: meeting.id,
    participantId: sarah.id,
    speakerClusterId: `${meeting.id}_S2`
  });

  const confirmedCluster = new SpeakerClusterRepository(storage).findById(`${meeting.id}_S2`);
  const updatedAction = actions.listForMeeting(meeting.id).find((item) => item.id === action.id);
  const ownerRef = JSON.parse(updatedAction?.ownerRefJson ?? "{}") as OwnerRef;

  assert.equal(confirmedCluster?.resolutionStatus, "confirmed");
  assert.equal(confirmedCluster?.resolvedParticipantId, sarah.id);
  assert.equal(updatedAction?.status, "open");
  assert.equal(ownerRef.participantId, sarah.id);

  const ambiguousMeeting = new MeetingRepository(storage).create({
    title: "Ambiguous names",
    transcript: ""
  });

  new MeetingParticipantRepository(storage).create({
    id: "participant_sarah_a",
    meetingId: ambiguousMeeting.id,
    name: "Sarah"
  });
  new MeetingParticipantRepository(storage).create({
    id: "participant_sarah_b",
    meetingId: ambiguousMeeting.id,
    name: "Sarah Lee"
  });
  ingestTranscriptSegment(storage, {
    endMs: 1000,
    id: "ambiguous_1",
    meetingId: ambiguousMeeting.id,
    sequence: 1,
    speakerLabel: "S1",
    startMs: 0,
    text: "Sarah, can you check the flaky test?"
  });
  ingestTranscriptSegment(storage, {
    endMs: 2200,
    id: "ambiguous_2",
    meetingId: ambiguousMeeting.id,
    sequence: 2,
    speakerLabel: "S2",
    startMs: 1100,
    text: "Sure, I got it."
  });
  ingestTranscriptSegment(storage, {
    endMs: 3300,
    id: "ambiguous_3",
    meetingId: ambiguousMeeting.id,
    sequence: 3,
    speakerLabel: "S3",
    startMs: 2300,
    text: "No, I can't take that one."
  });

  const ambiguous = resolveSpeakerIdentities(storage, {
    meetingId: ambiguousMeeting.id
  });

  assert.equal(ambiguous.find((resolution) => resolution.speakerClusterId === `${ambiguousMeeting.id}_S2`)?.status, "unknown");
  assert.equal(ambiguous.find((resolution) => resolution.speakerClusterId === `${ambiguousMeeting.id}_S3`)?.status, "unknown");
} finally {
  storage.sqlite.close();
}
