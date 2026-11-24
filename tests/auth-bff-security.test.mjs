import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const LOGIN_ROUTE = read("../src/app/api/auth/login/route.ts");
const REGISTER_ROUTE = read("../src/app/api/auth/register/route.ts");
const ME_ROUTE = read("../src/app/api/auth/me/route.ts");
const LOGOUT_ROUTE = read("../src/app/api/auth/logout/route.ts");
const COOKIE_LIB = read("../src/lib/auth-cookie.ts");
const APP = read("../public/mediclinic-app.js");

test("login returns a tab token and issues no auth cookie", () => {
  assert.match(LOGIN_ROUTE, /token:\s*data\.accessToken/);
  assert.doesNotMatch(LOGIN_ROUTE, /setAuthCookie/);
});

test("registration returns a tab token and issues no auth cookie", () => {
  assert.match(REGISTER_ROUTE, /token:\s*login\.accessToken/);
  assert.doesNotMatch(REGISTER_ROUTE, /setAuthCookie/);
});

test("me ignores ambient cookies for tab requests and requires a bearer token", () => {
  assert.match(ME_ROUTE, /x-medichannel-tab/);
  assert.match(ME_ROUTE, /isTabRequest \? null : readAuthToken\(request\)/);
  assert.match(ME_ROUTE, /incomingAuth/);
});

test("auth cookie library only clears legacy cookies", () => {
  assert.doesNotMatch(COOKIE_LIB, /export function setAuthCookie/);
  assert.match(COOKIE_LIB, /export function clearAuthCookie/);
});

test("logout revokes the tab token on the backend", () => {
  assert.match(LOGOUT_ROUTE, /incomingAuth/);
  assert.match(LOGOUT_ROUTE, /\/api\/v1\/auth\/logout/);
  assert.match(LOGOUT_ROUTE, /clearAuthCookie\(response\)/);
});

test("logout clears the tab token from sessionStorage", () => {
  assert.match(APP, /sessionStorage\.removeItem\("mc_tab_token"\)/);
});
