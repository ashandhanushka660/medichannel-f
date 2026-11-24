import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const HTML = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);
const APP = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const API = readFileSync(
  new URL("../public/mediclinic-api.js", import.meta.url),
  "utf8"
);

function tagWithAttribute(marker) {
  const match = HTML.match(new RegExp(`<[^>]*${marker}[^>]*>`));
  return match ? match[0] : "";
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

test("manager interface owns notice creation and publishing controls", () => {
  assert.match(HTML, /href="#manager-n" data-panel-link class="sa">Notices/);
  assert.match(APP, /async function loadManagerNotices/);
  assert.match(APP, /async function saveManagerNotice/);
  assert.match(APP, /function renderManagerNotice/);
  assert.match(APP, /async function handleManagerNoticeAction/);
  assert.match(APP, /function confirmManagerNoticeDelete/);
  assert.match(APP, /MC\.createNotice\(payload\)/);
  assert.match(APP, /MC\.publishNotice\(id\)/);
  assert.match(APP, /MC\.withdrawNotice\(id\)/);
  assert.match(APP, /MC\.deleteNotice\(id\)/);
});

test("admin panel has no notice publishing or CRUD controls", () => {
  assert.doesNotMatch(APP, /function ensureAdminNoticesPanel/);
  assert.doesNotMatch(APP, /async function loadAdminNotices/);
  assert.doesNotMatch(APP, /async function saveAdminNotice/);
  assert.doesNotMatch(APP, /function renderAdminNotice/);
  assert.doesNotMatch(APP, /async function handleAdminNoticeAction/);
  assert.doesNotMatch(APP, /data-admin-notice/);
  assert.doesNotMatch(APP, /data-admin-notices/);
  assert.doesNotMatch(APP, /state\.adminNotices/);
  assert.doesNotMatch(HTML, /href="#admin-n"/);
  assert.match(HTML, /id="manager-x"[\s\S]*?<h3 class="font-semibold text-ink">Patient feedback<\/h3>/);
});

test("admin staff table exposes password reset for doctors and managers", () => {
  assert.match(APP, /data-reset-user=/);
  assert.match(
    APP,
    /const canResetPassword =\s*member\.role === "DOCTOR" \|\| member\.role === "MANAGER"/
  );
  assert.match(APP, /closest\("\[data-reset-user\]"\)/);
  assert.match(APP, /openResetPassword\(resetUserBtn\.getAttribute\("data-reset-user"\)\)/);
  // The manager directory remains read-only.
  assert.match(APP, /renderStaffRows\(managerTbody, false\)/);
});

test("reset password dialog validates and posts through the staff API", () => {
  assert.match(HTML, /<dialog id="reset-password-dialog"/);
  assert.match(HTML, /<form id="reset-password-form"/);

  for (const marker of [
    "data-reset-email",
    "data-reset-password",
    "data-reset-confirm",
    "data-reset-show",
    "data-reset-status",
    "data-reset-cancel",
    "data-reset-submit",
  ]) {
    assert.match(HTML, new RegExp(marker), "missing " + marker);
  }

  assert.match(APP, /ManagerUI\.staffPasswordPayload\(/);
  assert.match(APP, /ManagerUI\.lockAction\(submit\)/);
  assert.match(APP, /MC\.resetStaffPassword\(/);
  assert.match(APP, /Password reset for /);
  assert.match(APP, /loadOnce\(loadAuditLogs\)/);
  assert.match(API, /resetStaffPassword\(userId, payload\)/);
  assert.match(API, /\/reset-password"/);
});

test("walk-in booking button opens a complete reception booking dialog", () => {
  const button = tagWithAttribute("data-open-walkin");
  assert.match(button, /type="button"/);
  assert.match(HTML, /<dialog id="walkin-dialog"/);
  assert.match(HTML, /<form id="walkin-form"/);

  for (const marker of [
    "data-walkin-session",
    "data-walkin-first-name",
    "data-walkin-last-name",
    "data-walkin-phone",
    "data-walkin-reason",
    "data-walkin-status",
    "data-walkin-cancel",
    "data-walkin-submit",
  ]) {
    assert.match(HTML, new RegExp(marker), "missing " + marker);
  }

  assert.match(
    APP,
    /closest\("\[data-open-walkin\]"\)\s*\)\s*\{\s*openWalkInDialog\(\);/
  );
  assert.match(APP, /walkinForm\.addEventListener\("submit"/);
  assert.match(APP, /data-walkin-cancel\]\"\);/);
});

test("walk-in submission validates the phone and uses the staff API", () => {
  const start = APP.indexOf("async function submitWalkIn");
  assert.ok(start > -1, "submitWalkIn is missing");
  const block = APP.slice(start, start + 2600);

  assert.match(block, /\^07\[0-9\]\{8\}\$/);
  assert.match(block, /ManagerUI\.lockAction\(submit\)/);
  assert.match(block, /MC\.bookWalkIn\(\{/);
  assert.match(block, /loadManagerReception\(\{ silent: true \}\)/);
  assert.match(block, /loadManagerSessions\(\)/);
  assert.match(API, /bookWalkIn\(payload\)/);
  assert.match(API, /request\("admin\/appointments\/walk-in"/);
});

test("dashboard exposes a live status region and real metric slots", () => {
  const status = tagWithAttribute("data-manager-dashboard-status");
  assert.equal(attribute(status, "role"), "status");
  assert.equal(attribute(status, "aria-live"), "polite");

  for (const slot of [
    "data-manager-sessions-today",
    "data-manager-doctors-today",
    "data-manager-completed-today",
    "data-manager-cancelled-today",
    "data-manager-appointments-today",
    "data-manager-type-split",
    "data-manager-revenue-today",
  ]) {
    assert.match(HTML, new RegExp(slot), "missing " + slot);
  }

  assert.doesNotMatch(HTML, /data-manager-doctors-now/);
  assert.doesNotMatch(HTML, /data-manager-live-queue-serving/);
});

test("manager helpers load before the application script", () => {
  const manager = HTML.indexOf("/mediclinic-manager.js?v=");
  const app = HTML.search(/\/mediclinic-app(?:\.min)?\.js\?v=/);
  assert.ok(manager > -1, "manager helper script missing");
  assert.ok(app > -1, "application script missing");
  assert.ok(manager < app, "helpers must load before mediclinic-app.js");
});

test("dashboard no longer estimates revenue from session capacity", () => {
  assert.doesNotMatch(APP, /maxAppointments \|\| 0\)\s*-\s*\(s\.remainingAppointments/);
  assert.doesNotMatch(APP, /s\.feeLkr/);
  assert.doesNotMatch(APP, /totalRevenueToday/);
  assert.match(APP, /MC\.reportOverview\(\{\s*from: today, to: today\s*\}\)/);
  assert.match(APP, /ManagerUI\.dashboardMetrics\(report\)/);
  assert.match(APP, /ManagerUI\.dashboardCardValues\(metrics\)/);
  assert.match(APP, /data-manager-revenue-today/);
});

test("dashboard no longer derives active doctors from the public sessions feed", () => {
  assert.doesNotMatch(APP, /doctorsActiveNow/);
  assert.doesNotMatch(APP, /data-manager-doctors-now/);
});

test("notice and review rendering use the backend field names", () => {
  const noticeStart = APP.indexOf("function renderManagerNotice");
  assert.ok(noticeStart > -1, "renderManagerNotice is missing");
  const noticeBlock = APP.slice(noticeStart, noticeStart + 1600);

  assert.match(noticeBlock, /Boolean\(notice\.published\)/);
  assert.match(noticeBlock, /badge\(published \?/);
  assert.doesNotMatch(APP, /notice\.active/);
  assert.match(APP, /review\.reviewId/);
  assert.match(APP, /review\.moderationStatus/);
  assert.doesNotMatch(APP, /review\.status/);
  assert.doesNotMatch(APP, /review\.id\b/);
});

test("manager notice save and moderation are protected against duplicate clicks", () => {
  assert.match(
    APP,
    /async function saveManagerNotice[\s\S]{0,900}?ManagerUI\.lockAction\(submit\)/
  );
  assert.match(
    APP,
    /async function moderateManagerReview[\s\S]{0,900}?ManagerUI\.lockAction\(button\)/
  );
  assert.match(APP, /form\.dataset\.busy = "true"/);
});

test("API client targets only the verified backend routes", () => {
  assert.match(API, /request\("notices\/manage"\)/);
  assert.doesNotMatch(API, /manager\/notices/);
  assert.match(API, /request\("reviews\/manage"/);
  assert.doesNotMatch(API, /feedback\/moderation/);
  assert.match(API, /"reviews\/" \+ encodeURIComponent\(reviewId\) \+ "\/approve"/);
  assert.match(API, /"reviews\/" \+ encodeURIComponent\(reviewId\) \+ "\/hide"/);
  assert.doesNotMatch(API, /status: "APPROVED"/);
  assert.doesNotMatch(API, /status: "HIDDEN"/);
});

test("the audit-log error row escapes the message before interpolation", () => {
  const start = APP.indexOf("async function loadAuditLogs");
  assert.ok(start > -1, "loadAuditLogs is missing");
  const block = APP.slice(start, start + 900);

  assert.match(block, /escapeHtml\(err\.message \|\| "Unknown error"\)/);
  assert.doesNotMatch(
    block,
    /\$\{err\.message \|\| "Unknown error"\}/,
    "the raw error message must not be interpolated into innerHTML"
  );
});

test("manager table cells escape backend values, including queue numbers", () => {
  assert.match(APP, /escapeHtml\(s\.queue\.nowServing\)/);
  assert.match(APP, /escapeHtml\(s\.queue && s\.queue\.nextNumber/);
  assert.match(APP, /Failed to load sessions: \$\{message\}/);
});

test("manager notice save and action feedback is written to visible status regions", () => {
  const saveStart = APP.indexOf("async function saveManagerNotice");
  assert.ok(saveStart > -1, "saveManagerNotice is missing");
  const saveBlock = APP.slice(saveStart, saveStart + 2600);
  assert.match(saveBlock, /Notice updated successfully\.|Notice published successfully\./);
  assert.match(saveBlock, /data-manager-notices-status/);

  const actionStart = APP.indexOf("async function handleManagerNoticeAction");
  assert.ok(actionStart > -1, "handleManagerNoticeAction is missing");
  const actionBlock = APP.slice(actionStart, actionStart + 2600);
  assert.match(actionBlock, /Notice deleted successfully\./);
  assert.match(actionBlock, /Could not " \+ action \+ " notice: "/);
  assert.match(actionBlock, /data-manager-notices-status/);
});

test("dashboard cards use the tested formatter and honest labels", () => {
  assert.match(APP, /setManagerDashboardCards\(ManagerUI\.dashboardCardValues\(metrics\)\)/);
  assert.match(HTML, /<span>Doctors scheduled today<\/span>/);
  assert.doesNotMatch(HTML, /Doctors active today/);
  assert.match(HTML, /include cancelled bookings/);
  assert.match(HTML, /revenue counts completed payments only/);
});

test("new doctor accounts can sign in without a forced password change", () => {
  assert.match(
    APP,
    /The doctor account is active immediately and can sign in with this password\./
  );
  assert.match(
    HTML,
    /The doctor account is active immediately and can sign in with this password\./
  );
  assert.doesNotMatch(APP, /must change it at first login/);
  assert.doesNotMatch(HTML, /must change it at first login/);
});

test("feedback list has its own heading for assistive technology", () => {
  assert.match(HTML, /<h3 class="font-semibold text-ink">Patient feedback<\/h3>/);
});

test("dashboard failure path clears figures and reports a safe error", () => {
  const start = APP.indexOf("async function loadManagerDashboard");
  assert.ok(start > -1, "loadManagerDashboard is missing");
  const block = APP.slice(start, start + 2400);

  // A failed report must not leave stale numbers or a fake zero behind.
  assert.match(block, /dashboardFetchedAt = 0/);
  assert.match(block, /revenue: "—"/);
  assert.match(block, /The dashboard values are unavailable\./);
  assert.match(block, /return false;/);
  // Only the backend payload is used; nothing is recomputed locally.
  assert.doesNotMatch(block, /maxAppointments|remainingAppointments|feeLkr/);
});
