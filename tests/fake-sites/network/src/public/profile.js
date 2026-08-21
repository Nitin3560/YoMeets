import { people } from "./people.js";

const params = new URLSearchParams(window.location.search);
const person = people.find((candidate) => candidate.id === params.get("id"));
const profile = document.querySelector("#profile");
const dialog = document.querySelector("#note-dialog");
const noteForm = document.querySelector("#note-form");

function statusKey(personId) {
  return `network:${personId}:status`;
}

function getStatus(personId, fallback) {
  return localStorage.getItem(statusKey(personId)) ?? fallback;
}

function setStatus(personId, status) {
  localStorage.setItem(statusKey(personId), status);
}

function renderProfile(status) {
  if (!profile || !person) {
    return;
  }

  profile.innerHTML = `
    <h1>${person.name}</h1>
    <p>${person.headline}</p>
    <dl>
      <dt>Company</dt>
      <dd>${person.company}</dd>
      <dt>School</dt>
      <dd>${person.school}</dd>
      <dt>Status</dt>
      <dd data-status>${status}</dd>
    </dl>
    <button type="button" id="connect" ${status !== "None" ? "disabled" : ""}>Connect</button>
    <p role="status" id="profile-status"></p>
  `;

  document.querySelector("#connect")?.addEventListener("click", () => {
    dialog?.showModal();
  });
}

if (!person) {
  if (profile) {
    profile.innerHTML = "<h1>Profile not found</h1>";
  }
} else {
  renderProfile(getStatus(person.id, person.status));
}

noteForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!person) {
    return;
  }

  const formData = new FormData(noteForm);
  const statusMessage = document.querySelector("#profile-status");

  if (formData.get("forceError") === "on") {
    if (statusMessage) {
      statusMessage.textContent = "Send failed. Please try again.";
    }
    dialog?.close();
    return;
  }

  setStatus(person.id, "Pending");
  dialog?.close();
  renderProfile("Pending");

  window.setTimeout(() => {
    setStatus(person.id, "Sent");
    renderProfile("Sent");
  }, 300);
});
