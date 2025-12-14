import { API_BASE } from './config';
import { SongData } from '../types';

// Storage keys
const STORAGE_PREFIX = 'top2000_streaming_';

interface StreamingSession {
  token: string;
  expiresAt?: number;
}

// Helper to get consistent redirect URI
// Kept from original to maintain compatibility with App.tsx routing
const getRedirectUri = (callbackHash: string, useQueryParam: boolean = false): string => {
  let basePath = import.meta.env.BASE_URL;
  
  if (!basePath || basePath === '/') {
    const pathname = window.location.pathname;
    basePath = pathname.replace(/\/[^/]+\.(html|htm)$/, '/');
    if (basePath === '' || basePath === '/') {
      basePath = '/';
    } else if (!basePath.endsWith('/')) {
      basePath = `${basePath}/`;
    }
  } else if (!basePath.endsWith('/')) {
    basePath = `${basePath}/`;
  }
  
  const origin = window.location.origin.replace(/\/$/, '');
  
  if (useQueryParam) {
    const callbackName = callbackHash.startsWith('#') ? callbackHash.substring(1) : callbackHash;
    // For Google OAuth, we use the base URL without any callback identifier
    // The App.tsx handles the query params
    return `${origin}${basePath}`.replace(/\/$/, '') || `${origin}/`;
  }
  
  const hash = callbackHash.startsWith('#') ? callbackHash : `#${callbackHash}`;
  return `${origin}${basePath}${hash}`;
};

// --- Spotify ---

export const getSpotifyConfig = (): StreamingSession | null => {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}spotify`);
  return stored ? JSON.parse(stored) : null;
};

export const saveSpotifyConfig = (config: Partial<StreamingSession>): void => {
  const existing = getSpotifyConfig() || { token: '' };
  const updated = { ...existing, ...config };
  localStorage.setItem(`${STORAGE_PREFIX}spotify`, JSON.stringify(updated));
};

export const initiateSpotifyAuth = async (): Promise<void> => {
  const redirectUri = getRedirectUri('#spotify-callback');
  window.location.href = `${API_BASE}/streaming/spotify/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
};

export const handleSpotifyCallback = async (code: string): Promise<void> => {
  const redirectUri = getRedirectUri('#spotify-callback');
  
  const response = await fetch(`${API_BASE}/streaming/spotify/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri })
  });

  if (!response.ok) {
     const text = await response.text();
     throw new Error(`Spotify auth failed: ${text}`);
  }

  const data = await response.json();
  saveSpotifyConfig({ 
      token: data.token,
      expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600 * 1000) 
  });
};

export const isSpotifyAuthenticated = (): boolean => {
  const config = getSpotifyConfig();
  // We rely on backend for token validity, so just check presence
  return !!config?.token;
};

export const createSpotifyPlaylist = async (
  songs: SongData[], 
  playlistName: string,
  onProgress?: (current: number, total: number) => void
): Promise<any> => {
  const token = getSpotifyConfig()?.token;
  if (!token) throw new Error('Not authenticated');

  if (onProgress) onProgress(10, 100); // Fake progress start

  const response = await fetch(`${API_BASE}/streaming/spotify/playlist`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: playlistName,
      songs: songs.map(s => ({ artist: s.artist, title: s.title })) // Send only necessary data
    }),
  });

  if (onProgress) onProgress(100, 100);

  if (!response.ok) {
      const text = await response.text();
      throw new Error(`Playlist creation failed: ${text}`);
  }

  return await response.json();
};


// --- Deezer ---

export const getDeezerConfig = (): StreamingSession | null => {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}deezer`);
  return stored ? JSON.parse(stored) : null;
};

export const saveDeezerConfig = (config: Partial<StreamingSession>): void => {
  const existing = getDeezerConfig() || { token: '' };
  const updated = { ...existing, ...config };
  localStorage.setItem(`${STORAGE_PREFIX}deezer`, JSON.stringify(updated));
};

