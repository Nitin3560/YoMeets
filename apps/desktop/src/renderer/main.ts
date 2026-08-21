import App from "./App.svelte";
import { mount } from "svelte";

const target = document.getElementById("app");

if (!target) {
  throw new Error("App mount target was not found");
}

mount(App, {
  target
});
