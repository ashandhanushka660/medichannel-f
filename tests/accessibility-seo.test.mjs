import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const HTML = read("../public/mediclinic-system.html");
const APP = read("../public/mediclinic-app.js");
const CSS = read("../public/vendor/mediclinic-tailwind.css");
const CONFIG = read("../tailwind.static.config.js");
const NEXT_CONFIG = read("../next.config.ts");
const ROBOTS = read("../src/app/robots.ts");
const SITEMAP = read("../src/app/sitemap.ts");
const LAYOUT = read("../src/app/layout.tsx");

test("skip link and route announcer are present", () => {
  assert.match(HTML, /data-skip-link class="skip-link">Skip to main content/);
  assert.match(HTML, /<main id="main-content" tabindex="-1"/);
  assert.match(HTML, /id="route-announcer" role="status" aria-live="polite"/);
  assert.match(APP, /function announceRoute\(title\)/);
  assert.match(APP, /function focusViewHeading\(view\)/);
  assert.match(APP, /if \(routeAnnounced\) \{[\s\S]*?focusViewHeading\(view\)/);
  assert.match(APP, /event\.target\.closest && event\.target\.closest\("\[data-skip-link\]"\)/);
});

test("notification disclosure state is exposed and maintained", () => {
  assert.equal((HTML.match(/aria-expanded="false"/g) || []).length, 8);
  assert.equal((HTML.match(/aria-haspopup="true"/g) || []).length, 8);
  assert.match(APP, /function closeNotificationPopovers\(\)/);
  assert.match(APP, /bellBtn\.setAttribute\("aria-expanded", String\(!popover\.hidden\)\)/);
});

test("native dialogs are opened through a focus-restoring helper", () => {
  assert.match(APP, /function openModal\(dialog, focusTarget\)/);
  assert.match(APP, /dialog\.addEventListener\("close"/);
  assert.equal((APP.match(/\bdialog\.showModal\(\)/g) || []).length, 1);
  assert.equal((APP.match(/openModal\(dialog,/g) || []).length, 5);
});

test("all versioned static assets share one cache-busting version", () => {
  const versions = [
    ...HTML.matchAll(/\/(?:vendor\/mediclinic-tailwind\.css|images\/hero-doctor-1000\.jpg|mediclinic-(?:api|manager|app)\.js)\?v=([^"']+)/g),
  ].map((match) => match[1]);
  assert.equal(versions.length, 5, "expected five versioned static assets");
  assert.deepEqual([...new Set(versions)], ["20261125d"]);
});

test("corrected contrast tokens are reflected in the generated CSS", () => {
  assert.match(CONFIG, /peach: \{ DEFAULT: "#E8734A", d: "#B3431B" \}/);
  assert.match(CONFIG, /ok: "#276749"/);
  assert.match(CONFIG, /bad: "#C53030"/);
  assert.match(CSS, /\.text-bad\{[^}]*rgb\(197 48 48/);
  assert.match(CSS, /\.text-ok\{[^}]*rgb\(39 103 73/);
  assert.match(CSS, /\.text-peach-d\{[^}]*rgb\(179 67 27/);
  assert.doesNotMatch(CSS, /rgb\(229 62 62/);
  assert.doesNotMatch(CSS, /rgb\(56 161 105/);
  assert.doesNotMatch(CSS, /rgb\(214 94 52/);
});

test("profile and login text no longer uses low-contrast white alpha", () => {
  assert.doesNotMatch(HTML, /text-white\/(70|80|85)/);
  assert.doesNotMatch(HTML, /opacity-90/);
  assert.match(HTML, /for="walkin-fn">First name<\/label><input id="walkin-fn"/);
});

test("robots, sitemap and private noindex headers are configured", () => {
  assert.match(ROBOTS, /userAgent: "\*"/);
  assert.match(ROBOTS, /\/mediclinic-system\.html/);
  assert.match(ROBOTS, /\/api\//);
  assert.match(ROBOTS, /sitemap: `\$\{SITE_URL\}\/sitemap\.xml`/);
  assert.match(SITEMAP, /mediclinic-system\.html/);
  assert.match(LAYOUT, /title: "MediChannel · Lanka Care Hospital"/);
  assert.match(LAYOUT, /canonical: "\/mediclinic-system\.html"/);
  assert.match(NEXT_CONFIG, /X-Robots-Tag/);
  assert.match(
    HTML,
    /meta\.setAttribute\("content","noindex,nofollow"\)/
  );
  assert.match(APP, /const PRIVATE_VIEWS = \[/);
  assert.match(APP, /PRIVATE_VIEWS\.includes\(targetId\)/);
  for (const path of ["/login", "/appointments", "/profile", "/admin/:path*"]) {
    assert.ok(NEXT_CONFIG.includes(`"${path}"`), `missing noindex path ${path}`);
  }
});
