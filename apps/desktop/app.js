const api = "http://127.0.0.1:47821";

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

  container.innerHTML = actions.map((action) => `
    <article class="item ${actionStatusClass(action.status)}">
      <div>
        <p class="label">${action.status.replace(/_/g, " ")}</p>
        <h3>${action.description}</h3>
        <p>${action.deadline ? `Deadline ${action.deadline}` : "No deadline"} - Evidence ready</p>
      </div>
      <div class="buttons">
        <button data-clip="${action.id}">Play</button>
        <button>${action.status === "needs_identity" ? "Confirm" : "Approve"}</button>
      </div>
    </article>
  `).join("");
}

async function loadLatestMeeting() {
  try {
    const response = await fetch(`${api}/v1/meetings/latest`);

    if (!response.ok) {
      throw new Error(`Local API returned ${response.status}`);
    }

    const state = await response.json();
    const openQuestions = state.questions.filter((question) => question.status === "open");

    text("[data-api-status]", "Local API connected");
    text("[data-meeting-title]", state.meeting?.title ?? "Latest Meeting");
    text("[data-action-count]", String(state.actions.length));
    text("[data-decision-count]", String(state.decisions.length));
    text("[data-question-count]", String(openQuestions.length));
    renderTranscript(state.transcriptSegments);
    renderActions(state.actions);
  } catch (_error) {
    text("[data-api-status]", "Local API offline");
  }
}

loadLatestMeeting();
setInterval(loadLatestMeeting, 3000);
