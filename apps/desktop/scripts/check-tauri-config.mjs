import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
const windows = config.app?.windows ?? [];
const main = windows.find((window) => window.label === "main");
const overlay = windows.find((window) => window.label === "overlay");

if (!main || main.url !== "index.html") {
  throw new Error("main Tauri window must load index.html");
}

if (!overlay || overlay.url !== "overlay.html" || overlay.alwaysOnTop !== true || overlay.decorations !== false) {
  throw new Error("overlay Tauri window must be always-on-top and undecorated");
}

console.log("Tauri desktop config ok");
