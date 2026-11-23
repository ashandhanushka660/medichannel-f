import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const html = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);

test("audit log renderer uses privacy-safe user IDs", () => {
  assert.doesNotMatch(app, /log\.userEmail/);
  assert.match(app, /log\.userId/);
  assert.match(html, /<th>User ID<\/th>/);
});

test("audit log live subscription is admin-only", () => {
  const guard = app.match(/function subscribeAdminAuditLogs\(\) \{([\s\S]{0,700}?)\n  \}/);
  assert.ok(guard, "audit subscription function was not found");
  assert.match(guard[1], /S\.role !== "ADMIN"/);
  assert.doesNotMatch(guard[1], /S\.role !== "MANAGER"/);
});
