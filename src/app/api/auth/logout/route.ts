import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, readAuthToken } from "@/lib/auth-cookie";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { getBackendUrl } from "@/lib/backend-url";

export async function POST(request: NextRequest) {
  const rejection = rejectCrossOriginMutation(request);
  if (rejection) return rejection;

  // The public shell sends the tab's bearer token. Legacy non-SPA callers may
  // still present the old cookie, which is cleaned up below.
  const incomingAuth = request.headers.get("authorization");
  const bearer = incomingAuth && incomingAuth.startsWith("Bearer ")
    ? incomingAuth.substring(7).trim()
    : null;
  const token = bearer || readAuthToken(request);

  if (token) {
    const apiUrl = getBackendUrl();
    try {
      await fetch(`${apiUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Always clear the local session even if the backend is unreachable.
    }
  }

  const response = NextResponse.json({ message: "Logged out." });

  clearAuthCookie(response);

  return response;
}
