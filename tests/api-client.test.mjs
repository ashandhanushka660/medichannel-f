import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const API_SOURCE = readFileSync(
  new URL("../public/mediclinic-api.js", import.meta.url),
  "utf8"
);

function jsonResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function loadApi(options = {}) {
  const calls = [];
  const sandbox = {
    Headers,
    FormData,
    URLSearchParams,
    AbortSignal,
    JSON,
    console,
    navigator: { onLine: options.online ?? true },
    sessionStorage: {
      getItem(key) {
        if (options.onSessionStorageGet) options.onSessionStorageGet(key);
        if (key === "mc_tab_token") return options.tabToken ?? null;
        return null;
      },
    },
    fetch: async (url, settings = {}) => {
      calls.push({ url, settings });
      if (options.fetchImpl) return options.fetchImpl(url, settings);
      return jsonResponse(200, []);
    },
  };

  // api.js ends with `window.MC = api`, so the sandbox doubles as window.
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(API_SOURCE, sandbox, { filename: "mediclinic-api.js" });

  return { MC: sandbox.MC, calls };
}

test("manager notices use GET /notices/manage", async () => {
  const { MC, calls } = loadApi();
  await MC.managerNotices();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/backend/notices/manage");
  assert.equal(calls[0].settings.method, "GET");
});

test("creating a notice posts the backend NoticeRequest payload", async () => {
  const { MC, calls } = loadApi();
  await MC.createNotice({ title: "Clinic closed", body: "Sunday", published: true });

  assert.equal(calls[0].url, "/api/backend/notices");
  assert.equal(calls[0].settings.method, "POST");
  assert.match(calls[0].settings.headers.get("Content-Type"), /application\/json/);
  assert.deepEqual(JSON.parse(calls[0].settings.body), {
    title: "Clinic closed",
    body: "Sunday",
    published: true,
  });
});

test("walk-in booking posts the reception request payload", async () => {
  const { MC, calls } = loadApi();
  await MC.bookWalkIn({
    sessionId: "33333333-3333-3333-3333-333333333333",
    firstName: "Asha",
    lastName: "Perera",
    phone: "0712345678",
    reason: "Persistent headache",
  });

  assert.equal(calls[0].url, "/api/backend/admin/appointments/walk-in");
  assert.equal(calls[0].settings.method, "POST");
  assert.match(calls[0].settings.headers.get("Content-Type"), /application\/json/);
  assert.deepEqual(JSON.parse(calls[0].settings.body), {
    sessionId: "33333333-3333-3333-3333-333333333333",
    firstName: "Asha",
    lastName: "Perera",
    phone: "0712345678",
    reason: "Persistent headache",
  });
});

test("staff password reset posts the admin reset route", async () => {
  const { MC, calls } = loadApi();
  const userId = "44444444-4444-4444-4444-444444444444";
  await MC.resetStaffPassword(userId, {
    newPassword: "Temp@12345",
    confirmPassword: "Temp@12345",
  });

  assert.equal(
    calls[0].url,
    "/api/backend/admin/users/" + userId + "/reset-password"
  );
  assert.equal(calls[0].settings.method, "POST");
  assert.match(calls[0].settings.headers.get("Content-Type"), /application\/json/);
  assert.deepEqual(JSON.parse(calls[0].settings.body), {
    newPassword: "Temp@12345",
    confirmPassword: "Temp@12345",
  });
});

test("the signed-in doctor reads their own profile for the dashboard greeting", async () => {
  const { MC, calls } = loadApi();
  await MC.doctorProfile();

  assert.equal(calls[0].url, "/api/backend/doctor/profile");
  assert.equal(calls[0].settings.method, "GET");
});

test("guest doctor directory uses the public roster endpoint", async () => {
  const { MC, calls } = loadApi();
  await MC.doctorDirectory();

  assert.equal(calls[0].url, "/api/backend/public/doctors");
  assert.equal(calls[0].settings.method, "GET");
});

test("doctor feedback uses the doctor's public reviews endpoint", async () => {
  const { MC, calls } = loadApi();
  await MC.doctorReviews("doctor-1");

  assert.equal(calls[0].url, "/api/backend/doctors/doctor-1/reviews");
  assert.equal(calls[0].settings.method, "GET");
});

test("manager feedback uses GET /reviews/manage", async () => {
  const { MC, calls } = loadApi();
  await MC.managerReviews();
  assert.equal(calls[0].url, "/api/backend/reviews/manage");
  assert.equal(calls[0].settings.method, "GET");
});

test("approving feedback PATCHes /reviews/{id}/approve without a body", async () => {
  const { MC, calls } = loadApi();
  await MC.approveReview("11111111-1111-1111-1111-111111111111");

  assert.equal(
    calls[0].url,
    "/api/backend/reviews/11111111-1111-1111-1111-111111111111/approve"
  );
  assert.equal(calls[0].settings.method, "PATCH");
  assert.equal(calls[0].settings.body, undefined);
  assert.equal(calls[0].settings.headers.has("Content-Type"), false);
});

