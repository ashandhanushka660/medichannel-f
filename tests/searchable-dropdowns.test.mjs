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

test("every select with more than ten options opens an in-dropdown search", () => {
  assert.match(APP, /SEARCHABLE_SELECT_MIN_OPTIONS = 10/);
  assert.match(APP, /select\.options\.length > SEARCHABLE_SELECT_MIN_OPTIONS/);
  // The enhancement is delegated, so dynamically populated selects work too.
  assert.match(APP, /document\.addEventListener\(\s*"pointerdown"/);
  assert.match(APP, /document\.addEventListener\(\s*"keydown"/);
  assert.match(APP, /openSearchSelect\(select\)/);
});

test("the search field lives inside the dropdown panel", () => {
  assert.match(APP, /function buildSearchSelectPanel/);
  assert.match(APP, /const panel = el\("div", "mc-search-select"\)/);
  assert.match(APP, /input\.placeholder = "Search options…"/);
  assert.match(APP, /list\.setAttribute\("role", "listbox"\)/);
  assert.match(HTML, /\.mc-search-select\{position:fixed/);
  assert.match(HTML, /\.mc-search-select-options\{overflow-y:auto/);
  // The panel must be attached to the open dialog so its top layer wins.
  assert.match(APP, /select\.closest\("dialog"\) \|\| document\.body/);
  // A separate search box above a select is no longer used.
  assert.doesNotMatch(HTML, /data-walkin-session-search/);
});

test("searching filters option labels and values without breaking handlers", () => {
  assert.match(APP, /option\.textContent\.toLowerCase\(\)\.includes\(term\)/);
  assert.match(APP, /option\.value\.toLowerCase\(\)\.includes\(term\)/);
  assert.match(APP, /select\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.match(APP, /select\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
  assert.match(APP, /setAttribute\("aria-expanded", "true"\)/);
  assert.match(APP, /removeAttribute\("aria-expanded"\)/);
});
