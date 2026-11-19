import { NextRequest, NextResponse } from "next/server";
import { readAuthToken } from "@/lib/auth-cookie";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { getBackendUrl } from "@/lib/backend-url";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function forwardRequest(
  request: NextRequest,
  context: RouteContext
) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const rejection = rejectCrossOriginMutation(request);
    if (rejection) return rejection;
  }

  const apiUrl = getBackendUrl();
  const { path } = await context.params;
  const targetUrl = `${apiUrl}/api/v1/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  const incomingAuth = request.headers.get("authorization");
  const token = (incomingAuth && incomingAuth.startsWith("Bearer "))
    ? incomingAuth.substring(7).trim()
    : readAuthToken(request);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const method = request.method;
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.text();

  try {
    const backendResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const responseBody = await backendResponse.text();
    const status = backendResponse.status;

    // 204/205/304 responses must not carry a body: passing "" to the Response
    // constructor throws "Invalid response status code", which previously
    // turned a successful DELETE into a 502 "backend unreachable" error.
    const bodyless = status === 204 || status === 205 || status === 304;

    return new NextResponse(bodyless ? null : responseBody, {
      status,
      headers: {
        "Content-Type":
          backendResponse.headers.get("content-type") ||
          "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const targetPath = `/api/v1/${path.join("/")}`;
    console.error("Backend proxy request failed:", {
      method,
      targetPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        message:
          "Unable to connect to the MediChannel backend. Ensure the backend service is running and try again.",
      },
      { status: 502 }
    );
  }
}

export const GET = forwardRequest;
export const POST = forwardRequest;
export const PUT = forwardRequest;
export const PATCH = forwardRequest;
export const DELETE = forwardRequest;
