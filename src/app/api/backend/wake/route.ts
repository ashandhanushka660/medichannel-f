import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const apiUrl = getBackendUrl();

  try {
    const response = await fetch(
      `${apiUrl}/actuator/health`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { status: "starting" },
        { status: 503, headers: noStore }
      );
    }

    const health: unknown = await response.json();
    if (
      typeof health !== "object" ||
      health === null ||
      !("status" in health) ||
      health.status !== "UP"
    ) {
      return NextResponse.json(
        { status: "starting" },
        { status: 503, headers: noStore }
      );
    }

    return NextResponse.json({ status: "ready" }, { headers: noStore });
  } catch {
    return NextResponse.json(
      { status: "starting" },
      { status: 503, headers: noStore }
    );
  }
}
