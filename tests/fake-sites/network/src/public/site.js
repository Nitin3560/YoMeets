import { people } from "./people.js";

const form = document.querySelector("form");
const results = document.querySelector("#results");

function normalize(value) {
  return value.trim().toLowerCase();
}

function personMatches(person, filters) {
  const company = normalize(filters.get("company") ?? "");
  const school = normalize(filters.get("school") ?? "");

  return (
    (!company || person.company.toLowerCase().includes(company)) &&
    (!school || person.school.toLowerCase().includes(school))
  );
}

function renderResults(matches) {
  if (!results) {
    return;
  }

  if (matches.length === 0) {
    results.innerHTML = "<p>No people found.</p>";
    return;
  }

  results.innerHTML = `
    <ul class="results-list">
      ${matches.map((person) => `
        <li>
          <a href="/profile.html?id=${person.id}">${person.name}</a>
          <span>${person.headline}</span>
          <small>${person.company} / ${person.school} / ${person.status}</small>
        </li>
      `).join("")}
    </ul>
  `;
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  const filters = new FormData(form);
  renderResults(people.filter((person) => personMatches(person, filters)));
});
