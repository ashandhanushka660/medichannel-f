import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const API = readFileSync(
  new URL("../public/mediclinic-api.js", import.meta.url),
  "utf8"
);

test("manager delay asks for custom minutes instead of a fixed 15 minutes", () => {
  assert.match(APP, /function promptDelayMinutes\(/);
  assert.match(APP, /input\.dataset\.delayMinutes = ""/);
  assert.match(APP, /input\.type = "number"/);
  assert.match(APP, /"Confirm delay"/);
  assert.match(APP, /minutes < 1 \|\|\n\s*minutes > 480/);
  assert.match(APP, /await promptDelayMinutes\("Delay this session"\)/);
  assert.match(APP, /await MC\.delaySession\(sessionId, minutes\)/);

  assert.doesNotMatch(APP, /\+15m/);
  assert.doesNotMatch(APP, /delaySession\(sessionId, 15\)/);
  assert.doesNotMatch(API, /Number\(minutes\) \|\| 15/);
});

test("a queued appointment can delay itself and every booking behind it", () => {
  assert.match(APP, /delay\.dataset\.delayAppointment = appointment\.appointmentId/);
  assert.match(APP, /async function delayAppointmentQueue\(/);
  assert.match(APP, /await MC\.delayAppointment\(appointmentId, minutes\)/);
  assert.match(API, /delayAppointment\(appointmentId, minutes\)/);
  assert.match(
    API,
    /"appointments\/" \+ encodeURIComponent\(appointmentId\) \+ "\/delay"/
  );
  assert.match(API, /body: \{ delayMinutes: Number\(minutes\) \}/);
});

test("every cancellation path records a mandatory reason", () => {
  assert.match(APP, /confirmAppointmentCancel\(sessionId, \{/);
  assert.match(APP, /await MC\.cancelSession\(sessionId, reason\)/);
  assert.match(APP, /confirmAppointmentCancel\(appointmentId, \{[\s\S]*Decline/);
  assert.match(APP, /await MC\.declineAppointment\(appointmentId, reason\)/);
  assert.match(API, /cancelSession\(sessionId, reason\)/);
  assert.match(API, /body: \{ reason \}/);
  assert.match(API, /declineAppointment\(appointmentId, reason\)/);

  assert.doesNotMatch(
    APP,
    /window\.confirm\("Are you sure you want to cancel this session/
  );
  assert.doesNotMatch(APP, /window\.confirm\("Decline this appointment/);
});

test("create-session form publishes the full clinic day and 10-minute slots", () => {
  assert.match(APP, /const CLINIC_START = "07:00"/);
  assert.match(APP, /const CLINIC_END = "16:00"/);
  assert.match(APP, /const CLINIC_HOURS = 8/);
  assert.match(APP, /const SLOT_MINUTES = 10/);
  assert.match(APP, /" · " \+ CLINIC_WINDOW_LABEL/);
});
