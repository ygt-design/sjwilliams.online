// Centralized API base so local dev can hit the local proxy,
// while production (Vercel) uses same-origin serverless routes.
//
// Local proxy is started via: `npm run dev:proxy` (or `npm run dev:all`)
export const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3001" : "";

export function apiUrl(path) {
  const p = String(path || "");
  if (!p) return API_BASE_URL || "";
  return `${API_BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;
}

