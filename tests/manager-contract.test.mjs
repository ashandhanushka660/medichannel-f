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

test("manager interface no longer includes notice creation or publishing controls", () => {
  assert.doesNotMatch(HTML, /data-manager-notice-toggle/);
  assert.doesNotMatch(HTML, /id="manager-notice-form"/);
  assert.doesNotMatch(HTML, /data-manager-notice-status/);
  assert.doesNotMatch(HTML, /data-manager-notices-status/);
  assert.doesNotMatch(HTML, /Publish a hospital notice/);
  assert.doesNotMatch(APP, /async function publishManagerNotice/);
  assert.doesNotMatch(APP, /async function loadManagerNotices/);
  assert.doesNotMatch(APP, /function renderManagerNotice/);
  assert.doesNotMatch(APP, /data-manager-notice-toggle/);
  assert.doesNotMatch(APP, /data-manager-notice-form/);
});

test("admin notices management and delete confirmation are implemented", () => {
  assert.match(APP, /async function loadAdminNotices/);
  assert.match(APP, /async function saveAdminNotice/);
  assert.match(APP, /function renderAdminNotice/);
  assert.match(APP, /async function handleAdminNoticeAction/);
  assert.match(APP, /function confirmAdminNoticeDelete/);
  assert.match(APP, /Delete this notice\? This cannot be undone\./);
  assert.match(APP, /"Yes"/);
  assert.match(APP, /"No"/);
  assert.match(APP, /MC\.deleteNotice\(id\)/);
  assert.match(HTML, /id="manager-x"[\s\S]*?<h3 class="font-semibold text-ink">Patient feedback<\/h3>/);
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
  const app = HTML.indexOf("/mediclinic-app.js?v=");
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
  const noticeStart = APP.indexOf("function renderAdminNotice");
  assert.ok(noticeStart > -1, "renderAdminNotice is missing");
  const noticeBlock = APP.slice(noticeStart, noticeStart + 1600);

  assert.match(noticeBlock, /Boolean\(notice\.published\)/);
  assert.match(noticeBlock, /badge\(published \?/);
  assert.doesNotMatch(APP, /notice\.active/);
  assert.match(APP, /review\.reviewId/);
  assert.match(APP, /review\.moderationStatus/);
  assert.doesNotMatch(APP, /review\.status/);
  assert.doesNotMatch(APP, /review\.id\b/);
});

test("admin notice save and moderation are protected against duplicate clicks", () => {
  assert.match(
    APP,
    /async function saveAdminNotice[\s\S]{0,900}?ManagerUI\.lockAction\(submit\)/
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

test("admin notice save and action feedback is written to visible status regions", () => {
  const saveStart = APP.indexOf("async function saveAdminNotice");
  assert.ok(saveStart > -1, "saveAdminNotice is missing");
  const saveBlock = APP.slice(saveStart, saveStart + 2600);
  assert.match(saveBlock, /Notice updated successfully\.|Notice published successfully\./);
  assert.match(saveBlock, /data-admin-notices-status/);

  const actionStart = APP.indexOf("async function handleAdminNoticeAction");
  assert.ok(actionStart > -1, "handleAdminNoticeAction is missing");
  const actionBlock = APP.slice(actionStart, actionStart + 2600);
  assert.match(actionBlock, /Notice deleted successfully\./);
  assert.match(actionBlock, /Could not " \+ action \+ " notice: "/);
  assert.match(actionBlock, /data-admin-notices-status/);
});

test("dashboard cards use the tested formatter and honest labels", () => {
  assert.match(APP, /setManagerDashboardCards\(ManagerUI\.dashboardCardValues\(metrics\)\)/);
  assert.match(HTML, /<span>Doctors scheduled today<\/span>/);
  assert.doesNotMatch(HTML, /Doctors active today/);
  assert.match(HTML, /include cancelled bookings/);
  assert.match(HTML, /revenue counts completed payments only/);
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
