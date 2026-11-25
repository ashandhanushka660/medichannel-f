import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const API_SOURCE = readFileSync(
  new URL("../public/mediclinic-api.js", import.meta.url),
  "utf8"
);
const HTML_SOURCE = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);

function functionSource(name) {
  const start = APP_SOURCE.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} was not found`);

  let depth = 0;
  let started = false;
  for (let i = start; i < APP_SOURCE.length; i += 1) {
    const char = APP_SOURCE[i];
    if (char === "{") {
      depth += 1;
      started = true;
    } else if (char === "}") {
      depth -= 1;
      if (started && depth === 0) {
        return APP_SOURCE.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Unterminated function: ${name}`);
}

function node(tag) {
  return {
    tag,
    className: "",
    textContent: "",
    hidden: false,
    dataset: {},
    style: {},
    children: [],
    classList: { add() {} },
    setAttribute() {},
    append(...items) {
      this.children.push(...items);
    },
    replaceChildren(...items) {
      this.children = items;
    },
  };
}

function text(value) {
  return [value.textContent || ""]
    .concat((value.children || []).map(text))
    .join(" ");
}

const CLINIC_WINDOWS = [
  { start: "07:00", end: "11:00", label: "Morning" },
  { start: "13:00", end: "15:00", label: "Evening" },
];
const CLINIC_WINDOW_LABEL = "07:00–11:00 or 13:00–15:00";
const SLOT_MINUTES = 5;
const MAX_PATIENTS_PER_SESSION = 30;
const MAX_PATIENTS_PER_DAY = 60;

function makeSessionHarness(session, queue) {
  const document = {
    createTextNode(value) {
      return { textContent: String(value), children: [] };
    },
  };
  const el = (tag, className, value) => {
    const item = node(tag);
    if (className) item.className = className;
    if (value !== undefined && value !== null) item.textContent = String(value);
    return item;
  };
  const badge = (label) => el("span", "", label);
  const state = { sessionQueues: { [session.sessionId]: queue } };

  const renderSessionCard = new Function(
    "document",
    "el",
    "badge",
    "doctorName",
    "formatTime",
    "formatDate",
    "money",
    "bookingDeadline",
    "bookingClosed",
    "isClinicBreakNow",
    "animateStateChange",
    "state",
    "CLINIC_WINDOWS",
    "CLINIC_WINDOW_LABEL",
    "SLOT_MINUTES",
    "MAX_PATIENTS_PER_SESSION",
    "MAX_PATIENTS_PER_DAY",
    `${functionSource("sessionWindow")}
 ${functionSource("sessionWindowLabel")}
 ${functionSource("sessionCapacityLabel")}
 ${functionSource("renderSessionCard")}
return renderSessionCard;`
  )(
    document,
    el,
    badge,
    (item) => "Dr. " + item.doctorName,
    (value) => String(value || "").slice(0, 5),
    () => "Tuesday, 24 November 2026",
    (value) => "LKR " + value,
    () => null,
    () => false,
    () => false,
    () => {},
    state,
    CLINIC_WINDOWS,
    CLINIC_WINDOW_LABEL,
    SLOT_MINUTES,
    MAX_PATIENTS_PER_SESSION,
    MAX_PATIENTS_PER_DAY
  );

  return renderSessionCard(session);
}

const session = {
  sessionId: "session-1",
  doctorId: "doctor-1",
  doctorName: "Rajini Kanth",
  doctorAvailable: true,
  specialisation: "Cardiology",
  roomNumber: "A-12",
  sessionDate: "2026-11-24",
  startTime: "07:00:00",
  endTime: "11:00:00",
  consultationType: "PHYSICAL",
  status: "OPEN",
  minutesPerPatient: 5,
  maxAppointments: 6,
  remainingAppointments: 2,
  feeLkr: 2500,
};

const queue = {
  sessionId: "session-1",
  nowServing: 3,
  nextNumber: 4,
  remainingAppointments: 2,
  maxAppointments: 6,
  status: "OPEN",
};

test("patient session dashboard is labelled Book a session", () => {
  assert.match(
    HTML_SOURCE,
    /<section data-view="index" data-title="Book a session"/
  );
  assert.match(HTML_SOURCE, />Book a session<\/a>/);
  assert.match(HTML_SOURCE, /<h1>Book a session<\/h1>/);
});