test("hiding feedback PATCHes /reviews/{id}/hide without a body", async () => {
  const { MC, calls } = loadApi();
  await MC.hideReview("22222222-2222-2222-2222-222222222222");

  assert.equal(
    calls[0].url,
    "/api/backend/reviews/22222222-2222-2222-2222-222222222222/hide"
  );
  assert.equal(calls[0].settings.method, "PATCH");
  assert.equal(calls[0].settings.body, undefined);
});

test("report overview passes the requested date range", async () => {
  const { MC, calls } = loadApi();
  await MC.reportOverview({ from: "2026-11-18", to: "2026-11-18" });

  assert.equal(
    calls[0].url,
    "/api/backend/reports/overview?from=2026-11-18&to=2026-11-18"
  );
  assert.equal(calls[0].settings.method, "GET");
});

test("server errors become a safe, generic message", async () => {
  const { MC } = loadApi({
    fetchImpl: () =>
      new Response("<!doctype html><title>Oops</title>", { status: 500 }),
  });

  await assert.rejects(
    () => MC.managerNotices(),
    (error) => {
      assert.equal(error.name, "MediChannelError");
      assert.equal(error.status, 500);
      assert.match(error.message, /unavailable/i);
      assert.doesNotMatch(error.message, /<!doctype/i);
      return true;
    }
  );
});

test("HTTP 401, 403, 404 keep specific safe messages", async () => {
  const cases = [
    [401, { message: "" }, /sign in again/i],
    [403, { message: "Managers only." }, /Managers only/],
    [404, {}, /could not be found/i],
  ];

  for (const [status, body, expected] of cases) {
    const { MC } = loadApi({ fetchImpl: () => jsonResponse(status, body) });
    await assert.rejects(
      () => MC.managerReviews(),
      (error) => {
        assert.equal(error.status, status);
        assert.match(error.message, expected);
        assert.doesNotMatch(error.message, /Incognito|session cookie/i);
        return true;
      }
    );
  }
});

test("HTTP 409, 422 and 429 map to safe, distinct messages", async () => {
  const cases = [
    [409, /conflicts with the current state/i],
    [422, /details provided are not valid/i],
    [429, /too many requests/i],
  ];

  for (const [status, expected] of cases) {
    const { MC } = loadApi({ fetchImpl: () => jsonResponse(status, {}) });
    await assert.rejects(
      () => MC.approveReview("11111111-1111-1111-1111-111111111111"),
      (error) => {
        assert.equal(error.status, status);
        assert.match(error.message, expected);
        return true;
      }
    );
  }
});

test("a backend error body without a message is never shown raw", async () => {
  const { MC } = loadApi({
    fetchImpl: () =>
      jsonResponse(409, {
        error: "duplicate key value violates unique constraint notices_title_key",
        stack: "org.postgresql.util.PSQLException",
      }),
  });

  await assert.rejects(
    () => MC.createNotice({ title: "x", body: "y", published: true }),
    (error) => {
      assert.equal(error.status, 409);
      assert.doesNotMatch(error.message, /duplicate key|PSQLException/i);
      assert.equal(error.body.error.includes("duplicate key"), true);
      return true;
    }
  );
});

test("a validation message from the backend is surfaced, not hidden", async () => {
  const { MC } = loadApi({
    fetchImpl: () =>
      jsonResponse(422, { message: "The body must not exceed 4000 characters." }),
  });

  await assert.rejects(
    () => MC.createNotice({ title: "x", body: "y", published: true }),
    (error) => {
      assert.equal(error.status, 422);
      assert.match(error.message, /4000 characters/);
      return true;
    }
  );
});

test("a non-JSON success body is returned as text so callers can reject it", async () => {
  const { MC } = loadApi({
    fetchImpl: () =>
      new Response("<html><body>proxy error</body></html>", { status: 200 }),
  });

  const body = await MC.managerNotices();
  assert.equal(typeof body, "string");
  assert.match(body, /proxy error/);
});

test("a non-JSON error body never reaches the user-facing message", async () => {
  const { MC } = loadApi({
    fetchImpl: () =>
      new Response("<html><body>Tomcat stack trace</body></html>", { status: 502 }),
  });

  await assert.rejects(
    () => MC.reportOverview(),
    (error) => {
      assert.equal(error.status, 502);
      assert.match(error.message, /unavailable/i);
      assert.doesNotMatch(error.message, /Tomcat|stack trace/i);
      return true;
    }
  );
});

