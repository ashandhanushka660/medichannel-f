import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const AUTH_COOKIE = readFileSync(
  new URL("../src/lib/auth-cookie.ts", import.meta.url),
  "utf8"
);
const ME_ROUTE = readFileSync(
  new URL("../src/app/api/auth/me/route.ts", import.meta.url),
  "utf8"
);

test("anonymous page loads do not call the session endpoint", () => {
  assert.match(APP, /const hasSessionHint = \(\) =>/);
  assert.match(
    APP,
    /if \(!hasSessionHint\(\) && !tabToken\) \{\s*S = null;[\s\S]*?setTimeout\(\(\) => finishBoot\(false\), 0\);\s*return;/
  );
  assert.match(
    AUTH_COOKIE,
    /SESSION_HINT_COOKIE_NAME = "medichannel_session_hint"/
  );
  assert.match(AUTH_COOKIE, /httpOnly: false/);
  assert.match(ME_ROUTE, /if \(!token\) \{[\s\S]*?clearAuthCookie\(result\)/);
});

test("date formatters are reused instead of rebuilt per notice", () => {
  const formatters = APP.match(/new Intl\.DateTimeFormat/g) || [];
  assert.equal(
    formatters.length,
    4,
    "expected exactly four shared Intl.DateTimeFormat instances"
  );
  assert.match(APP, /const noticeDateFormatter = new Intl\.DateTimeFormat/);
});

test("hidden views are enhanced only when they become visible", () => {
  assert.match(
    APP,
    /const enhancedViews = new WeakSet\(\);[\s\S]*?enhanceMotionTree\(initialView \|\| document\.body\);/
  );
  assert.doesNotMatch(APP, /enhanceMotionTree\(document\.body\);/);
  assert.match(APP, /if \(!enhancedViews\.has\(view\)\) \{\s*enhanceMotionTree\(view\);\s*enhancedViews\.add\(view\);\s*\}/);
});
