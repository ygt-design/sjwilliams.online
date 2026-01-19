/* eslint-env node */
/* global process */

// Shared Are.na proxy logic for Vercel Serverless Functions.
// Keeps client-side tokens out of the browser and avoids CORS by serving same-origin `/api/*`.

const ARENA_ACCESS_TOKEN = process.env.ARENA_ACCESS_TOKEN;

const CACHE_TTL_MS = 10 * 60_000; // 10 minutes
const RATE_LIMIT_TTL_MS = 15_000; // cache 429 responses briefly

// Note: Vercel lambdas are ephemeral, but module-level state can still help
// within a warm instance (reduces bursts + helps avoid 429).
const cache = new Map(); // key -> { expiresAt, status, data, retryAfter }
const inFlight = new Map(); // key -> Promise resolving { status, data, retryAfter, fromCache }

const MAX_ARENA_CONCURRENCY = 3;
let active = 0;
const queue = [];

function firstQueryValue(v) {
  if (Array.isArray(v)) return v[0];
  return v;
}

async function withConcurrency(fn) {
  if (active >= MAX_ARENA_CONCURRENCY) {
    await new Promise((resolve) => queue.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = queue.shift();
    if (next) next();
  }
}

function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function setCache(key, status, data, ttlMs, retryAfter = null) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, status, data, retryAfter });
}

function buildHeaders() {
  const headers = {};
  if (ARENA_ACCESS_TOKEN) headers.Authorization = `Bearer ${ARENA_ACCESS_TOKEN}`;
  return headers;
}

export function isBypassCache(req) {
  const raw = firstQueryValue(req?.query?.nocache);
  return raw === "1" || raw === "true";
}

export function hasArenaToken() {
  return Boolean(ARENA_ACCESS_TOKEN);
}

export async function fetchArenaJson({ url, cacheKey, flightKey, bypassCache }) {
  // 1) Serve from cache
  if (!bypassCache) {
    const cached = getCache(cacheKey);
    if (cached) {
      return {
        status: cached.status,
        data: cached.data,
        retryAfter: cached.retryAfter ?? null,
        fromCache: true,
      };
    }
  }

  // 2) Deduplicate concurrent identical requests
  if (inFlight.has(flightKey)) return await inFlight.get(flightKey);

  const p = (async () => {
    const arenaRes = await withConcurrency(() => fetch(url, { headers: buildHeaders() }));
    const retryAfter = arenaRes.headers.get("retry-after"); // seconds (string) or null

    if (!arenaRes.ok) {
      const errorText = await arenaRes.text();
      const payload = { error: errorText || "Are.na API error" };

      // Cache 429 and respect Retry-After to prevent hammering
      if (arenaRes.status === 429) {
        const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
        const waitMs = Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds * 1000
          : RATE_LIMIT_TTL_MS;
        setCache(cacheKey, 429, payload, waitMs, retryAfter || null);
        return {
          status: 429,
          data: payload,
          retryAfter: retryAfter || null,
          fromCache: false,
        };
      }

      return {
        status: arenaRes.status,
        data: payload,
        retryAfter: null,
        fromCache: false,
      };
    }

    const data = await arenaRes.json();
    setCache(cacheKey, arenaRes.status, data, CACHE_TTL_MS, null);
    return { status: arenaRes.status, data, retryAfter: null, fromCache: false };
  })();

  inFlight.set(flightKey, p);
  try {
    return await p;
  } finally {
    inFlight.delete(flightKey);
  }
}

export function getQueryParam(req, key, fallback) {
  const v = firstQueryValue(req?.query?.[key]);
  if (typeof v === "string" && v.length) return v;
  return fallback;
}

