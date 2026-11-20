import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, readAuthToken } from "@/lib/auth-cookie";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { getBackendUrl } from "@/lib/backend-url";

export async function POST(request: NextRequest) {
  const rejection = rejectCrossOriginMutation(request);
  if (rejection) return rejection;

  const token = readAuthToken(request);
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
      // Continue and ensure the cookie is cleared regardless of backend connectivity.
    }
  }

  const response = NextResponse.json({ message: "Logged out." });

  clearAuthCookie(response);

  return response;
}
