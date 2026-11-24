import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);

function functionSource(name) {
  const start = APP.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} was not found`);

  let depth = 0;
  let started = false;
  for (let index = start; index < APP.length; index += 1) {
    const char = APP[index];
    if (char === "{") {
      depth += 1;
      started = true;
    } else if (char === "}") {
      depth -= 1;
      if (started && depth === 0) {
        return APP.slice(start, index + 1);
      }
    }
  }
  throw new Error(`Unterminated function: ${name}`);
}

const deadline = new Function(
  "CLINIC_UTC_OFFSET",
  "PHYSICAL_BOOKING_CLOSE_MINUTES",
  "ONLINE_BOOKING_CLOSE_MINUTES",
  `${functionSource("sessionStart")}
   ${functionSource("bookingDeadline")}
   ${functionSource("bookingClosed")}
   return { bookingDeadline, bookingClosed };`
)("+05:30", 60, 30);

function at(time) {
  return {
    sessionId: "s-1",
    sessionDate: "2026-11-24",
    startTime: "09:00:00",
    consultationType: time,
  };
}

test("physical booking stays open until 60 minutes before the session", () => {
  const physicalDeadline = deadline.bookingDeadline(at("PHYSICAL")).getTime();

  withNow(physicalDeadline - 1, () => {
    assert.equal(deadline.bookingClosed(at("PHYSICAL")), false);
    assert.equal(deadline.bookingClosed(at("ONLINE")), false);
  });

  withNow(physicalDeadline, () => {
    assert.equal(deadline.bookingClosed(at("PHYSICAL")), true);
    assert.equal(deadline.bookingClosed(at("ONLINE")), false);
  });
});

test("online booking stays open until 30 minutes before the session", () => {
  const onlineDeadline = deadline.bookingDeadline(at("ONLINE")).getTime();

  withNow(onlineDeadline - 1, () => {
    assert.equal(deadline.bookingClosed(at("ONLINE")), false);
  });

  withNow(onlineDeadline, () => {
    assert.equal(deadline.bookingClosed(at("ONLINE")), true);
  });
});

test("session times are interpreted in Asia/Colombo, not browser local time", () => {
  const expected = Date.parse("2026-11-24T09:00:00+05:30") - 60 * 60000;
  assert.equal(
    deadline.bookingDeadline(at("PHYSICAL")).getTime(),
    expected
  );
});

function withNow(value, callback) {
  const original = Date.now;
  Date.now = () => value;
  try {
    callback();
  } finally {
    Date.now = original;
  }
}
