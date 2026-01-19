// Shared client helpers for our local Are.na proxy (localhost:3001)

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

  const p = (async () => {
    const res = await fetch(
      `http://localhost:3001/api/arena/groups/${encodeURIComponent(key)}/channels?per=100&page=1`,
      { headers }
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch channels: ${res.status}`);
    }
    const data = await res.json();
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

