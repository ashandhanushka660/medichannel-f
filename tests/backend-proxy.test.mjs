import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ROUTE = readFileSync(
  new URL("../src/app/api/backend/[...path]/route.ts", import.meta.url),
  "utf8"
);

test("the proxy never builds a bodyful response for 204/205/304", () => {
  // Constructing a Response with "" and status 204 throws
  // "Invalid response status code 204" in the Next/undici runtime, which used
  // to turn a successful DELETE (204 No Content) into a 502 error upstream.
  assert.match(
    ROUTE,
    /status === 204 \|\| status === 205 \|\| status === 304/
  );
  assert.match(ROUTE, /new NextResponse\(bodyless \? null : responseBody/);
});

test("the proxy forwards DELETE requests to the backend", () => {
  assert.match(ROUTE, /export const DELETE = forwardRequest;/);
});

test("the proxy prefers the tab bearer token and ignores cookies for SPA traffic", () => {
  assert.match(ROUTE, /x-medichannel-tab/);
  assert.match(ROUTE, /bearer \|\| \(isTabRequest \? null : readAuthToken\(request\)\)/);
  assert.doesNotMatch(ROUTE, /const token = readAuthToken\(request\);\s*\n\s*\n\s*\/\/ The public shell/);
});

test("the proxy clears legacy auth cookies when the backend responds with 401", () => {
  assert.match(ROUTE, /status === 401/);
  assert.match(ROUTE, /clearAuthCookie\(response\)/);
});

test("unauthenticated per-session queue calls are rejected before the backend", () => {
  assert.match(
    ROUTE,
    /path\[0\] === "sessions" && path\.length >= 3 && path\[2\] === "queue"/
  );
  assert.match(ROUTE, /isPerSessionQueue && !token/);
  const guard = ROUTE.indexOf("isPerSessionQueue && !token");
  const fetchCall = ROUTE.indexOf("await fetch(targetUrl");
  assert.ok(guard >= 0 && fetchCall > guard, "guard must run before fetch");
});