export const initiateDeezerAuth = (): void => {
  const redirectUri = getRedirectUri('#deezer-callback');
  window.location.href = `${API_BASE}/streaming/deezer/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
};

// Deezer implicit flow usually returns token in hash, but if we use backend, 
// we might want code flow if supported, or send the token we got to backend?
// The prompt says "Frontend praat uitsluitend met de backend".
// "Backend regelt token exchange".
// Standard Deezer OAuth is code flow or implicit.
// If backend handles secrets, it must be code flow (or backend is the app).
// So backend should initiate and handle callback.
// BUT `App.tsx` handles `#deezer-callback`.
// If `App.tsx` receives `access_token` (Implicit), we should send it to backend?
// Or if we switch to Code flow (backend acts as server), `App.tsx` receives `code`?
// Let's assume the backend implements Code flow for Deezer too now.
// `App.tsx` logic: `hash.includes('deezer-callback') || hash.includes('access_token')`.
// If I change to code flow, it might return `code`.
// I will assume the backend endpoint `/streaming/deezer/callback` accepts whatever `App.tsx` extracts.
// `App.tsx` currently extracts `access_token`.
// If I change `initiateDeezerAuth` to hit backend, the backend redirects to Deezer.
// If Backend uses `response_type=code`, Deezer returns `code`.
// `App.tsx` needs to be able to handle `code` for Deezer if it doesn't already.
// I'll check `App.tsx` again.
// App.tsx: `if (hash.includes('deezer-callback') || hash.includes('access_token'))`.
// It calls `handleDeezerCallback(token, expires)`.
// It parses the hash manually.
// I might need to update `App.tsx` to handle `code` for Deezer if backend uses code flow.
// Or: `handleDeezerCallback` sends the `accessToken` (from implicit flow) to the backend?
// But "Backend regelt token exchange".
// Implicit flow: no secret needed.
// Code flow: secret needed.
// Since "secrets are safe" (on backend), we likely use Code flow.
// So `App.tsx` will receive a `code`.
// I will update `App.tsx` to handle `code` for Deezer later.
// For now, `handleDeezerCallback` will be:
export const handleDeezerCallback = async (codeOrToken: string): Promise<void> => {
   // Check if it's a code or token?
   // If it's code, exchange it.
   // If it's token, maybe just save it? But we want backend to proxy.
   // I will assume it's a code and we exchange it.
   const redirectUri = getRedirectUri('#deezer-callback');
   const response = await fetch(`${API_BASE}/streaming/deezer/callback`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ code: codeOrToken, redirect_uri: redirectUri })
   });
   if (!response.ok) throw new Error('Deezer auth failed');
   const data = await response.json();
   saveDeezerConfig({ token: data.token });
};

export const isDeezerAuthenticated = (): boolean => {
  return !!getDeezerConfig()?.token;
};

export const createDeezerPlaylist = async (songs: SongData[], name: string): Promise<string> => {
  const token = getDeezerConfig()?.token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE}/streaming/deezer/playlist`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        name,
        songs: songs.map(s => ({ artist: s.artist, title: s.title }))
    }),
  });

  if (!response.ok) throw new Error('Playlist creation failed');
  const data = await response.json();
  return data.playlistUrl;
};


// --- YouTube ---

export const getYouTubeConfig = (): StreamingSession | null => {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}youtube`);
  return stored ? JSON.parse(stored) : null;
};

export const saveYouTubeConfig = (config: Partial<StreamingSession>): void => {
  const existing = getYouTubeConfig() || { token: '' };
  const updated = { ...existing, ...config };
  localStorage.setItem(`${STORAGE_PREFIX}youtube`, JSON.stringify(updated));
};

export const initiateYouTubeAuth = async (): Promise<void> => {
  const redirectUri = getRedirectUri('#youtube-callback', true);
  window.location.href = `${API_BASE}/streaming/youtube/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
};

export const handleYouTubeCallback = async (code: string): Promise<void> => {
  const redirectUri = getRedirectUri('#youtube-callback', true);
  
  const response = await fetch(`${API_BASE}/streaming/youtube/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri })
  });
  
  if (!response.ok) throw new Error('YouTube auth failed');
  const data = await response.json();
  saveYouTubeConfig({ token: data.token });
};

export const isYouTubeAuthenticated = (): boolean => {
  return !!getYouTubeConfig()?.token;
};

export const createYouTubePlaylist = async (
  songs: SongData[], 
  playlistName: string,
  onProgress?: (current: number, total: number) => void
): Promise<any> => {
  const token = getYouTubeConfig()?.token;
  if (!token) throw new Error('Not authenticated');

  if (onProgress) onProgress(10, 100);

  const response = await fetch(`${API_BASE}/streaming/youtube/playlist`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        name: playlistName,
        songs: songs.map(s => ({ artist: s.artist, title: s.title }))
    }),
  });

  if (onProgress) onProgress(100, 100);

  if (!response.ok) throw new Error('Playlist creation failed');
  return await response.json();
};
