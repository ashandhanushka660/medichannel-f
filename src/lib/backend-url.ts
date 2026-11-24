const DEFAULT_BACKEND_URL =
  "https://evening-plains-20028-0ce7ee55df0f.herokuapp.com";

/**
 * Returns the public backend origin configured for this deployment.
 * This value is used to generate browser-facing CSP and WebSocket URLs.
 */
export function getPublicBackendUrl(): string {
  const url = process.env.API_URL?.trim() || DEFAULT_BACKEND_URL;
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
