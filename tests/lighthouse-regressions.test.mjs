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

test("welcome view is paintable before any network request resolves", () => {
  assert.match(HTML, /<body data-app-ready="true">/);
  assert.match(HTML, /<section data-view="welcome" data-title="Welcome">/);
  assert.doesNotMatch(HTML, /<section data-view="welcome" data-title="Welcome" hidden>/);
  assert.match(
    HTML,
    /body:not\(\[data-app-ready="true"\]\)>section\[data-view\],\s*body:not\(\[data-app-ready="true"\]\)>footer\{display:none!important\}/
  );
});

test("inline boot script selects the hashed view before deferred scripts run", () => {
  const boot = HTML.indexOf("decodeURIComponent(location.hash.slice(1))");
  const apiScript = HTML.indexOf('/mediclinic-api.js?v=');
  assert.ok(boot > -1, "inline view-selection script is missing");
  assert.ok(apiScript > boot, "inline boot script must run before deferred scripts");
  assert.match(HTML, /document\.querySelectorAll\("section\[data-view\]"\)\.forEach/);
  assert.match(HTML, /document\.body\.dataset\.appReady="true"/);
});

test("public notices space is reserved before JavaScript inserts notices", () => {
  assert.match(HTML, /id="public-notices-panel"/);
  assert.match(HTML, /style="min-height:420px"/);
  assert.match(HTML, /data-public-notices-status/);
  assert.match(HTML, /data-public-notices-list/);

  const enterView = APP.slice(APP.indexOf("function enterView"), APP.indexOf("// Account rendering"));
  assert.equal(
    (enterView.match(/loadOnce\(loadPublicNotices\);/g) || []).length,
    1,
    "welcome notices must be loaded exactly once per view entry"
  );
});

test("account controls and statistics reserve space before being populated", () => {
  assert.match(HTML, /\[data-view="welcome"\] \[data-who\]\{min-width:180px;min-height:40px/);
  assert.equal((HTML.match(/style="color:#BFE3F2;min-width:4ch"/g) || []).length, 3);
});

test("versioned static assets are cache-busted together", () => {
  const versions = [...HTML.matchAll(/\?v=(2026\d{4}[a-z])/g)].map((match) => match[1]);
  assert.ok(versions.length >= 4, "expected versioned static assets");
  assert.equal(new Set(versions).size, 1, "all static assets should share one version");
});

test("the LCP hero is a cacheable external image with intrinsic dimensions", () => {
  assert.doesNotMatch(HTML, /<img src="data:image\/jpeg;base64,/);
  assert.match(
    HTML,
    /src="\/images\/hero-doctor-1000\.jpg\?v=[\da-z]+"[^>]*width="1000" height="830" fetchpriority="high"/
  );
  assert.match(HTML, /og:image" content="https:\/\/app\.medichannel\.dpdns\.org\/images\/hero-doctor-1000\.jpg"/);
});

test("repeated view loaders are in-flight guarded", () => {
  assert.match(APP, /const activeLoaders = new Set\(\)/);
  assert.match(APP, /function loadOnce\(loader\)/);
  assert.doesNotMatch(APP, /void load(?:StaffAccounts|AdminStats|AuditLogs|ManagerSessions)\(\);/);
  assert.match(APP, /if \(\["welcome", "index"\]\.includes\(id\)\)/);
});
