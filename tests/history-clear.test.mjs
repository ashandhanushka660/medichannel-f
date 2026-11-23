import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const API_SOURCE = readFileSync(
  new URL("../public/mediclinic-api.js", import.meta.url),
  "utf8"
);
const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const HTML_SOURCE = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);

function loadApi() {
  const calls = [];
  const sandbox = {
    Headers,
    FormData,
    URLSearchParams,
    JSON,
    console,
    navigator: { onLine: true },
    sessionStorage: { getItem: () => null },
    fetch: async (url, settings = {}) => {
      calls.push({ url, settings });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(API_SOURCE, sandbox, { filename: "mediclinic-api.js" });
  return { MC: sandbox.MC, calls };
}

test("clear-history API calls reach the participant-scoped endpoints", async () => {
  const { MC, calls } = loadApi();

  await MC.hideAppointment("patient-row");
  assert.equal(
    calls[0].url,
    "/api/backend/appointments/patient-row/hide"
  );
  assert.equal(calls[0].settings.method, "PATCH");

  await MC.hideDoctorAppointment("doctor-row");
  assert.equal(
    calls[1].url,
    "/api/backend/doctor/appointments/doctor-row/hide"
  );
  assert.equal(calls[1].settings.method, "PATCH");
});

test("closed patient appointments have an individual clear action", () => {
  const start = APP_SOURCE.indexOf("function renderAppointments(list)");
  const end = APP_SOURCE.indexOf("\n  function actionButton(", start);
  const block = APP_SOURCE.slice(start, end);
  assert.ok(block, "renderAppointments was not found");
  assert.match(block, /\["COMPLETED", "NO_SHOW", "CANCELLED"\]/);
  assert.match(block, /"Clear from history"/);
  assert.match(block, /"clear-appointment",\s*appointment\.appointmentId/);
  assert.match(
    APP_SOURCE,
    /event\.target\.closest\("\[data-clear-appointment\]"\)/
  );
  assert.match(APP_SOURCE, /void clearAppointmentHistory\(/);
  assert.match(APP_SOURCE, /MC\.hideAppointment\(appointmentId\)/);
  assert.match(HTML_SOURCE, /Clear from history button/);
});

test("closed doctor queue rows have an individual clear action", () => {
  const start = APP_SOURCE.indexOf("function renderDoctorRows(queue, session)");
  const end = APP_SOURCE.indexOf("\n  function doctorAction(", start);
  const block = APP_SOURCE.slice(start, end);
  assert.ok(block, "renderDoctorRows was not found");
  assert.match(block, /\["COMPLETED", "NO_SHOW", "CANCELLED"\]/);
  assert.match(block, /"Clear from history"/);
  assert.match(block, /"clear",\s*appointment\.appointmentId/);

  const action = APP_SOURCE.match(
    /async function runDoctorAction\(name, appointmentId, button\) \{([\s\S]*?)\n  \}/
  );
  assert.ok(action, "runDoctorAction was not found");
  assert.match(action[1], /name === "clear"/);
  assert.match(action[1], /confirmClearHistory\("doctor"\)/);
  assert.match(action[1], /MC\.hideDoctorAppointment\(appointmentId\)/);
});

test("history clearing asks Yes/No and says records are retained", () => {
  const block = APP_SOURCE.match(
    /function confirmClearHistory\(scope\) \{([\s\S]*?)\n  \}/
  );
  assert.ok(block, "confirmClearHistory was not found");
  assert.match(block[1], /"Yes"/);
  assert.match(block[1], /"No"/);
  assert.match(block[1], /hospital system/);
  assert.match(block[1], /notice\.hidden = true/);
  assert.match(APP_SOURCE, /confirmClearHistory\("patient"\)/);
});
