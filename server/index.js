/* eslint-env node */
/* global process */
import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

const ARENA_ACCESS_TOKEN = process.env.ARENA_ACCESS_TOKEN;

if (!ARENA_ACCESS_TOKEN) {
  console.warn("Warning: ARENA_ACCESS_TOKEN not found. Some API requests may fail.");
}
console.log("Using token?", Boolean(ARENA_ACCESS_TOKEN));

/* ---------------- cache + dedupe ---------------- */

const CACHE_TTL_MS = 10 * 60_000; // 10 minutes
const RATE_LIMIT_TTL_MS = 15_000; // cache 429 responses briefly
const cache = new Map();          // key -> { expiresAt, status, data, retryAfter }
const inFlight = new Map();       // flightKey -> Promise resolving { status, data, retryAfter, fromCache }

/* ---------------- small concurrency limiter (VERY helpful) ---------------- */
// Many unique /contents requests can still cause 429.
// This limits outbound calls to Are.na to 3 at a time.
const MAX_ARENA_CONCURRENCY = 3;
let active = 0;
const queue = [];

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

function isBypassCache(req) {
  // Reliable signal: only query param
  return req.query.nocache === "1" || req.query.nocache === "true";
}

async function fetchWithDedupe({ cacheKey, flightKey, url, headers, bypassCache }) {
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

  // 2) If same request already running, await it
  if (inFlight.has(flightKey)) return await inFlight.get(flightKey);

  // 3) Start a single request and share it
  const p = (async () => {
    const arenaRes = await withConcurrency(() => fetch(url, { headers }));

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

    // Always update cache on success (even for nocache fetch),
    // so subsequent calls are fresh and don't re-hit Are.na.
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

/* ---------------- express ---------------- */

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.get("/api/health", (req, res) => res.json({ ok: true }));

/* ---------------- routes ---------------- */

// Proxy: group channels
app.get("/api/arena/groups/:groupSlug/channels", async (req, res) => {
  try {
    const { groupSlug } = req.params;

    const page = typeof req.query.page === "string" ? req.query.page : "1";
    const per = typeof req.query.per === "string" ? req.query.per : "100"; // default higher
    const bypassCache = isBypassCache(req);

    const qs = new URLSearchParams({ page, per });
    const url = `https://api.are.na/v2/groups/${encodeURIComponent(groupSlug)}/channels?${qs.toString()}`;

    const authKey = ARENA_ACCESS_TOKEN ? "auth" : "anon";
    const cacheKey = `${authKey}:groups:${groupSlug}:channels:page=${page}:per=${per}`;
    const flightKey = bypassCache ? `${cacheKey}:nocache` : cacheKey;

    const result = await fetchWithDedupe({
      cacheKey,
      flightKey,
      url,
      headers: buildHeaders(),
      bypassCache,
    });

    // Normalize to just channels (v2 groups/channels returns { channels: [...] })
    const payload = Array.isArray(result.data) ? result.data : (result.data?.channels || []);

    res.setHeader("x-proxy-cache", result.fromCache ? "HIT" : "MISS");
    if (result.status === 429 && result.retryAfter) {
      res.setHeader("Retry-After", result.retryAfter);
    }
    return res.status(result.status).json(payload);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy failed", details: err.message });
  }
});

// Proxy: user channels (many Are.na "profiles" are users, not groups)
app.get("/api/arena/users/:userSlug/channels", async (req, res) => {
  try {
    const { userSlug } = req.params;

    const page = typeof req.query.page === "string" ? req.query.page : "1";
    const per = typeof req.query.per === "string" ? req.query.per : "100"; // default higher
    const bypassCache = isBypassCache(req);

    const qs = new URLSearchParams({ page, per });
    const url = `https://api.are.na/v2/users/${encodeURIComponent(userSlug)}/channels?${qs.toString()}`;

    const authKey = ARENA_ACCESS_TOKEN ? "auth" : "anon";
    const cacheKey = `${authKey}:users:${userSlug}:channels:page=${page}:per=${per}`;
    const flightKey = bypassCache ? `${cacheKey}:nocache` : cacheKey;

    const result = await fetchWithDedupe({
      cacheKey,
      flightKey,
      url,
      headers: buildHeaders(),
      bypassCache,
    });

    res.setHeader("x-proxy-cache", result.fromCache ? "HIT" : "MISS");
    if (result.status === 429 && result.retryAfter) {
      res.setHeader("Retry-After", result.retryAfter);
    }
    const payload = Array.isArray(result.data) ? result.data : (result.data?.channels || []);
    return res.status(result.status).json(payload);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy failed", details: err.message });
  }
});

// Proxy: channel contents
app.get("/api/arena/channels/:channelSlug/contents", async (req, res) => {
  try {
    const { channelSlug } = req.params;

    const page = typeof req.query.page === "string" ? req.query.page : "1";
    const per = typeof req.query.per === "string" ? req.query.per : "100";
    const bypassCache = isBypassCache(req);

    const qs = new URLSearchParams({ page, per });
    const url = `https://api.are.na/v2/channels/${encodeURIComponent(channelSlug)}/contents?${qs.toString()}`;

    const authKey = ARENA_ACCESS_TOKEN ? "auth" : "anon";
    const cacheKey = `${authKey}:channels:${channelSlug}:contents:page=${page}:per=${per}`;
    const flightKey = bypassCache ? `${cacheKey}:nocache` : cacheKey;

    const result = await fetchWithDedupe({
      cacheKey,
      flightKey,
      url,
      headers: buildHeaders(),
      bypassCache,
    });

    res.setHeader("x-proxy-cache", result.fromCache ? "HIT" : "MISS");
    if (result.status === 429 && result.retryAfter) {
      res.setHeader("Retry-After", result.retryAfter);
    }
    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy failed", details: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Are.na proxy running on http://localhost:${PORT}`);
});