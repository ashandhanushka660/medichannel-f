import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

const APP = read("public/mediclinic-app.js");
const API_CLIENT = read("src/lib/api.ts");
const APPOINTMENTS = read("src/app/appointments/page.tsx");
const DOCTOR_SEARCH = read("src/components/doctors/doctor-search.tsx");
const WORKSPACE = read("src/components/common/workspace.tsx");

test("every direct browser request goes through the timeout wrapper", () => {
  assert.match(APP, /const fetchWithTimeout = \(url, options, timeoutMs = 25_000\)/);
  assert.match(APP, /AbortSignal\.timeout\(timeoutMs\)/);
  assert.doesNotMatch(APP, /await fetch\("\/api\//);
});

test("the React API client applies a default timeout but honours caller signals", () => {
  assert.match(API_CLIENT, /options\.signal \?\?/);
  assert.match(API_CLIENT, /AbortSignal\.timeout\(25_000\)/);
});

test("private pages abort or guard requests when they unmount", () => {
  assert.match(APPOINTMENTS, /fetchAppData\(controller\.signal\)/);
  assert.match(APPOINTMENTS, /controller\.abort\(\)/);
  assert.match(DOCTOR_SEARCH, /signal: controller\.signal/);
  assert.match(DOCTOR_SEARCH, /return \(\) => controller\.abort\(\)/);
  assert.match(WORKSPACE, /if \(active\) router\.replace\("\/login"\)/);
});
