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

test("public notice cards use the project colour tokens", () => {
  const start = APP.indexOf("function renderPublicNotices");
  const block = APP.slice(start, start + 6000);

  // Brand tokens live in the Tailwind config inside mediclinic-system.html:
  // brand, brand-d, peach, peach-d, ok, bad, snow, line, ink, slate2, mute.
  assert.doesNotMatch(
    block,
    /\b(?:text|bg|border|from|to|ring)-(?:blue|indigo|navy|slate|amber|emerald|gray|zinc|stone|neutral)-/,
    "public notices must not use Tailwind palette colours outside the project tokens"
  );
  assert.doesNotMatch(block, /#[0-9a-f]{6}\b/i, "public notices must not hard-code hex colours");
  assert.match(block, /text-brand-d/);
  assert.match(block, /bg-brand-d/);
  assert.match(block, /border-line/);
});
