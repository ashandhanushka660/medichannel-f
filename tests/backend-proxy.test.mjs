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

test("the proxy authenticates solely via readAuthToken without client Authorization override", () => {
  assert.match(ROUTE, /const token = readAuthToken\(request\);/);
  assert.doesNotMatch(ROUTE, /incomingAuth/);
  assert.doesNotMatch(ROUTE, /request\.headers\.get\("authorization"\)/i);
});

test("the proxy clears the auth cookie when the backend responds with 401", () => {
  assert.match(ROUTE, /status === 401/);
  assert.match(ROUTE, /clearAuthCookie\(response\)/);
});
