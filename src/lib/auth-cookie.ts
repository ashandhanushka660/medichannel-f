import type { NextRequest, NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Legacy cookie names. Sign-in no longer issues cookies: the public shell
 * keeps its signed token in that tab's sessionStorage so copying a URL cannot
 * carry the session into another browser context. These helpers only clear
 * cookies written by older builds.
 */
export const AUTH_COOKIE_NAME = isProduction
  ? "__Host-medichannel_token"
  : "medichannel_token";

const LEGACY_COOKIE_NAME = "medichannel_token";

export const SESSION_HINT_COOKIE_NAME = "medichannel_session_hint";

const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  priority: "high" as const,
};

/** Only used for non-SPA callers; the SPA always sends its tab token. */
export function readAuthToken(request: NextRequest): string | undefined {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value;
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...authCookieOptions,
    maxAge: 0,
  });

  response.cookies.set(SESSION_HINT_COOKIE_NAME, "", {
    ...authCookieOptions,
    httpOnly: false,
    maxAge: 0,
  });

  if (AUTH_COOKIE_NAME !== LEGACY_COOKIE_NAME) {
    response.cookies.set(LEGACY_COOKIE_NAME, "", {
      ...authCookieOptions,
      maxAge: 0,
    });
  }
}
