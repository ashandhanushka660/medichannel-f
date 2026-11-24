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

const CLINIC_HOURS_LABEL = "07:00–16:00 · 5 min per patient";

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
    "animateStateChange",
    "state",
    "CLINIC_HOURS_LABEL",
    `${functionSource("renderSessionCard")}
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
    () => {},
    state,
    CLINIC_HOURS_LABEL
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
  startTime: "09:00:00",
  endTime: "12:00:00",
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
    "07:00–16:00",
    "5 min per patient",
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
    /<link rel="stylesheet" href="\/vendor\/mediclinic-tailwind\.css\?v=20261124c"/
  );
});

test("the booking form offers eight hourly periods from 07:00 to 16:00", () => {
  const select = HTML_SOURCE.match(/<select id="index-period"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, "the time period select was not found");

  const options = [...select[1].matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(
    (match) => ({ value: match[1], label: match[2] })
  );

  assert.deepEqual(
    options.map((option) => option.value),
    ["", "07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"]
  );
  assert.equal(options[0].label, "All periods");
  assert.equal(options[1].label, "07:00 – 08:00");
  assert.equal(options[8].label, "15:00 – 16:00");
  assert.ok(!options.some((option) => option.value === "12:00"));
  assert.match(HTML_SOURCE, /<label for="index-period">Time period<\/label>/);
});

test("the selected hour is sent to the session search and labelled", () => {
  const values = {
    "index-q": "Wijesinghe",
    "index-sp": "cardiology-id",
    "index-dt": "2026-11-24",
    "index-period": "09:00",
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
    period: "09:00",
    consultationType: "ONLINE",
  });

  const periodLabel = new Function(
    `${functionSource("periodLabel")}\nreturn periodLabel;`
  )();
  assert.equal(periodLabel("09:00"), "09:00–10:00");
  assert.equal(periodLabel(""), "");

  assert.match(APP_SOURCE, /MC\.sessions\(filters\)/);
  assert.match(API_SOURCE, /sessions\(filters\) \{\s*return request\("sessions" \+ query\(filters\)\);/);
  assert.match(APP_SOURCE, /day \+\n\s*" · " \+ CLINIC_WINDOW_LABEL/);
  assert.match(APP_SOURCE, /const CLINIC_WINDOW_LABEL = CLINIC_START \+ "–" \+ CLINIC_END/);
});
