import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);

function functionSource(name) {
  const marker = `function ${name}(`;
  const start = APP_SOURCE.indexOf(marker);
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

function loadHelpers() {
  const source = [
    functionSource("doctorSessionBookedCount"),
    functionSource("doctorSessionHasBookings"),
    functionSource("sortDoctorSessions"),
    functionSource("chooseDefaultDoctorSession"),
  ].join("\n\n");
  return new Function(`${source}\nreturn { chooseDefaultDoctorSession, doctorSessionBookedCount };`)();
}

const SESSIONS = [
  {
    sessionId: "today-empty",
    sessionDate: "2026-11-25",
    startTime: "07:00",
    status: "OPEN",
    maxAppointments: 10,
    remainingAppointments: 10,
  },
  {
    sessionId: "future-booked",
    sessionDate: "2026-12-01",
    startTime: "13:00",
    status: "OPEN",
    maxAppointments: 10,
    remainingAppointments: 9,
  },
  {
    sessionId: "past-booked",
    sessionDate: "2026-11-20",
    startTime: "09:00",
    status: "COMPLETED",
    maxAppointments: 10,
    remainingAppointments: 8,
  },
];

test("doctor console opens the session with the relevant booking", () => {
  const { chooseDefaultDoctorSession } = loadHelpers();
  const chosen = chooseDefaultDoctorSession(
    SESSIONS,
    "2026-11-25",
    "today-empty"
  );
  assert.equal(chosen.sessionId, "future-booked");
});

test("doctor console keeps the current session when it has bookings", () => {
  const { chooseDefaultDoctorSession } = loadHelpers();
  const chosen = chooseDefaultDoctorSession(
    SESSIONS,
    "2026-11-25",
    "future-booked"
  );
  assert.equal(chosen.sessionId, "future-booked");
});

test("doctor console falls back to today when no session has bookings", () => {
  const { chooseDefaultDoctorSession } = loadHelpers();
  const sessions = SESSIONS.map((session) => ({
    ...session,
    remainingAppointments: session.maxAppointments,
  }));
  const chosen = chooseDefaultDoctorSession(sessions, "2026-11-25", null);
  assert.equal(chosen.sessionId, "today-empty");
});

test("booked counts use clinic capacity remaining", () => {
  const { doctorSessionBookedCount } = loadHelpers();
  assert.equal(doctorSessionBookedCount(SESSIONS[1]), 1);
  assert.equal(doctorSessionBookedCount(null), 0);
});

test("doctor console uses clinic-local today and labels booked counts", () => {
  const loadDoctorConsole = functionSource("loadDoctorConsole");
  assert.match(loadDoctorConsole, /const today = todayISO\(\)/);
  assert.doesNotMatch(loadDoctorConsole, /toISOString\(\)\.slice/);
  assert.match(loadDoctorConsole, /chooseDefaultDoctorSession\(/);
  assert.match(loadDoctorConsole, /doctorSessionBookedCount\(session\)/);
});
