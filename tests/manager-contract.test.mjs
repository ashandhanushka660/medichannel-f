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

test("notice form is labelled and keeps its toggle relationships", () => {
  const toggle = tagWithAttribute("data-manager-notice-toggle");
  assert.match(toggle, /<button\b/);
  assert.equal(attribute(toggle, "aria-controls"), "manager-notice-form");
  assert.equal(attribute(toggle, "aria-expanded"), "false");

  const form = tagWithAttribute('id="manager-notice-form"');
  assert.match(form, /<form\b/);
  assert.equal(
    attribute(form, "aria-labelledby"),
    "manager-notice-form-heading"
  );
  assert.match(
    HTML,
    /<h3 id="manager-notice-form-heading" class="sr-only">Publish a hospital notice<\/h3>/
  );
});

test("notice fields keep labels and match the backend limits", () => {
  const title = tagWithAttribute('id="manager-notice-title"');
  const body = tagWithAttribute('id="manager-notice-body"');

  assert.equal(attribute(title, "maxlength"), "150");
  assert.equal(attribute(body, "maxlength"), "4000");
  assert.match(title, /\brequired\b/);
  assert.match(body, /\brequired\b/);

  assert.match(HTML, /<label for="manager-notice-title">Notice title<\/label>/);
  assert.match(HTML, /<label for="manager-notice-body">Notice body<\/label>/);
  assert.equal(attribute(title, "aria-describedby"), "manager-notice-limits");
  assert.equal(attribute(body, "aria-describedby"), "manager-notice-limits");
  assert.match(HTML, /id="manager-notice-limits"[^>]*>Title up to 150 characters/);
});

test("notice status stays a polite live region the form can unhide", () => {
  const status = tagWithAttribute("data-manager-notice-status");
  assert.match(status, /<output\b/);
  assert.equal(attribute(status, "aria-live"), "polite");
  assert.match(status, /\bhidden\b/);
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
  assert.match(APP, /badge\(notice\.published \?/);
  assert.doesNotMatch(APP, /notice\.active/);
  assert.match(APP, /review\.reviewId/);
  assert.match(APP, /review\.moderationStatus/);
  assert.doesNotMatch(APP, /review\.status/);
  assert.doesNotMatch(APP, /review\.id\b/);
});

test("focus returns to the toggle when the form closes", () => {
  assert.match(
    APP,
    /ManagerUI\.applyNoticeFormState\(\{[\s\S]{0,220}?open: false,/
  );
  assert.match(APP, /ManagerUI\.applyNoticeFormState\(\{[\s\S]{0,220}?open: form\.hidden,/);
});

test("publishing and moderation are protected against duplicate clicks", () => {
  assert.match(
    APP,
    /async function publishManagerNotice[\s\S]{0,900}?ManagerUI\.lockAction\(submit\)/
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

test("publish feedback is written to a region that stays visible", () => {
  const start = APP.indexOf("async function publishManagerNotice");
  assert.ok(start > -1);
  const block = APP.slice(start, start + 2200);

  // The form (and its <output>) is hidden on success, so the result must go
  // to the notices list status, not the in-form output.
  assert.match(block, /successMessage: "Notice published successfully\."/);
  assert.match(block, /data-manager-notices-status/);
  assert.match(block, /if \(status\) setStatus\(status, ""\)/);
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
