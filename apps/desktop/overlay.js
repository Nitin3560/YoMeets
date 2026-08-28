const api = "http://127.0.0.1:47821";

async function refresh() {
  const button = document.querySelector(".overlay-button");

  try {
    const response = await fetch(`${api}/health`);
    button?.classList.toggle("offline", !response.ok);
  } catch (_error) {
    button?.classList.add("offline");
  }
}

document.querySelector(".overlay-button")?.addEventListener("click", () => {
  window.location.href = "./index.html";
});

refresh();
setInterval(refresh, 3000);
