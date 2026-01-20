// Shared client helpers for our Are.na proxy.
// - Local dev: hits http://localhost:3001 (see `npm run dev:proxy`)
// - Production (Vercel): hits same-origin `/api/*` serverless functions

import { apiUrl } from "./apiBase";

const GROUP_CHANNELS_CACHE = new Map(); // groupSlug -> channels[]
const GROUP_CHANNELS_INFLIGHT = new Map(); // groupSlug -> Promise<channels[]>

function normalizeChannelsResponse(data) {
  return Array.isArray(data) ? data : (data?.channels || []);
}

export async function fetchGroupChannelsPage1(groupSlug, { headers } = {}) {
  const key = String(groupSlug || "");
  if (!key) return [];

  if (GROUP_CHANNELS_CACHE.has(key)) return GROUP_CHANNELS_CACHE.get(key);
  if (GROUP_CHANNELS_INFLIGHT.has(key)) return await GROUP_CHANNELS_INFLIGHT.get(key);

  async function fetchJson(path) {
    const res = await fetch(apiUrl(path), { headers });
    if (!res.ok) {
      const err = new Error(`Failed to fetch channels: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  }

  const p = (async () => {
    // Many Are.na "profiles" are users (not groups). Try group first, then fall back to user.
    let data;
    try {
      data = await fetchJson(
        `/api/arena/groups/${encodeURIComponent(key)}/channels?per=100&page=1`
      );
    } catch (err) {
      if (err?.status === 404) {
        data = await fetchJson(
          `/api/arena/users/${encodeURIComponent(key)}/channels?per=100&page=1`
        );
      } else {
        throw err;
      }
    }

    const channels = normalizeChannelsResponse(data);
    GROUP_CHANNELS_CACHE.set(key, channels);
    return channels;
  })();

  GROUP_CHANNELS_INFLIGHT.set(key, p);
  try {
    return await p;
  } finally {
    GROUP_CHANNELS_INFLIGHT.delete(key);
  }
}

