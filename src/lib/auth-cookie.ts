import type { NextRequest, NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

/**
 * `__Host-` cookies cannot be overwritten by a sibling subdomain and must be
 * Secure, path-scoped to `/`, and sent without a Domain attribute. Development
 * keeps the plain name so login also works over http://localhost.
 */
export const AUTH_COOKIE_NAME = isProduction
  ? "__Host-medichannel_token"
  : "medichannel_token";

const LEGACY_COOKIE_NAME = "medichannel_token";

/**
 * Non-secret hint that lets the public shell decide whether to call the
 * session endpoint. It contains no token; the HttpOnly cookie remains the
 * only credential. Without this hint every anonymous page view produces a
 * 401 console error and an unnecessary backend round trip.
 */
export const SESSION_HINT_COOKIE_NAME = "medichannel_session_hint";

const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  priority: "high" as const,
};

export function readAuthToken(request: NextRequest): string | undefined {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value;
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  maxAge: number
) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    ...authCookieOptions,
    maxAge,
  });

  response.cookies.set(SESSION_HINT_COOKIE_NAME, "1", {
    ...authCookieOptions,
    httpOnly: false,
    maxAge,
  });

  if (AUTH_COOKIE_NAME !== LEGACY_COOKIE_NAME) {
    response.cookies.set(LEGACY_COOKIE_NAME, "", {
      ...authCookieOptions,
      maxAge: 0,
    });
  }
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
