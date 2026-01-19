import Arena from 'are.na';

const token = import.meta.env.VITE_ARENA_ACCESS_TOKEN;

if (!token) {
  console.warn('Missing VITE_ARENA_ACCESS_TOKEN. Some features may not work. Please set VITE_ARENA_ACCESS_TOKEN in .env.local');
}

let arenaClient = null;

function getArenaClient() {
  if (!arenaClient) {
    arenaClient = new Arena({ accessToken: token || undefined });
  }
  return arenaClient;
}

export const arenaClientInstance = getArenaClient();
export default arenaClientInstance;
