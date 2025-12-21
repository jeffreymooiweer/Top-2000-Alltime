import { SongData } from '../types';

// Storage keys
const STORAGE_PREFIX = 'top2000_streaming_';
const API_BASE = 'https://api.top2000allertijden.nl';

interface StreamingConfig {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

// Spotify OAuth
export const getSpotifyConfig = (): StreamingConfig | null => {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}spotify`);
  return stored ? JSON.parse(stored) : null;
};

export const saveSpotifyConfig = (config: Partial<StreamingConfig>): void => {
  const existing = getSpotifyConfig() || {};
  const updated = { ...existing, ...config };
  localStorage.setItem(`${STORAGE_PREFIX}spotify`, JSON.stringify(updated));
};

export const initiateSpotifyAuth = (): void => {
  window.location.href = `${API_BASE}/auth/spotify/login`;
};

const refreshSpotifyToken = async (): Promise<string> => {
  const config = getSpotifyConfig();
  if (!config?.refreshToken) {
    throw new Error('Geen refresh token beschikbaar');
  }

  const response = await fetch(`${API_BASE}/auth/spotify/refresh?refresh_token=${config.refreshToken}`);

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const data = await response.json();
  saveSpotifyConfig({
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    // Update refresh token if a new one is returned
    ...(data.refresh_token && { refreshToken: data.refresh_token })
  });

  return data.access_token;
};

const getSpotifyAccessToken = async (): Promise<string> => {
  const config = getSpotifyConfig();
  if (!config?.accessToken) {
    throw new Error('Niet geauthenticeerd met Spotify');
  }

  if (config.expiresAt && Date.now() >= config.expiresAt - 60000) {
    return await refreshSpotifyToken();
  }

  return config.accessToken;
};

export interface PlaylistResult {
  playlistUrl: string;
  addedCount: number;
  failedSongs: Array<{ title: string; artist: string }>;
}

export type SpotifyPlaylistResult = PlaylistResult;

const searchSpotifyTrack = async (
  token: string,
  artist: string,
  title: string
): Promise<string | null> => {
    // Simplified search strategy (let's keep the multiple queries logic if it was robust, 
    // but the prompt implies we want to rely on the backend more? 
    // Actually, creating the playlist still happens client-side directly to Spotify API 
    // because we need the user's token. The Worker only handles Auth and Metadata/News.)
    
    // I will keep the robust search logic from before but strip it down slightly for readability if needed.
    // Actually, I'll copy the previous robust logic back because it's good.

  const cleanString = (str: string) => str.trim().replace(/"/g, '\\"');
  const queries = [
    `artist:"${cleanString(artist)}" track:"${cleanString(title)}"`,
    `${artist} ${title}`,
    title
  ];

  for (const query of queries) {
    try {
      const resp = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.tracks?.items?.length > 0) {
          return data.tracks.items[0].uri;
        }
      }
    } catch (e) { continue; }
  }
  return null;
};

export const createSpotifyPlaylist = async (
  songs: SongData[], 
  playlistName: string,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<SpotifyPlaylistResult> => {
  const token = await getSpotifyAccessToken();

  // Get user ID
  const userResponse = await fetch('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!userResponse.ok) throw new Error('Kon gebruikersinformatie niet ophalen');
  const user = await userResponse.json();

  // Create playlist
  const playlistResponse = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: playlistName,
      description: 'Gegenereerd vanuit Top 2000 Allertijden',
      public: false,
    }),
  });

  if (!playlistResponse.ok) throw new Error(`Kon playlist niet aanmaken`);
  const playlist = await playlistResponse.json();

  // Add tracks
  const trackUris: string[] = [];
  const failedSongs: Array<{ title: string; artist: string }> = [];

  try {
    for (let i = 0; i < songs.length; i++) {
      if (signal?.aborted) throw new Error('Cancelled');
      if (onProgress) onProgress(i + 1, songs.length);
      
      const uri = await searchSpotifyTrack(token, songs[i].artist, songs[i].title);
      if (uri) trackUris.push(uri);
      else failedSongs.push({ title: songs[i].title, artist: songs[i].artist });
    }

    // Batch add
    if (trackUris.length > 0) {
      for (let i = 0; i < trackUris.length; i += 100) {
        if (signal?.aborted) throw new Error('Cancelled');
        const batch = trackUris.slice(i, i + 100);
        await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris: batch }),
        });
      }
    }
  } catch (error: any) {
    if (error.message === 'Cancelled' || signal?.aborted) {
        // Cleanup: Unfollow playlist
        try {
            await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/followers`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) { console.error('Cleanup failed', e); }
        throw new Error('Cancelled');
    }
    throw error;
  }

  return {
    playlistUrl: `https://open.spotify.com/playlist/${playlist.id}`,
    addedCount: trackUris.length,
    failedSongs,
  };
};

