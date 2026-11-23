import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const HTML_SOURCE = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);

function functionSource(name) {
  const asyncStart = APP_SOURCE.indexOf(`async function ${name}(`);
  const plainStart = APP_SOURCE.indexOf(`function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : plainStart;
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

const IDENTITY_SOURCE = functionSource("doctorDisplayName");

function makeHarness(profile) {
  const S = {
    id: "signed-in-user",
    role: "DOCTOR",
    email: "doctor@example.test",
    displayName: null,
  };
  const state = {
    doctor: {
      profile: null,
      identityLoading: false,
    },
  };
  const calls = [];
  let renders = 0;

  const MC = {
    doctorProfile: async () => {
      calls.push(["doctorProfile"]);
      return profile;
    },
  };
  const render = () => {
    renders += 1;
  };

  const api = new Function(
    "S",
    "state",
    "MC",
    "render",
    `${IDENTITY_SOURCE}\n${functionSource("loadDoctorIdentity")}\nreturn { doctorDisplayName, loadDoctorIdentity };`
  )(S, state, MC, render);

  return { api, calls, render: () => renders, S, state };
}

test("the doctor dashboard and welcome view have identity greeting slots", () => {
  assert.match(HTML_SOURCE, /data-welcome-identity/);
  assert.match(HTML_SOURCE, /data-doctor-welcome/);
  assert.match(APP_SOURCE, /querySelectorAll\("\[data-welcome-identity\]"\)/);
  assert.match(APP_SOURCE, /querySelectorAll\("\[data-doctor-welcome\]"\)/);
  assert.match(APP_SOURCE, /"Welcome back, " \+ welcomeName/);
  assert.match(APP_SOURCE, /const displayName = S\.displayName \|\| S\.email/);
});

test("the signed-in doctor profile is loaded for any doctor account", () => {
  assert.match(APP_SOURCE, /function doctorDisplayName\(doctor\)/);
  assert.match(APP_SOURCE, /await MC\.doctorProfile\(\)/);
  assert.match(APP_SOURCE, /void loadDoctorIdentity\(\);/);
  assert.match(APP_SOURCE, /id === "doctor"[\s\S]*void loadDoctorIdentity\(\)/);
  assert.match(APP_SOURCE, /id === "welcome"[\s\S]*void loadDoctorIdentity\(\)/);

  const { api, calls, render, S, state } = makeHarness({
    doctorId: "profile-id",
    firstName: "Test",
    lastName: "Doctor",
  });

  assert.equal(api.doctorDisplayName({ doctorName: "Dr. Already Prefixed" }), "Dr. Already Prefixed");
  assert.equal(api.doctorDisplayName({}), "");

  return api.loadDoctorIdentity().then(() => {
    assert.deepEqual(calls, [["doctorProfile"]]);
    assert.equal(S.displayName, "Dr. Test Doctor");
    assert.equal(S.doctorName, "Dr. Test Doctor");
    assert.equal(state.doctor.profile.firstName, "Test");
    assert.equal(render(), 1);
  });
});

test("a delayed profile response cannot rename a different signed-in user", async () => {
  const { api, render, S } = makeHarness({
    firstName: "Other",
    lastName: "Doctor",
  });
  const pendingCall = api.loadDoctorIdentity();

  // Simulate switching accounts before the profile request resumes.
  S.role = "CUSTOMER";
  await pendingCall;

  assert.equal(S.displayName, null);
  assert.equal(render(), 0);
});
