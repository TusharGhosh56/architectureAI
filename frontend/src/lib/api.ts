/**
 * Centralized API configuration.
 * Supports VITE_API_URL environment variable for production deployments
 * (e.g., pointing Vercel frontend to a Railway / Render / Fly backend).
 * Falls back to relative `/api/...` for local Vite dev proxy.
 */
let rawUrl = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ""
).trim();

if (rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
  rawUrl = `https://${rawUrl}`;
}

export const API_BASE_URL = rawUrl.replace(/\/+$/, "");

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint;
}
