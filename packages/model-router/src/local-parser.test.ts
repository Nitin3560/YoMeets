import assert from "node:assert/strict";
import { LocalHeuristicModelProvider } from "./local-parser.js";

const provider = new LocalHeuristicModelProvider();
const response = await provider.complete({
  system: "Parse",
  user: "Raw task: Find John Smith at Google and send a connection request with 'Hello John.'"
});
const parsed = JSON.parse(response.text);

assert.equal(parsed.intent, "send_connection_request");
assert.equal(parsed.action.type, "connect");
assert.equal(parsed.action.message, "Hello John.");
assert.equal(parsed.targets[0].name, "John Smith");
assert.equal(parsed.targets[0].company, "Google");

const search = JSON.parse((await provider.complete({ system: "Parse", user: "Raw task: Search for Sarah Patel" })).text);

assert.equal(search.intent, "search_profile");
assert.equal(search.action.type, "open_profile");
assert.equal(search.targets[0].name, "Sarah Patel");
