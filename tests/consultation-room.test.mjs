import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const HTML = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);

test("global messages can be dismissed with a close button", () => {
  const block = APP.match(/function setAppMessage\(message, tone\) \{([\s\S]*?)\n  \}/);
  assert.ok(block, "setAppMessage was not found");
  assert.match(block[1], /aria-label", "Dismiss message"/);
  assert.match(block[1], /addEventListener\("click", \(\) => setAppMessage\(""\)\)/);
  assert.match(HTML, /id="app-session-warning"/);
});

test("multi-tab notice no longer tells users to use Incognito", () => {
  assert.doesNotMatch(APP, /Incognito/i);
  assert.doesNotMatch(APP, /session cookie was replaced/i);
});

test("chat errors are dismissible and offer a retry", () => {
  const block = APP.match(/function showChatNotice\(message, actions\) \{([\s\S]*?)\n  \}/);
  assert.ok(block, "showChatNotice was not found");
  assert.match(block[1], /aria-label", "Dismiss message"/);
  assert.match(block[1], /card\.remove\(\)/);
  assert.match(APP, /chatActionButton\("Retry"/);
});

test("a locked consultation room refreshes server status once before failing", () => {
  assert.match(APP, /async function refreshConsultationStatus/);
  assert.match(APP, /MC\.myAppointment\(appointmentId\)/);
  assert.match(APP, /MC\.doctorAppointments\(\{\}\)/);
  assert.match(APP, /locked && !settings\.retried/);
  assert.match(APP, /return loadChatHistory\(appointmentId, \{ retried: true \}\)/);
});

test("both roles have a visible control to open or refresh the room", () => {
  assert.match(APP, /id = "consult-room-control"/);
  assert.match(APP, /chatActionButton\("Start consultation"/);
  assert.match(APP, /chatActionButton\("Refresh consultation status"/);
  assert.match(APP, /payload\.status === "IN_CONSULTATION"/);
});

test("browser cache is busted after asset changes", () => {
  assert.match(HTML, /mediclinic-app(?:\.min)?\.js\?v=20261123d/);
  assert.match(HTML, /mediclinic-api\.js\?v=20261123d/);
});
