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
const PROFILE_PAGE = readFileSync(
  new URL("../src/app/profile/page.tsx", import.meta.url),
  "utf8"
);
const APPOINTMENTS_PAGE = readFileSync(
  new URL("../src/app/appointments/page.tsx", import.meta.url),
  "utf8"
);
const CONSULTATION_PAGE = readFileSync(
  new URL("../src/app/consultation/page.tsx", import.meta.url),
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

test("session discovery sends explicit online and physical filters", async () => {
  const { MC, calls } = loadApi();

  await MC.sessions({ date: "2026-11-19", consultationType: "ONLINE" });
  assert.equal(
    calls[0].url,
    "/api/backend/sessions?date=2026-11-19&consultationType=ONLINE"
  );

  await MC.sessions({ consultationType: "PHYSICAL" });
  assert.equal(
    calls[1].url,
    "/api/backend/sessions?consultationType=PHYSICAL"
  );
});

test("patient profile and own feedback use the backend profile contracts", async () => {
  const { MC, calls } = loadApi();

  await MC.myProfile();
  assert.equal(calls[0].url, "/api/backend/patients/me");
  assert.equal(calls[0].settings.method, "GET");

  const payload = {
    firstName: "Asha",
    lastName: "Perera",
    phone: "0712345678",
    nic: "123456789V",
    dateOfBirth: "2000-01-01",
    gender: "Female",
    address: "Colombo",
  };
  await MC.updateMyProfile(payload);
  assert.equal(calls[1].url, "/api/backend/patients/me");
  assert.equal(calls[1].settings.method, "PUT");
  assert.deepEqual(JSON.parse(calls[1].settings.body), payload);

  await MC.myReviews();
  assert.equal(calls[2].url, "/api/backend/reviews/me");
  assert.equal(calls[2].settings.method, "GET");
});

test("a consultation deep link resolves a specific appointment", async () => {
  const { MC, calls } = loadApi();
  const id = "55555555-5555-5555-5555-555555555555";

  await MC.myAppointment(id);
  assert.equal(calls[0].url, "/api/backend/appointments/" + id);
  assert.equal(calls[0].settings.method, "GET");

  assert.match(APP_SOURCE, /id\.startsWith\("consult-"\)/);
  assert.match(
    APP_SOURCE,
    /link\.href = "#consult-" \+ encodeURIComponent\(n\.appointmentId\)/
  );
});

test("patient cancellation is limited to pending bookings", () => {
  assert.match(APP_SOURCE, /appointment\.status === "BOOKED"/);
  assert.match(APP_SOURCE, /appointment\.paymentStatus === "PENDING"/);
  assert.match(APP_SOURCE, /session\.remainingAppointments \?\?/);
});

test("the SPA exposes patient profile management", () => {
  assert.match(HTML_SOURCE, /<section data-view="profile"/);
  assert.match(HTML_SOURCE, /href="#profile"[^>]*>My profile<\/a>/);
  assert.match(HTML_SOURCE, /data-profile-form/);
  assert.match(HTML_SOURCE, /id="profile-first"/);
  assert.match(HTML_SOURCE, /id="profile-nic"/);
  assert.match(HTML_SOURCE, /id="profile-address"/);
  assert.match(APP_SOURCE, /void loadPatientProfile\(\)/);
  assert.match(APP_SOURCE, /MC\.updateMyProfile\(payload\)/);
});

test("online consultation, summary and feedback flows are complete", () => {
  assert.match(APP_SOURCE, /Join online consultation/);
  assert.match(APP_SOURCE, /data-join-online/);
  assert.match(HTML_SOURCE, /data-summary-symptoms/);
  assert.match(APP_SOURCE, /record\.symptoms/);
  assert.match(APP_SOURCE, /MC\.myReviews\(\)/);
  assert.match(APP_SOURCE, /markFeedbackSubmitted/);
});

test("direct Next.js patient pages no longer contradict the implemented API", () => {
  assert.match(PROFILE_PAGE, /method: hasProfile \? "PUT" : "POST"/);
  assert.match(PROFILE_PAGE, /address: form\.address\.trim\(\) \|\| null/);
  assert.match(APPOINTMENTS_PAGE, /Pay now/);
  assert.match(APPOINTMENTS_PAGE, /appointment\.paymentStatus === "PENDING"/);
  assert.doesNotMatch(APPOINTMENTS_PAGE, /not currently exposed by a patient queue API/);
  assert.doesNotMatch(CONSULTATION_PAGE, /will be enabled after the Spring Boot WebSocket service/);
});
