const DEFAULT_BACKEND_URL =
  "https://evening-plains-20028-0ce7ee55df0f.herokuapp.com";

/**
 * Backend origins that were used by earlier deployments and are now retired.
 * A stale API_URL pointing at one of these would make every proxied request
 * fail, so they are treated as unset and the current backend is used instead.
 */
const RETIRED_BACKEND_HOSTS = [
  "medichannel-backend.onrender.com",
  "trycloudflare.com",
];

function isRetiredBackend(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return RETIRED_BACKEND_HOSTS.some(
      (retired) => host === retired || host.endsWith("." + retired)
    );
  } catch {
    return false;
  }
}

function configuredBackendUrl(): string | null {
  const url = process.env.API_URL?.trim();
  if (!url || isRetiredBackend(url)) return null;
  return url;
}

/**
 * Returns the public backend origin configured for this deployment.
 * This value is used to generate browser-facing CSP and WebSocket URLs.
 */
export function getPublicBackendUrl(): string {
  const url = configuredBackendUrl() || DEFAULT_BACKEND_URL;
  return url.replace(/\/$/, "");
}

/**
 * Returns the origin used by server-side BFF routes to reach the backend.
 *
 * When the public API origin is the same Cloudflare hostname as the frontend,
 * the named tunnel currently routes every path to the Next.js server. The
 * server-side proxy therefore uses the local backend origin directly, while
 * the browser continues to see only https://app.medichannel.dpdns.org.
 */
export function getBackendUrl(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/$/, "");
  return getPublicBackendUrl();
}

/**
 * Backwards-compatible name for code that only needs the configured origin.
 */
export const getConfiguredBackendUrl = getPublicBackendUrl;
