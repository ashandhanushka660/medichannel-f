import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SOURCE = readFileSync(
  new URL("../public/mediclinic-manager.js", import.meta.url),
  "utf8"
);
const HTML_SOURCE = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);

function loadManagerUI() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "mediclinic-manager.js" });
  return sandbox.window.MCManager;
}

const UI = loadManagerUI();

test("the manager create-session form covers the published clinic day", () => {
  assert.match(
    HTML_SOURCE,
    /<input id="sess-start" type="time" value="07:00"[^>]*>/
  );
  assert.match(
    HTML_SOURCE,
    /<input id="sess-end" type="time" value="16:00"[^>]*>/
  );
  assert.match(
    HTML_SOURCE,
    /<input id="sess-max" type="number" min="1" max="60" value="60"[^>]*>/
  );
});

test("notice payload matches the backend contract", () => {
  const result = UI.noticePayload("  Clinic closed  ", "  Sunday only  ");
  assert.equal(result.ok, true);

  const payload = JSON.parse(JSON.stringify(result.payload));
  assert.deepEqual(payload, {
    title: "Clinic closed",
    body: "Sunday only",
    published: true,
  });
  assert.equal("active" in payload, false);
});

test("notice limits mirror NoticeRequest (150 / 4000)", () => {
  assert.equal(UI.NOTICE_LIMITS.title, 150);
  assert.equal(UI.NOTICE_LIMITS.body, 4000);

  assert.equal(UI.noticePayload("a".repeat(150), "b").ok, true);
  const longTitle = UI.noticePayload("a".repeat(151), "b");
  assert.equal(longTitle.ok, false);
  assert.match(longTitle.message, /150/);

  assert.equal(UI.noticePayload("a", "b".repeat(4000)).ok, true);
  const longBody = UI.noticePayload("a", "b".repeat(4001));
  assert.equal(longBody.ok, false);
  assert.match(longBody.message, /4000/);
});

test("notice validation reports missing fields without submitting", () => {
  assert.match(UI.noticePayload("", "").message, /Enter a title and notice body/);
  assert.match(UI.noticePayload("Only title", "").message, /body is required/i);
  assert.match(UI.noticePayload("", "Only body").message, /title is required/i);
  assert.equal(UI.noticePayload("", "").payload, undefined);
});

test("staff password payload mirrors ResetStaffPasswordRequest", () => {
  assert.equal(UI.STAFF_PASSWORD.minLength, 8);
  assert.equal(UI.STAFF_PASSWORD.maxBytes, 72);

  const result = UI.staffPasswordPayload("Temp@12345", "Temp@12345");
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.payload)), {
    newPassword: "Temp@12345",
    confirmPassword: "Temp@12345",
  });
});

test("staff password validation rejects weak, mismatched and oversized values", () => {
  assert.match(
    UI.staffPasswordPayload("", "").message,
    /new password is required/i
  );
  assert.match(
    UI.staffPasswordPayload("Temp@12345", "Temp@12346").message,
    /do not match/i
  );
  assert.match(
    UI.staffPasswordPayload("Ab1@", "Ab1@").message,
    /at least 8 characters/i
  );
  assert.match(
    UI.staffPasswordPayload("Password1", "Password1").message,
    /one symbol/i
  );
  assert.match(
    UI.staffPasswordPayload("a".repeat(73), "a".repeat(73)).message,
    /72 UTF-8 bytes/i
  );
});

test("dashboard metrics come from the reports payload", () => {
  const metrics = UI.dashboardMetrics({
    todaySessions: [
      { doctorName: "A. Perera", completed: 3, booked: 5 },
      { doctorName: "A. Perera", completed: 1, booked: 2 },
      { doctorName: "B. Silva", completed: 2, booked: 4 },
    ],
    cancelledAppointments: 2,
    totalAppointments: 13,
    physicalAppointments: 8,
    onlineAppointments: 5,
    revenueLkr: 12500.5,
  });

  assert.equal(metrics.sessionsToday, 3);
  assert.equal(metrics.doctorsToday, 2);
  assert.equal(metrics.completedToday, 6);
  assert.equal(metrics.cancelledToday, 2);
  assert.equal(metrics.appointmentsToday, 13);
  assert.equal(metrics.physicalAppointments, 8);
  assert.equal(metrics.onlineAppointments, 5);
  assert.equal(metrics.revenueLkr, 12500.5);
});

test("missing report fields stay null instead of becoming zero", () => {
  const metrics = UI.dashboardMetrics({});

  for (const key of [
    "sessionsToday",
    "doctorsToday",
    "completedToday",
    "cancelledToday",
    "appointmentsToday",
    "physicalAppointments",
    "onlineAppointments",
    "revenueLkr",
  ]) {
    assert.equal(metrics[key], null, key + " must be null when absent");
  }

  assert.equal(UI.formatCount(metrics.sessionsToday), "—");
  assert.equal(UI.formatLkr(metrics.revenueLkr), "—");
  assert.equal(UI.formatTypeSplit(metrics), "—");
});

test("an absent report is never treated as a real zero", () => {
  assert.equal(UI.dashboardMetrics(null).revenueLkr, null);
  assert.equal(UI.dashboardMetrics(undefined).appointmentsToday, null);
  assert.equal(UI.formatLkr(null), "—");
  assert.equal(UI.formatLkr(undefined), "—");
  assert.equal(UI.formatLkr(""), "—");
});

