import { useState, useEffect } from 'react';

function ChannelList() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchChannels() {
      try {
        setLoading(true);
        const groupSlug = 'sjwilliams-world';
        const isInitialLoad = !sessionStorage.getItem('channelsLoaded');
        const headers = isInitialLoad ? { 'Cache-Control': 'no-cache' } : {};
        
        const res = await fetch(
          `http://localhost:3001/api/arena/groups/${groupSlug}/channels?per=100&page=1`,
          { headers }
        );
        if (!res.ok) {
          throw new Error(`Failed to fetch channels: ${res.status}`);
        }
        const data = await res.json();
        const channelsArray = Array.isArray(data) ? data : (data.channels || []);
        const filteredChannels = channelsArray.filter(
          (channel) => !channel.title?.startsWith('!')
        );
        setChannels(filteredChannels);
        setError(null);
        sessionStorage.setItem('channelsLoaded', 'true');
      } catch (err) {
        console.error('Error fetching channels:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchChannels();
  }, []);

  if (error) {
    return null;
  }

  if (loading) {
    return null;
  }

  return (
    <div>
      {channels.map((channel) => (
        <div key={channel.id}>{channel.title}</div>
      ))}
    </div>
  );
}

export default ChannelList;