test("patient sessions are filtered to available doctors only", () => {
  const bookableSessions = new Function(
    `${functionSource("bookableSessions")}\nreturn bookableSessions;`
  )();

  const result = bookableSessions([
    { sessionId: "keep-1", doctorAvailable: true },
    { sessionId: "keep-2" },
    { sessionId: "drop", doctorAvailable: false },
  ]);

  assert.deepEqual(
    result.map((item) => item.sessionId),
    ["keep-1", "keep-2"]
  );
});

test("session cards show congruent clinic hours and the live queue", () => {
  const cardText = text(makeSessionHarness(session, queue));

  for (const expected of [
    "Dr. Rajini Kanth",
    "Morning 07:00–11:00 · 5 min per patient",
    "Up to 6 patients · 60 per day across both sessions",
    "Now serving #3",
    "Next #4",
    "Spots left (live)",
    "Available",
    "Book",
  ]) {
    assert.ok(cardText.includes(expected), `missing ${expected}`);
  }
});

test("the booking confirmation keeps showing the allocated queue number", () => {
  assert.match(APP_SOURCE, /number\.textContent = "#" \+ appointment\.appointmentNumber/);
  assert.match(
    APP_SOURCE,
    /Your queue number is allocated as soon as you confirm\./
  );
  assert.match(
    HTML_SOURCE,
    /<link rel="stylesheet" href="\/vendor\/mediclinic-tailwind\.css\?v=20261125d"/
  );
});

test("the time period choice lives in the booking panel, not the filter area", () => {
  assert.equal(HTML_SOURCE.includes('id="index-period"'), false);

  const formStart = HTML_SOURCE.indexOf('<div data-booking-form');
  const select = HTML_SOURCE.match(/<select id="index-bp"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, "the booking period select was not found");
  assert.ok(formStart >= 0 && HTML_SOURCE.indexOf('<select id="index-bp"') > formStart);

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
  assert.match(HTML_SOURCE, /<label for="index-bp"[^>]*>Time period \*<\/label>/);
  assert.match(APP_SOURCE, /Please choose Morning or Evening for this booking\./);
});

test("session filters no longer carry a period but bookings do", () => {
  const values = {
    "index-q": "Wijesinghe",
    "index-sp": "cardiology-id",
    "index-dt": "2026-11-24",
    "index-ty": "ONLINE",
  };
  const $ = (id) => ({ value: values[id] || "" });

  const currentFilters = new Function(
    "$",
    `${functionSource("currentFilters")}\nreturn currentFilters;`
  )($);

  assert.deepEqual(currentFilters(), {
    q: "Wijesinghe",
    specialisationId: "cardiology-id",
    date: "2026-11-24",
    consultationType: "ONLINE",
  });

  const periodLabel = new Function(
    "CLINIC_WINDOWS",
    `${functionSource("periodLabel")}\nreturn periodLabel;`
  )(CLINIC_WINDOWS);
  assert.equal(periodLabel("07:00"), "Morning 07:00–11:00");
  assert.equal(periodLabel("13:00"), "Evening 13:00–15:00");
  assert.equal(periodLabel(""), "");

  assert.match(APP_SOURCE, /MC\.sessions\(requestFilters\)/);
  assert.match(API_SOURCE, /sessions\(filters\) \{\s*return request\("sessions" \+ query\(filters\)\);/);
  assert.match(APP_SOURCE, /rangeLabel \+\n\s*" · " \+ CLINIC_WINDOW_LABEL/);
  assert.match(APP_SOURCE, /const CLINIC_WINDOW_LABEL =\n\s*MORNING_START \+ "–" \+ MORNING_END/);
  assert.match(APP_SOURCE, /const period = periodInput \? periodInput\.value : ""/);
  assert.match(
    APP_SOURCE,
    /MC\.bookAppointment\(\s*session\.sessionId,\s*reason,\s*period\s*\)/
  );
  assert.match(API_SOURCE, /bookAppointment\(sessionId, reason, period\) \{/);
  assert.match(API_SOURCE, /body: \{ sessionId, reason, period \}/);
  assert.match(APP_SOURCE, /The selected period does not match this session\./);
  assert.match(APP_SOURCE, /isClinicBreakNow\(\)/);
});
