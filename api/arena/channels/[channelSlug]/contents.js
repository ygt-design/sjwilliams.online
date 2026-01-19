import { fetchArenaJson, getQueryParam, hasArenaToken, isBypassCache } from "../../../_arenaProxy.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const channelSlug = getQueryParam(req, "channelSlug", "");
  if (!channelSlug) return res.status(400).json({ error: "Missing channelSlug" });

  const page = getQueryParam(req, "page", "1");
  const per = getQueryParam(req, "per", "100");
  const bypassCache = isBypassCache(req);

  const qs = new URLSearchParams({ page, per });
  const url = `https://api.are.na/v2/channels/${encodeURIComponent(channelSlug)}/contents?${qs.toString()}`;

  const authKey = hasArenaToken() ? "auth" : "anon";
  const cacheKey = `${authKey}:channels:${channelSlug}:contents:page=${page}:per=${per}`;
  const flightKey = bypassCache ? `${cacheKey}:nocache` : cacheKey;

  try {
    const result = await fetchArenaJson({ url, cacheKey, flightKey, bypassCache });

    res.setHeader("x-proxy-cache", result.fromCache ? "HIT" : "MISS");
    if (result.status === 429 && result.retryAfter) {
      res.setHeader("Retry-After", result.retryAfter);
    }
    return res.status(result.status).json(result.data);
  } catch (err) {
    return res.status(500).json({ error: "Proxy failed", details: err?.message || String(err) });
  }
}