test("real zeros are still displayed as zeros", () => {
  const metrics = UI.dashboardMetrics({
    todaySessions: [],
    cancelledAppointments: 0,
    totalAppointments: 0,
    physicalAppointments: 0,
    onlineAppointments: 0,
    revenueLkr: 0,
  });

  assert.equal(metrics.sessionsToday, 0);
  assert.equal(UI.formatCount(metrics.sessionsToday), "0");
  assert.equal(UI.formatLkr(metrics.revenueLkr), "LKR 0.00");
});

test("a session without a completed count makes the total unknown, not partial", () => {
  const metrics = UI.dashboardMetrics({
    todaySessions: [{ doctorName: "A", completed: 2 }, { doctorName: "B" }],
  });
  assert.equal(metrics.completedToday, null);
});

test("sessions without doctor names do not fabricate a doctor count", () => {
  const metrics = UI.dashboardMetrics({ todaySessions: [{ completed: 1 }] });
  assert.equal(metrics.doctorsToday, null);

  assert.equal(UI.dashboardMetrics({ todaySessions: [] }).doctorsToday, 0);
});

test("dashboard metrics expose no fabricated active-doctor figure", () => {
  const metrics = UI.dashboardMetrics({
    todaySessions: [{ doctorName: "A", status: "OPEN" }],
  });
  assert.equal("doctorsActiveNow" in metrics, false);
  assert.equal("activeDoctors" in metrics, false);
});

test("currency renders as LKR with grouping and two decimals", () => {
  assert.equal(UI.formatLkr(1500), "LKR 1,500.00");
  assert.equal(UI.formatLkr("1250.50"), "LKR 1,250.50");
  assert.equal(UI.formatLkr(0), "LKR 0.00");
});

test("physical / online split reads both report fields", () => {
  assert.equal(
    UI.formatTypeSplit({ physicalAppointments: 8, onlineAppointments: 5 }),
    "8 / 5"
  );
  assert.equal(
    UI.formatTypeSplit({ physicalAppointments: null, onlineAppointments: 5 }),
    "—"
  );
});

test("dashboard card values keep zero and unavailable distinct", () => {
  const zeros = UI.dashboardCardValues({
    sessionsToday: 0,
    doctorsToday: 0,
    completedToday: 0,
    cancelledToday: 0,
    appointmentsToday: 0,
    physicalAppointments: 0,
    onlineAppointments: 0,
    revenueLkr: 0,
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(zeros)),
    {
      sessionsToday: "0",
      doctorsToday: "0",
      completedToday: "0",
      cancelledToday: "0",
      appointmentsToday: "0",
      typeSplit: "0 / 0",
      revenue: "LKR 0.00",
    }
  );

  const unavailable = UI.dashboardCardValues(UI.dashboardMetrics(null));
  for (const key of Object.keys(unavailable)) {
    assert.equal(unavailable[key], "—", key + " must not be a fake zero");
  }
});

test("dashboard card values format real figures for display", () => {
  const values = UI.dashboardCardValues(
    UI.dashboardMetrics({
      todaySessions: [
        { doctorName: "A. Perera", completed: 4 },
        { doctorName: "A. Perera", completed: 1 },
        { doctorName: "B. Silva", completed: 2 },
      ],
      cancelledAppointments: 3,
      totalAppointments: 12,
      physicalAppointments: 7,
      onlineAppointments: 5,
      revenueLkr: 48250,
    })
  );

  assert.equal(values.sessionsToday, "3");
  assert.equal(values.doctorsToday, "2");
  assert.equal(values.completedToday, "7");
  assert.equal(values.cancelledToday, "3");
  assert.equal(values.appointmentsToday, "12");
  assert.equal(values.typeSplit, "7 / 5");
  assert.equal(values.revenue, "LKR 48,250.00");
});

function fakeNoticeForm() {
  const focused = [];
  const form = {
    hidden: true,
    elements: {
      title: { focus: () => focused.push("title") },
      body: { focus: () => focused.push("body") },
    },
    focusLog: focused,
  };
  const toggle = {
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    focus() {
      focused.push("toggle");
    },
  };
  return { form, toggle };
}

test("opening the notice form focuses the title and sets aria-expanded", () => {
  const { form, toggle } = fakeNoticeForm();
  UI.applyNoticeFormState({ form, toggle, open: true });

  assert.equal(form.hidden, false);
  assert.equal(toggle.attributes["aria-expanded"], "true");
  assert.deepEqual(form.focusLog, ["title"]);
});

test("closing the notice form returns focus to the toggle", () => {
  const { form, toggle } = fakeNoticeForm();
  UI.applyNoticeFormState({ form, toggle, open: false });

  assert.equal(form.hidden, true);
  assert.equal(toggle.attributes["aria-expanded"], "false");
  assert.deepEqual(form.focusLog, ["toggle"]);
});

test("cancelling or publishing without a toggle still closes the form", () => {
  const { form } = fakeNoticeForm();
  assert.equal(UI.applyNoticeFormState({ form, open: false }), true);
  assert.equal(form.hidden, true);
});

test("lockAction blocks duplicate submissions until unlocked", () => {
  const button = { disabled: false, dataset: {} };

  assert.equal(UI.lockAction(button), true);
  assert.equal(button.disabled, true);
  assert.equal(UI.lockAction(button), false, "second click must be ignored");

  UI.unlockAction(button);
  assert.equal(button.disabled, false);
  assert.equal(UI.lockAction(button), true);
});

test("escapeHtml neutralises markup from API values", () => {
  assert.equal(
    UI.escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
  assert.equal(UI.escapeHtml(null), "");
});
