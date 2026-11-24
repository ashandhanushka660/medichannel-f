import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const APP = read("../public/mediclinic-app.js");
const HTML = read("../public/mediclinic-system.html");

function functionSource(name) {
  const asyncStart = APP.indexOf(`async function ${name}(`);
  const plainStart = APP.indexOf(`function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : plainStart;
  assert.ok(start >= 0, `${name} was not found`);

  let depth = 0;
  let started = false;
  for (let i = start; i < APP.length; i += 1) {
    const char = APP[i];
    if (char === "{") {
      depth += 1;
      started = true;
    } else if (char === "}") {
      depth -= 1;
      if (started && depth === 0) return APP.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated function: ${name}`);
}

function helpers() {
  const names = [
    "parseISODate",
    "addISODays",
    "sessionRangeOptions",
    "sessionSearchRange",
    "sessionWeekChunks",
  ];
  return new Function(`
    const MAX_SESSION_RANGE_WEEKS = 26;
    const todayISO = () => "2026-11-24";
    const formatDate = (value) => value;
    ${names.map(functionSource).join("\n")}
    return { ${names.join(", ")} };
  `)();
}

test("the search form and manager table offer the Sessions for selector", () => {
  assert.match(HTML, /<label for="index-range">Sessions for:<\/label>/);
  assert.match(HTML, /<select id="index-range">/);
  assert.match(HTML, /<label for="manager-session-range"[^>]*>Sessions for:<\/label>/);
  assert.match(HTML, /<select id="manager-session-range"/);
  assert.match(HTML, /<label for="manager-session-date"[^>]*>Sessions from<\/label>/);
  assert.match(HTML, /Shows the 7 days from this date\./);
});

test("the range selector runs from one week to six months week by week", () => {
  const { sessionRangeOptions } = helpers();
  const options = sessionRangeOptions();

  assert.equal(options.length, 26);
  assert.deepEqual(options.slice(0, 4), [
    { weeks: 1, label: "Next week" },
    { weeks: 2, label: "Next two weeks" },
    { weeks: 3, label: "Next three weeks" },
    { weeks: 4, label: "Next month (4 weeks)" },
  ]);
  assert.deepEqual(options[25], { weeks: 26, label: "Next six months" });
  assert.deepEqual(options[4], { weeks: 5, label: "Next 5 weeks" });
  assert.equal(options[25].weeks * 7, 182);
});

test("a typed date opens a seven-day week starting on that date", () => {
  const { sessionSearchRange } = helpers();

  assert.deepEqual(sessionSearchRange("2026-11-24", "1"), {
    from: "2026-11-24",
    to: "2026-11-30",
    weeks: 1,
  });
  assert.deepEqual(sessionSearchRange("2026-12-01", "1"), {
    from: "2026-12-01",
    to: "2026-12-07",
    weeks: 1,
  });
});

test("longer ranges stay inclusive and are capped at six months", () => {
  const { sessionSearchRange } = helpers();

  assert.deepEqual(sessionSearchRange("2026-12-01", "3"), {
    from: "2026-12-01",
    to: "2026-12-21",
    weeks: 3,
  });
  assert.deepEqual(sessionSearchRange("2026-12-01", "99"), {
    from: "2026-12-01",
    to: "2027-05-31",
    weeks: 26,
  });
  assert.deepEqual(sessionSearchRange("", "0"), {
    from: "2026-11-24",
    to: "2026-11-30",
    weeks: 1,
  });
});

test("results are split into consecutive seven-day week chunks", () => {
  const { sessionWeekChunks } = helpers();
  const chunks = sessionWeekChunks("2026-11-24", 3);

  assert.deepEqual(
    chunks.map((chunk) => [chunk.from, chunk.to]),
    [
      ["2026-11-24", "2026-11-30"],
      ["2026-12-01", "2026-12-07"],
      ["2026-12-08", "2026-12-14"],
    ]
  );
  assert.equal(chunks[0].label, "Week 1 · 2026-11-24 – 2026-11-30");
  assert.equal(chunks[2].label, "Week 3 · 2026-12-08 – 2026-12-14");
});

test("both dashboards request the range and render week separators", () => {
  assert.match(APP, /const requestFilters = \{[\s\S]{0,200}from: range\.from,\s*to: range\.to/);
  assert.match(APP, /MC\.sessions\(requestFilters\)/);
  assert.match(APP, /MC\.sessions\(\{ from: range\.from, to: range\.to \}\)/);
  assert.match(APP, /sessionWeekChunks\(range\.from, range\.weeks\)/);
  assert.match(APP, /escapeHtml\(chunk\.label\)/);
  assert.match(APP, /event\.target\.id === "index-range"/);
  assert.match(APP, /event\.target\.id === "manager-session-range"/);
});
