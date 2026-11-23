import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);

function functionSource(name) {
  const start = APP_SOURCE.indexOf(`async function ${name}(`);
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

test("a published summary reloads from the SUMMARY_AVAILABLE notification", () => {
  assert.match(APP_SOURCE, /function syncSummaryNotification\(notification\)/);
  assert.match(APP_SOURCE, /type\.includes\("SUMMARY"\)/);
  assert.match(APP_SOURCE, /state\.syncedSummaryNotifications\.has\(key\)/);
  assert.match(APP_SOURCE, /void loadConsultSummary\(appointmentId\)/);
  assert.match(APP_SOURCE, /syncSummaryNotification\(notification\)/);
  assert.match(
    APP_SOURCE,
    /unread\.forEach\(\(notification\) => \{[\s\S]*syncSummaryNotification\(notification\)[\s\S]*syncReviewNotification\(notification\)/
  );
  assert.match(APP_SOURCE, /state\.consult\.requestedId = n\.appointmentId/);
});

test("a stale patient summary view refreshes status and retries before failing", async () => {
  const source = functionSource("loadConsultSummary");
  const calls = [];
  const nodes = new Map();
  const node = (key) => {
    if (!nodes.has(key)) {
      nodes.set(key, { hidden: false, textContent: "" });
    }
    return nodes.get(key);
  };

  const document = {
    querySelector: (selector) => node(selector),
  };
  const state = {
    consult: {
      appointment: { status: "BOOKED" },
      summary: null,
    },
  };
  const MC = {
    summary: async () => {
      calls.push("summary");
      if (calls.filter((call) => call === "summary").length === 1) {
        throw { status: 403, message: "Not completed" };
      }
      return {
        diagnosis: "Tension headache",
        prescription: "Rest and hydration",
        followUpInstructions: "Review in one week",
        doctorName: "Nuwan Herath",
        updatedAt: "2026-11-23T08:00:00Z",
      };
    },
  };
  const refreshConsultationStatus = async () => {
    calls.push("refresh");
    state.consult.appointment.status = "COMPLETED";
    return false;
  };

  const sandbox = {
    document,
    state,
    S: { role: "CUSTOMER" },
    MC,
    refreshConsultationStatus,
    updateConsultSummaryLine: () => {},
    updateDoctorConsultSummaryBox: () => {},
    formatDateTime: () => "23 Nov 2026",
    formatDate: () => "30 Nov 2026",
    doctorName: (value) => value.doctorName,
  };

  const loadConsultSummary = new Function(
    ...Object.keys(sandbox),
    `${source}\nreturn loadConsultSummary;`
  )(...Object.values(sandbox));

  await loadConsultSummary("appointment-1");

  assert.deepEqual(calls, ["summary", "refresh", "summary"]);
  assert.equal(state.consult.summary.diagnosis, "Tension headache");
  assert.equal(node("[data-summary-diagnosis]").textContent, "Tension headache");
  assert.equal(node("[data-summary]").hidden, false);
  assert.equal(node("[data-summary-empty]").hidden, true);
});
