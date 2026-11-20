import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
const LOGOUT_ROUTE = readFileSync(
  new URL("../src/app/api/auth/logout/route.ts", import.meta.url),
  "utf8"
);
const COOKIE_LIB = readFileSync(
  new URL("../src/lib/auth-cookie.ts", import.meta.url),
  "utf8"
);

test("/api/auth/login does NOT return token or accessToken in browser response", () => {
  // Verifies the JSON response payload omits token
  assert.doesNotMatch(LOGIN_ROUTE, /token:\s*data\.accessToken/);
  assert.doesNotMatch(LOGIN_ROUTE, /accessToken:\s*data\.accessToken/);
  assert.match(LOGIN_ROUTE, /setAuthCookie\(result,\s*data\.accessToken,\s*data\.expiresIn\);/);
});

test("/api/auth/register does NOT return token or accessToken in browser response", () => {
  assert.doesNotMatch(REGISTER_ROUTE, /token:\s*login\.accessToken/);
  assert.doesNotMatch(REGISTER_ROUTE, /accessToken:\s*login\.accessToken/);
  assert.match(REGISTER_ROUTE, /setAuthCookie\(result,\s*login\.accessToken/);
});

test("/api/auth/me authenticates solely via readAuthToken and drops client Authorization header", () => {
  assert.match(ME_ROUTE, /const token = readAuthToken\(request\);/);
  assert.doesNotMatch(ME_ROUTE, /incomingAuth/);
  assert.doesNotMatch(ME_ROUTE, /request\.headers\.get\("authorization"\)/i);
});

test("auth-cookie library configures HttpOnly, SameSite, and Secure options", () => {
  assert.match(COOKIE_LIB, /httpOnly:\s*true/);
  assert.match(COOKIE_LIB, /sameSite:\s*"lax"/);
  assert.match(COOKIE_LIB, /__Host-medichannel_token/);
});

test("/api/auth/logout invalidates session on backend and clears auth cookie", () => {
  assert.match(LOGOUT_ROUTE, /const token = readAuthToken\(request\);/);
  assert.match(LOGOUT_ROUTE, /\/api\/v1\/auth\/logout/);
  assert.match(LOGOUT_ROUTE, /clearAuthCookie\(response\);/);
});
