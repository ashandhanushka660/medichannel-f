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
  assert.match(
    APP,
    /return loadChatHistory\(appointmentId, \{\s*retried: true,\s*force: true,\s*\}\);/
  );
});

test("locked and completed rooms never show the generic consultation error", () => {
  assert.match(APP, /function renderConsultWaiting\(appointment\)/);
  assert.match(APP, /!\["IN_CONSULTATION", "COMPLETED"\]\.includes\(current\.status\)/);
  assert.match(APP, /renderConsultWaiting\(current \|\| \{ appointmentId \}\)/);
  assert.doesNotMatch(
    APP,
    /message \+ " The doctor opens the room by starting the consultation/
  );
});

test("the consultation picker opens active rooms before closed transcripts", () => {
  assert.match(APP, /IN_CONSULTATION: 0,/);
  assert.match(APP, /COMPLETED: 3,/);
  assert.match(APP, /priority\[a\.status\] \?\? 9/);
});

test("both roles have a visible refresh button in the consultation view", () => {
  const consultIndex = HTML.indexOf('data-view="consult"');
  const refreshIndex = HTML.indexOf("data-consult-refresh");
  assert.ok(consultIndex >= 0 && refreshIndex > consultIndex);
  assert.match(HTML, /data-consult-refresh[\s\S]{0,240}>Refresh</);
  assert.match(APP, /async function refreshConsultationRoom/);
  assert.match(APP, /querySelector\("\[data-consult-refresh\]"\)/);
  assert.match(APP, /void refreshConsultationRoom\(\)/);
  assert.match(APP, /button\.disabled = true/);
  assert.match(APP, /await loadConsultationPicker\(\)/);
  assert.doesNotMatch(APP, /chatActionButton\("Refresh consultation status"/);
});

test("doctors still get a start action beside the locked chat message", () => {
  assert.match(APP, /id = "consult-room-control"/);
  assert.match(APP, /chatActionButton\("Start consultation"/);
});

test("booked and closed rooms never send unauthorised chat subscriptions", () => {
  const block = APP.match(/function subscribeConsultation\(appointment\) \{([\s\S]*?)\n  \}/);
  assert.ok(block, "subscribeConsultation was not found");
  const guard = block[1].indexOf('if (appointment.status !== "IN_CONSULTATION")');
  const firstTopic = block[1].indexOf('"/topic/appointments/" + id + "/chat"');
  assert.ok(guard >= 0, "missing non-active status guard");
  assert.ok(firstTopic >= 0, "missing chat topic");
  assert.ok(guard < firstTopic, "chat topics are subscribed before the status guard");
  assert.match(APP, /function startConsultationStatusPolling\(appointmentId\)/);
  assert.match(APP, /function stopConsultationStatusPolling\(\)/);
});

test("browser cache is busted after asset changes", () => {
  assert.match(HTML, /mediclinic-app(?:\.min)?\.js\?v=20261124f/);
  assert.match(HTML, /mediclinic-api\.js\?v=20261124f/);
});
