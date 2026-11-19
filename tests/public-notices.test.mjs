import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);

test("public notice timestamps are rendered as calendar dates", () => {
  const start = APP.indexOf("function renderPublicNotices");
  assert.ok(start > -1, "renderPublicNotices is missing");
  const block = APP.slice(start, start + 6000);

  // `formatDate` appends T00:00:00, so passing a full ISO timestamp to it
  // returns the raw string (previously shown as "2026-11-18T17:58:24Z").
  assert.match(block, /formatNoticeDate\(notice\.publishedAt \|\| notice\.createdAt\)/);
  assert.doesNotMatch(block, /formatDate\(notice\.publishedAt/);
});

test("public notice cards list one per row with an author byline", () => {
  const start = APP.indexOf("function renderPublicNotices");
  const block = APP.slice(start, start + 6000);

  assert.match(block, /list\.className = "grid gap-6"/);
  assert.doesNotMatch(block, /sm:grid-cols-2/);
  assert.match(block, /"By " \+ String\(notice\.createdByName \|\| "Hospital administration"\)/);
});
