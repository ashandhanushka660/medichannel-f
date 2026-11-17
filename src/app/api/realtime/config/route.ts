import { connection, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";

/**
 * Tells the browser where the STOMP endpoint lives. The REST API is
 * proxied through this app, but WebSockets connect directly to the
 * backend, so the URL is derived from API_URL at request time.
 *
 * connection() opts this handler out of prerendering; Cache Components
 * does not allow the `dynamic` route segment config.
 */
export async function GET() {
  await connection();

  const apiUrl = getBackendUrl();

  try {
    const url = new URL(apiUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    url.hash = "";

    return NextResponse.json(
      { websocketUrl: url.toString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { message: "Backend API URL is not a valid URL." },
      { status: 500 }
    );
  }
}