// YouTube Music OAuth
export const getYouTubeConfig = (): StreamingConfig | null => {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}youtube`);
  return stored ? JSON.parse(stored) : null;
};

export const saveYouTubeConfig = (config: Partial<StreamingConfig>): void => {
  const existing = getYouTubeConfig() || {};
  const updated = { ...existing, ...config };
  localStorage.setItem(`${STORAGE_PREFIX}youtube`, JSON.stringify(updated));
};

export const initiateYouTubeAuth = (): void => {
  window.location.href = `${API_BASE}/auth/youtube/login`;
};

const refreshYouTubeToken = async (): Promise<string> => {
  const config = getYouTubeConfig();
  if (!config?.refreshToken) {
    throw new Error('Geen refresh token beschikbaar');
  }

  const response = await fetch(`${API_BASE}/auth/youtube/refresh?refresh_token=${config.refreshToken}`);

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const data = await response.json();
  saveYouTubeConfig({
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  });

  return data.access_token;
};

const getYouTubeAccessToken = async (): Promise<string> => {
  const config = getYouTubeConfig();
  if (!config?.accessToken) {
    throw new Error('Niet geauthenticeerd met YouTube');
  }

  if (config.expiresAt && Date.now() >= config.expiresAt - 60000) {
    return await refreshYouTubeToken();
  }

  return config.accessToken;
};

export const createYouTubePlaylist = async (
  songs: SongData[], 
  playlistName: string,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<PlaylistResult> => {
  const token = await getYouTubeAccessToken();

  // Create playlist
  const playlistResponse = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snippet: {
        title: playlistName,
        description: 'Gegenereerd vanuit Top 2000 Allertijden',
      },
      status: { privacyStatus: 'private' },
    }),
  });

  if (!playlistResponse.ok) throw new Error(`Kon playlist niet aanmaken`);
  const playlist = await playlistResponse.json();

  let addedCount = 0;
  const failedSongs: Array<{ title: string; artist: string }> = [];

  try {
    for (let i = 0; i < songs.length; i++) {
      if (signal?.aborted) throw new Error('Cancelled');
      if (onProgress) onProgress(i + 1, songs.length);
      const song = songs[i];

      try {
        // Search
        const searchResp = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(song.artist + ' ' + song.title)}&type=video&maxResults=1`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        let videoId = null;
        if (searchResp.ok) {
          const data = await searchResp.json();
          if (data.items?.[0]?.id?.videoId) videoId = data.items[0].id.videoId;
        }

        if (videoId) {
          // Add
          await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
            method: 'POST',
            headers: {
               'Authorization': `Bearer ${token}`,
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              snippet: {
                playlistId: playlist.id,
                resourceId: { kind: 'youtube#video', videoId },
              },
            }),
          });
          addedCount++;
        } else {
          failedSongs.push({ title: song.title, artist: song.artist });
        }
      } catch (e) {
        failedSongs.push({ title: song.title, artist: song.artist });
      }
    }
  } catch (error: any) {
    if (error.message === 'Cancelled' || signal?.aborted) {
        // Cleanup: Delete playlist
        try {
            await fetch(`https://www.googleapis.com/youtube/v3/playlists?id=${playlist.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) { console.error('Cleanup failed', e); }
        throw new Error('Cancelled');
    }
    throw error;
  }

  return {
    playlistUrl: `https://www.youtube.com/playlist?list=${playlist.id}`,
    addedCount,
    failedSongs
  };
};

// Check authentication status
export const isSpotifyAuthenticated = (): boolean => {
  const config = getSpotifyConfig();
  return !!(config?.accessToken); // Token existence is enough, refresh handles expiration
};

export const isYouTubeAuthenticated = (): boolean => {
  const config = getYouTubeConfig();
  return !!(config?.accessToken);
};

// Import Logic
export const getPlaylistIdFromUrl = (url: string): { service: 'spotify' | 'youtube', id: string } | null => {
  try {
    const urlObj = new URL(url);
    
    // Spotify
    if (urlObj.hostname.includes('spotify.com')) {
      const parts = urlObj.pathname.split('/');
      const playlistIndex = parts.indexOf('playlist');
      if (playlistIndex !== -1 && parts[playlistIndex + 1]) {
        return { service: 'spotify', id: parts[playlistIndex + 1] };
      }
    }
    
    // YouTube
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      const list = urlObj.searchParams.get('list');
      if (list) {
        return { service: 'youtube', id: list };
      }
    }
  } catch (e) {
    return null;
  }
  return null;
};

export const fetchSpotifyPlaylist = async (
  playlistId: string, 
  onProgress?: (count: number) => void
): Promise<{ title: string, artist: string }[]> => {
  const token = await getSpotifyAccessToken();
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(name,artists(name))),next&limit=100`;
  let tracks: { title: string, artist: string }[] = [];
  
  while (url) {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) throw new Error('Kon Spotify playlist niet ophalen');
    const data = await response.json();
    
    if (data.items) {
      data.items.forEach((item: any) => {
        if (item.track) {
          tracks.push({
            title: item.track.name,
            artist: item.track.artists.map((a: any) => a.name).join(', ')
          });
        }
      });
    }
    
    if (onProgress) onProgress(tracks.length);
    url = data.next;
  }
  return tracks;
};

export const fetchYouTubePlaylist = async (
  playlistId: string,
  onProgress?: (count: number) => void
): Promise<{ title: string, artist: string }[]> => {
  const token = await getYouTubeAccessToken();
  let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}`;
  let tracks: { title: string, artist: string }[] = [];
  let nextPageToken = '';

  do {
    const response = await fetch(`${url}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`, {
         headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Kon YouTube playlist niet ophalen');
    const data = await response.json();

    if (data.items) {
      data.items.forEach((item: any) => {
        const title = item.snippet.title;
        // Basic parsing: "Artist - Title" or just "Title"
        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          tracks.push({
            artist: parts[0].trim(),
            title: parts.slice(1).join(' - ').trim()
          });
        } else {
          tracks.push({
            title: title,
            artist: item.snippet.videoOwnerChannelTitle || '' // Fallback
          });
        }
      });
    }
    
    if (onProgress) onProgress(tracks.length);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return tracks;
};
