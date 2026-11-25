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
  assert.match(HTML, /<option value="07:00">Morning · 07:00 – 11:00<\/option>/);
  assert.match(HTML, /<option value="13:00">Evening · 13:00 – 15:00<\/option>/);
  assert.match(
    HTML,
    /<input id="sess-end" type="time" value="11:00" readonly[^>]*>/
  );
  assert.equal(HTML.includes("12:00 – 14:30"), false);
});

test("frontend schedule constants and validation use two five-minute windows", () => {
  assert.match(APP, /const MORNING_START = "07:00"/);
  assert.match(APP, /const MORNING_END = "11:00"/);
  assert.match(APP, /const EVENING_START = "13:00"/);
  assert.match(APP, /const EVENING_END = "15:00"/);
  assert.match(APP, /const BREAK_START = MORNING_END/);
  assert.match(APP, /const BREAK_END = EVENING_START/);
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

test("booking copy states both windows, cutoffs and the no-number break", () => {
  assert.match(HTML, /Morning · 07:00 – 11:00/);
  assert.match(HTML, /Evening · 13:00 – 15:00/);
  assert.match(HTML, /allocated 5-minute slot/);
  assert.match(HTML, /11:00–13:00 break/);
  assert.match(APP, /Number issuing paused · 11:00–13:00 break/);
  assert.match(APP, /No appointment numbers are issued during the 11:00–13:00 break\./);
  assert.match(APP, /Book by " \+ closeMinutes \+ " min before start/);
});

test("the time period choice lives inside the expanded booking panel", () => {
  assert.equal(HTML.includes('id="index-period"'), false);

  const formStart = HTML.indexOf('<div data-booking-form');
  const bpStart = HTML.indexOf('<label for="index-bp"');
  assert.ok(formStart >= 0 && bpStart > formStart, "index-bp must be inside the booking form");

  const select = HTML.match(/<select id="index-bp"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, "the booking period select was not found");

  const options = [...select[1].matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(
    (match) => ({ value: match[1], label: match[2] })
  );

  assert.deepEqual(
    options.map((option) => option.value),
    ["", "MORNING", "EVENING"]
  );
  assert.equal(options[0].label, "Choose a period");
  assert.equal(options[1].label, "Morning · 07:00 – 11:00");
  assert.equal(options[2].label, "Evening · 13:00 – 15:00");
  assert.match(HTML, /<label for="index-bp"[^>]*>Time period \*<\/label>/);
  assert.match(APP, /Please choose Morning or Evening for this booking\./);
});
