const api = "http://127.0.0.1:47821";
let currentState;
let pollingTimer;

function text(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = value;
  }
}

function time(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function speakerLabel(clusterId) {
  return clusterId.split("_").at(-1) ?? clusterId;
}

function actionStatusClass(status) {
  if (status === "needs_identity") {
    return "needs";
  }

  if (status === "completed") {
    return "done";
  }

  return "approval";
}

function renderTranscript(segments) {
  const container = document.querySelector("[data-transcript]");

  if (!container || segments.length === 0) {
    return;
  }

  container.innerHTML = segments.map((segment, index) => `
    <article class="turn ${index === segments.length - 1 ? "new" : ""}">
      <span>${speakerLabel(segment.speakerClusterId)}</span>
      <p>${segment.text}</p>
      <time>${time(segment.startMs)}</time>
    </article>
  `).join("");
}

function renderActions(actions) {
  const container = document.querySelector("[data-actions]");

  if (!container || actions.length === 0) {
    return;
  }

  container.innerHTML = actions.map((action) => {
    const ownerRef = JSON.parse(action.ownerRefJson);

    return `
    <article class="item ${actionStatusClass(action.status)}">
      <div>
        <p class="label">${action.status.replace(/_/g, " ")}</p>
        <h3>${action.description}</h3>
        <p>${action.deadline ? `Deadline ${action.deadline}` : "No deadline"} - Evidence ready</p>
      </div>
      <div class="buttons">
        <button data-action="clip" data-action-id="${action.id}">Play</button>
        <button
          data-action="${action.status === "needs_identity" ? "confirm" : "execute"}"
          data-action-id="${action.id}"
          data-speaker-cluster-id="${ownerRef.speakerClusterId}"
        >${action.status === "needs_identity" ? "Confirm" : "Approve"}</button>
      </div>
    </article>
  `;
  }).join("");
}

async function loadLatestMeeting() {
  try {
    const response = await fetch(`${api}/v1/meetings/latest`);

    if (!response.ok) {
      throw new Error(`Local API returned ${response.status}`);
    }

    renderState(await response.json(), "Local API connected");
  } catch (_error) {
    text("[data-api-status]", "Local API offline");
  }
}

function renderState(state, statusText) {
  currentState = state;
  const openQuestions = currentState.questions.filter((question) => question.status === "open");

  text("[data-api-status]", statusText);
  text("[data-meeting-title]", currentState.meeting?.title ?? "Latest Meeting");
  text("[data-action-count]", String(currentState.actions.length));
  text("[data-decision-count]", String(currentState.decisions.length));
  text("[data-question-count]", String(openQuestions.length));
  renderTranscript(currentState.transcriptSegments);
  renderActions(currentState.actions);
}

function likelyParticipantForSpeaker(speakerClusterId) {
  return currentState?.speakerClusters.find((cluster) => cluster.id === speakerClusterId)?.resolvedParticipantId;
}

function clipForAction(actionId) {
  const action = currentState?.actions.find((item) => item.id === actionId);
  const evidence = action ? JSON.parse(action.evidenceJson)[0] : undefined;

  if (!evidence) {
    return undefined;
  }

  return currentState?.clips.find((clip) => clip.segmentId === evidence.segmentId);
}

async function postJson(path, body) {
  const response = await fetch(`${api}${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button || !currentState?.meeting?.id) {
    return;
  }

  const action = button.dataset.action;
  const actionId = button.dataset.actionId;
  const speakerClusterId = button.dataset.speakerClusterId;

  try {
    if (action === "clip" && actionId) {
      const clip = clipForAction(actionId);
      const details = clip ? `${clip.audioPath ?? "audio pending"} ${time(clip.clipStartMs)}-${time(clip.clipEndMs)}` : "No clip available";

      text("[data-api-status]", details);
      return;
    }

    if (action === "confirm" && speakerClusterId) {
      await postJson(`/v1/meetings/${currentState.meeting.id}/speakers/${encodeURIComponent(speakerClusterId)}/confirm`, {
        participantId: likelyParticipantForSpeaker(speakerClusterId)
      });
      await loadLatestMeeting();
      return;
    }

    if (action === "execute") {
      await postJson(`/v1/meetings/${currentState.meeting.id}/actions/execute`, {
        approve: true,
        dryRun: true
      });
      await loadLatestMeeting();
    }
  } catch (error) {
    text("[data-api-status]", error instanceof Error ? error.message : "Action failed");
  }
});

function startPolling() {
  if (pollingTimer) {
    return;
  }

  loadLatestMeeting();
  pollingTimer = setInterval(loadLatestMeeting, 3000);
}

function startLiveStream() {
  if (!("EventSource" in window)) {
    startPolling();
    return;
  }

  const events = new EventSource(`${api}/v1/meetings/latest/events`);

  events.addEventListener("meeting_state", (event) => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = undefined;
    }

    renderState(JSON.parse(event.data), "Live API connected");
  });
  events.addEventListener("error", () => {
    events.close();
    startPolling();
  });
}

startLiveStream();
