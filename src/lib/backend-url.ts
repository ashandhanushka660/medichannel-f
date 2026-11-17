const DEFAULT_BACKEND_URL = "https://medichannel-backend.onrender.com";

/**
 * Returns the configured backend API URL or falls back to the
 * production Render deployment. Trailing slashes are stripped.
 */
export function getBackendUrl(): string {
  const url = process.env.API_URL?.trim() || DEFAULT_BACKEND_URL;
  return url.replace(/\/$/, "");
}
