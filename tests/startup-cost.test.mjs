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
const API = readFileSync(
  new URL("../public/mediclinic-api.js", import.meta.url),
  "utf8"
);
const LOGIN_ROUTE = readFileSync(
  new URL("../src/app/api/auth/login/route.ts", import.meta.url),
  "utf8"
);
const REGISTER_ROUTE = readFileSync(
  new URL("../src/app/api/auth/register/route.ts", import.meta.url),
  "utf8"
);
const ME_ROUTE = readFileSync(
  new URL("../src/app/api/auth/me/route.ts", import.meta.url),
  "utf8"
);
const BACKEND_ROUTE = readFileSync(
  new URL("../src/app/api/backend/[...path]/route.ts", import.meta.url),
  "utf8"
);

test("a copied URL cannot restore a session from another browser context", () => {
  assert.doesNotMatch(APP, /hasSessionHint/);
  assert.match(
    APP,
    /if \(!tabToken\) \{\s*S = null;[\s\S]*?setTimeout\(\(\) => finishBoot\(false\), 0\);\s*return;/
  );
  assert.match(API, /if \(!tabToken\) return Promise\.resolve\(null\);/);

  // Sign-in no longer writes a cookie that a different context could reuse.
  assert.doesNotMatch(LOGIN_ROUTE, /setAuthCookie/);
  assert.doesNotMatch(REGISTER_ROUTE, /setAuthCookie/);

  // The BFF ignores ambient cookies for tab requests.
  assert.match(ME_ROUTE, /isTabRequest \? null : readAuthToken\(request\)/);
  assert.match(BACKEND_ROUTE, /isTabRequest \? null : readAuthToken\(request\)/);
  assert.match(
    AUTH_COOKIE,
    /SESSION_HINT_COOKIE_NAME = "medichannel_session_hint"/
  );
});

test("date and clinic clock formatters are reused instead of rebuilt per notice", () => {
  const formatters = APP.match(/new Intl\.DateTimeFormat/g) || [];
  assert.equal(
    formatters.length,
    5,
    "expected exactly five shared Intl.DateTimeFormat instances"
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
