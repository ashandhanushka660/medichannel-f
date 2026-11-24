import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const HTML = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);
const APP = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);

test("manager form creates only the two published 30-patient windows", () => {
  assert.match(
    HTML,
    /<input id="sess-max" type="number" min="1" max="30" value="30"[^>]*>/
  );
  assert.match(
    HTML,
    /<input id="sess-mins" type="number" min="5" max="5" value="5"[^>]*readonly[^>]*>/
  );
  assert.match(HTML, /<option value="07:00">Morning · 07:00 – 09:30<\/option>/);
  assert.match(HTML, /<option value="12:00">Afternoon · 12:00 – 14:30<\/option>/);
  assert.match(
    HTML,
    /<input id="sess-end" type="time" value="09:30" readonly[^>]*>/
  );
});

test("frontend schedule constants and validation use two five-minute windows", () => {
  assert.match(APP, /const MORNING_START = "07:00"/);
  assert.match(APP, /const MORNING_END = "09:30"/);
  assert.match(APP, /const AFTERNOON_START = "12:00"/);
  assert.match(APP, /const AFTERNOON_END = "14:30"/);
  assert.match(APP, /const SLOT_MINUTES = 5/);
  assert.match(APP, /const MAX_PATIENTS_PER_SESSION = 30/);
  assert.match(APP, /const MAX_PATIENTS_PER_DAY = 60/);
  assert.match(APP, /value \|\| MAX_PATIENTS_PER_SESSION/);
  assert.match(APP, /value \|\| SLOT_MINUTES/);
  assert.match(
    APP,
    /Maximum patients must be between 1 and/
  );
  assert.match(APP, /minutesPerPatient !== SLOT_MINUTES/);
  assert.match(APP, /Number\(value && value\.minutesPerPatient\) \|\| SLOT_MINUTES/);
});

test("booking copy states both windows, cutoffs and estimate anchors", () => {
  assert.match(HTML, /Morning · 07:00 – 09:30/);
  assert.match(HTML, /Afternoon · 12:00 – 14:30/);
  assert.match(HTML, /allocated 5-minute slot/);
  assert.match(HTML, /#30 at 09:25 or 14:25/);
  assert.match(APP, /Book by " \+ closeMinutes \+ " min before start/);
});
