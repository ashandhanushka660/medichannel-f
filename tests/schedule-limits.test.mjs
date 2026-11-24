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

test("manager form accepts 1-60 patients and 5-30 minute slots", () => {
  assert.match(
    HTML,
    /<input id="sess-max" type="number" min="1" max="60" value="60"[^>]*>/
  );
  assert.match(
    HTML,
    /<input id="sess-mins" type="number" min="5" max="30" value="5"[^>]*>/
  );
});

test("frontend schedule constants and validation use 60 patients and 5 minutes", () => {
  assert.match(APP, /const SLOT_MINUTES = 5/);
  assert.match(APP, /const MAX_PATIENTS_PER_SESSION = 60/);
  assert.match(APP, /value \|\| MAX_PATIENTS_PER_SESSION/);
  assert.match(APP, /value \|\| SLOT_MINUTES/);
  assert.match(
    APP,
    /Maximum patients must be between 1 and/
  );
  assert.match(APP, /minutesPerPatient < 5 \|\| minutesPerPatient > 30/);
  assert.match(APP, /Number\(value && value\.minutesPerPatient\) \|\| SLOT_MINUTES/);
});

test("booking copy states the five-minute default slot", () => {
  assert.match(HTML, /allocated 5-minute slot and finish time/);
});