test("network failures are reported without leaking internals", async () => {
  const { MC } = loadApi({
    fetchImpl: () => {
      throw new Error("ECONNREFUSED 10.0.0.1:8080");
    },
  });

  await assert.rejects(
    () => MC.reportOverview(),
    (error) => {
      assert.equal(error.status, 0);
      assert.match(error.message, /Unable to reach/);
      assert.doesNotMatch(error.message, /ECONNREFUSED/);
      return true;
    }
  );
});

test("browser API requests use this tab's bearer token and never carry it in the URL", async () => {
  let sessionStorageAccessed = false;
  const { MC, calls } = loadApi({
    tabToken: "tab-token",
    onSessionStorageGet(key) {
      if (key === "mc_tab_token") sessionStorageAccessed = true;
    },
  });
  await MC.managerNotices();

  assert.equal(sessionStorageAccessed, true);
  assert.equal(calls[0].settings.headers.get("Authorization"), "Bearer tab-token");
  assert.equal(calls[0].settings.headers.get("X-Medichannel-Tab"), "1");
  assert.equal(calls[0].settings.credentials, "same-origin");
  assert.doesNotMatch(calls[0].url, /token/i);
});

test("wsTicket requests ws-ticket through BFF with same-origin credentials and no Authorization header", async () => {
  const { MC, calls } = loadApi({
    fetchImpl: () => jsonResponse(200, { ticket: "temp-ticket", expiresInSeconds: 60 }),
  });
  const res = await MC.wsTicket();

  assert.equal(calls[0].url, "/api/backend/auth/ws-ticket");
  assert.equal(calls[0].settings.credentials, "same-origin");
  assert.equal(calls[0].settings.headers.has("Authorization"), false);
  assert.equal(res.ticket, "temp-ticket");
});

test("me() returns null without a tab token and does not call the server", async () => {
  const { MC, calls } = loadApi({
    fetchImpl: () => {
      throw new Error("anonymous sessions must not call /api/auth/me");
    },
  });
  assert.equal(await MC.me(), null);
  assert.equal(calls.length, 0);
});

test("me() parses JSON and reuses the shared error mapping", async () => {
  const { MC, calls } = loadApi({
    tabToken: "tab-token",
    fetchImpl: () => jsonResponse(200, { role: "MANAGER" }),
  });
  assert.deepEqual(await MC.me(), { role: "MANAGER" });
  assert.match(calls[0].settings.headers["Authorization"], /^Bearer tab-token$/);
  assert.equal(calls[0].settings.headers["X-Medichannel-Tab"], "1");

  const failing = loadApi({
    tabToken: "tab-token",
    fetchImpl: () => new Response("backend exploded", { status: 500 }),
  });
  await assert.rejects(
    () => failing.MC.me(),
    (error) => {
      assert.equal(error.status, 500);
      assert.doesNotMatch(error.message, /backend exploded/);
      return true;
    }
  );
});

test("requests carry a timeout signal without changing the public contract", async () => {
  const { MC, calls } = loadApi();
  await MC.specialisations();

  assert.equal(calls.length, 1);
  assert.ok(calls[0].settings.signal instanceof AbortSignal);
});

test("simultaneous identical reads share one in-flight request", async () => {
  const { MC, calls } = loadApi();
  const [first, second] = await Promise.all([
    MC.sessions(),
    MC.sessions(),
  ]);

  assert.deepEqual(first, second);
  assert.equal(calls.length, 1);

  // The dedupe cache is only for in-flight work; later reads are fresh.
  await MC.sessions();
  assert.equal(calls.length, 2);
});

test("me() also dedupes concurrent session checks", async () => {
  const { MC, calls } = loadApi({
    tabToken: "tab-token",
    fetchImpl: () => jsonResponse(200, { role: "DOCTOR" }),
  });
  const [first, second] = await Promise.all([MC.me(), MC.me()]);

  assert.deepEqual(first, { role: "DOCTOR" });
  assert.deepEqual(second, { role: "DOCTOR" });
  assert.equal(calls.length, 1);
});

test("patient booking posts only session, reason and period", async () => {
  const { MC, calls } = loadApi({
    tabToken: "tab-token",
    fetchImpl: () => jsonResponse(200, { appointmentId: "a1" }),
  });

  await MC.bookAppointment("session-1", "Chest pain for three days", "MORNING");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/backend/appointments");
  assert.equal(calls[0].settings.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].settings.body), {
    sessionId: "session-1",
    reason: "Chest pain for three days",
    period: "MORNING",
  });
});

test("chat messages use the REST fallback endpoint", async () => {
  const { MC, calls } = loadApi({
    tabToken: "tab-token",
    fetchImpl: () => jsonResponse(201, { messageId: "m1" }),
  });

  await MC.sendChatMessage("appointment-1", "Hello doctor");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/backend/appointments/appointment-1/chat/messages");
  assert.equal(calls[0].settings.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].settings.body), { content: "Hello doctor" });
});
