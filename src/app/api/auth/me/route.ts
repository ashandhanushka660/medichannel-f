import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, readAuthToken } from "@/lib/auth-cookie";
import { getBackendUrl } from "@/lib/backend-url";

type CurrentUser = {
  userId: string;
  email: string;
  role: "CUSTOMER" | "DOCTOR" | "MANAGER" | "ADMIN";
};

const roles = new Set(["CUSTOMER", "DOCTOR", "MANAGER", "ADMIN"]);

export async function GET(request: NextRequest) {
  const incomingAuth = request.headers.get("authorization");
  const token = (incomingAuth && incomingAuth.startsWith("Bearer "))
    ? incomingAuth.substring(7).trim()
    : readAuthToken(request);
  if (!token) {
    // A stale session hint should not keep making anonymous page loads call
    // this endpoint. clearAuthCookie removes the non-secret hint as well.
    const result = NextResponse.json(
      { message: "Authentication required." },
      { status: 401 }
    );
    clearAuthCookie(result);
    return result;
  }

  const apiUrl = getBackendUrl();

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/auth/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    );
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const result = NextResponse.json(
        { message: data.message || "Unable to restore the session." },
        { status: response.status }
      );
      if (response.status === 401) {
        clearAuthCookie(result);
      }
      return result;
    }

    if (
      typeof data.userId !== "string" ||
      typeof data.email !== "string" ||
      !roles.has(data.role)
    ) {
      return NextResponse.json(
        { message: "The backend returned an unexpected session response." },
        { status: 502 }
      );
    }

    const user: CurrentUser = {
      userId: data.userId,
      email: data.email,
      role: data.role,
    };
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { message: "Unable to connect to the session service." },
      { status: 502 }
    );
  }
}
