import { SongData } from '../types';

// Storage keys
const STORAGE_PREFIX = 'top2000_streaming_';
const API_BASE = 'https://api.top2000allertijden.nl';

interface StreamingConfig {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface PlaylistResult {
  playlistUrl: string;
  addedCount: number;
  failedSongs: Array<{ title: string; artist: string }>;
  cancelled?: boolean;
}

export type SpotifyPlaylistResult = PlaylistResult;

// --- UTILS ---

const cleanString = (str: string) => str.trim().replace(/"/g, '\\"');

// --- SPOTIFY ---

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

const searchSpotifyTrack = async (
  token: string,
  artist: string,
  title: string
): Promise<string | null> => {
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

  // Check for existing playlist to update
  let playlistId = null;
  let isNew = true;
  
  try {
      // Fetch user playlists (limit 50, usually enough to find recent ones)
      const playlistsResp = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if (playlistsResp.ok) {
          const playlistsData = await playlistsResp.json();
          const existing = playlistsData.items.find((p: any) => p.name === playlistName);
          if (existing) {
              playlistId = existing.id;
              isNew = false;
          }
      }
  } catch (e) {
      console.warn("Could not check existing playlists", e);
  }

  if (!playlistId) {
      // Create new playlist
      const playlistResponse = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName,
          description: 'Gegenereerd vanuit Top 2000 Allertijden (Daily Update)',
          public: false,
        }),
      });

      if (!playlistResponse.ok) throw new Error(`Kon playlist niet aanmaken`);
      const playlist = await playlistResponse.json();
      playlistId = playlist.id;
  }

  // Find tracks
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

    // Batch add/replace
    if (trackUris.length > 0) {
      // For the first batch, use PUT to replace (if updating) or POST (if new, but PUT works too to overwrite empty)
      // Actually PUT overwrites all tracks. Perfect for "Update".
      // But PUT only accepts 100 tracks max.
      
      const chunks = [];
      for (let i = 0; i < trackUris.length; i += 100) {
          chunks.push(trackUris.slice(i, i + 100));
      }

      // First chunk: PUT (Replace)
      if (chunks.length > 0) {
           if (signal?.aborted) throw new Error('Cancelled');
           await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ uris: chunks[0] }),
            });
      }

      // Subsequent chunks: POST (Append)
      for (let i = 1; i < chunks.length; i++) {
        if (signal?.aborted) throw new Error('Cancelled');
        await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris: chunks[i] }),
        });
      }
    } else {
        // If no tracks found, maybe clear the playlist?
        if (!isNew) {
            await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uris: [] }),
            });
        }
    }
  } catch (error: any) {
    if (error.message === 'Cancelled' || signal?.aborted) {
        if (isNew) {
             try {
                await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/followers`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) { console.error('Cleanup failed', e); }
        }
        return { playlistUrl: '', addedCount: 0, failedSongs: [], cancelled: true };
    }
    throw error;
  }

  return {
    playlistUrl: `https://open.spotify.com/playlist/${playlistId}`,
    addedCount: trackUris.length,
    failedSongs,
  };
};

// --- YOUTUBE MUSIC ---

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

  // Create playlist (YouTube doesn't support easy "Find by name" and "Replace all", so we create new for now to be safe, or we'd have to list all, find ID, delete all items, add new items)
  // For robustness, I'll stick to Create New for YouTube for now, or the user ends up with empty playlists if logic fails.
  
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
        try {
            await fetch(`https://www.googleapis.com/youtube/v3/playlists?id=${playlist.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) { console.error('Cleanup failed', e); }
        return { playlistUrl: '', addedCount: 0, failedSongs: [], cancelled: true };
    }
    throw error;
  }

  return {
    playlistUrl: `https://www.youtube.com/playlist?list=${playlist.id}`,
    addedCount,
    failedSongs
  };
};

// --- DEEZER ---

export const getDeezerConfig = (): StreamingConfig | null => {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}deezer`);
  return stored ? JSON.parse(stored) : null;
};

export const saveDeezerConfig = (config: Partial<StreamingConfig>): void => {
  const existing = getDeezerConfig() || {};
  const updated = { ...existing, ...config };
  localStorage.setItem(`${STORAGE_PREFIX}deezer`, JSON.stringify(updated));
};

export const initiateDeezerAuth = (): void => {
  window.location.href = `${API_BASE}/auth/deezer/login`;
};

const getDeezerAccessToken = async (): Promise<string> => {
    // Deezer tokens with offline_access don't expire (or last very long).
    // Logic: just return token.
    const config = getDeezerConfig();
    if (!config?.accessToken) {
        throw new Error('Niet geauthenticeerd met Deezer');
    }
    return config.accessToken;
};

export const createDeezerPlaylist = async (
    songs: SongData[], 
    playlistName: string,
    onProgress?: (current: number, total: number) => void,
    signal?: AbortSignal
): Promise<PlaylistResult> => {
    const token = await getDeezerAccessToken();
    const corsProxy = 'https://cors-anywhere.herokuapp.com/'; // Temporary/Fallback if direct fails. 
    // Actually, we can't use public CORS proxies in prod. 
    // We'll try direct first. If it fails, we inform user.
    // NOTE: Deezer API often requires JSONP for GET, but we need POST.
    
    // 1. Create Playlist
    // POST https://api.deezer.com/user/me/playlists
    const playlistResp = await fetch(`https://api.deezer.com/user/me/playlists?access_token=${token}&title=${encodeURIComponent(playlistName)}&request_method=POST`);
    if (!playlistResp.ok) throw new Error('Deezer API Access Error (Mogelijk CORS issue)');
    const playlistData = await playlistResp.json();
    if (playlistData.error) throw new Error(`Deezer Fout: ${playlistData.error.message}`);
    
    const playlistId = playlistData.id;
    let addedCount = 0;
    const failedSongs: Array<{ title: string; artist: string }> = [];

    try {
        for (let i = 0; i < songs.length; i++) {
             if (signal?.aborted) throw new Error('Cancelled');
             if (onProgress) onProgress(i+1, songs.length);
             const song = songs[i];
             
             // Search
             const searchResp = await fetch(`https://api.deezer.com/search?q=artist:"${encodeURIComponent(song.artist)}" track:"${encodeURIComponent(song.title)}"&limit=1`);
             const searchData = await searchResp.json();
             
             if (searchData.data && searchData.data.length > 0) {
                 const trackId = searchData.data[0].id;
                 // Add to playlist
                 // POST https://api.deezer.com/playlist/{playlist_id}/tracks
                 await fetch(`https://api.deezer.com/playlist/${playlistId}/tracks?access_token=${token}&songs=${trackId}&request_method=POST`);
                 addedCount++;
             } else {
                 failedSongs.push({ title: song.title, artist: song.artist });
             }
             
             // Rate limit protection
             await new Promise(r => setTimeout(r, 100));
        }
    } catch (e: any) {
        if (e.message === 'Cancelled' || signal?.aborted) {
             await fetch(`https://api.deezer.com/playlist/${playlistId}?access_token=${token}&request_method=DELETE`);
             return { playlistUrl: '', addedCount: 0, failedSongs: [], cancelled: true };
        }
        throw e;
    }
    
    return {
        playlistUrl: `https://www.deezer.com/playlist/${playlistId}`,
        addedCount,
        failedSongs
    };
};


// --- AUTH CHECKERS ---

export const isSpotifyAuthenticated = (): boolean => {
  const config = getSpotifyConfig();
  return !!(config?.accessToken);
};

export const isYouTubeAuthenticated = (): boolean => {
  const config = getYouTubeConfig();
  return !!(config?.accessToken);
};

export const isDeezerAuthenticated = (): boolean => {
    const config = getDeezerConfig();
    return !!(config?.accessToken);
};
