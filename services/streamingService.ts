import { SongData } from '../types';

// Storage keys
const STORAGE_PREFIX = 'top2000_streaming_';

interface StreamingConfig {
  clientId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

// Helper to get consistent redirect URI
const getRedirectUri = (callbackHash: string): string => {
  // Use base path from vite config or derive from current pathname
  let basePath = import.meta.env.BASE_URL;
  
  // If BASE_URL is not set, try to derive from pathname
  if (!basePath || basePath === '/') {
    // Get the pathname and remove filename if present (e.g., index.html)
    const pathname = window.location.pathname;
    // Remove trailing filename and ensure it ends with /
    basePath = pathname.replace(/\/[^/]+\.(html|htm)$/, '/');
    // If pathname is just /, use /
    if (basePath === '' || basePath === '/') {
      basePath = '/';
    } else if (!basePath.endsWith('/')) {
      basePath = `${basePath}/`;
    }
  } else if (!basePath.endsWith('/')) {
    basePath = `${basePath}/`;
  }
  
  // Remove trailing slash from origin to avoid double slashes
  const origin = window.location.origin.replace(/\/$/, '');
  // Ensure callbackHash starts with # (it should already, but be safe)
  const hash = callbackHash.startsWith('#') ? callbackHash : `#${callbackHash}`;
  return `${origin}${basePath}${hash}`;
};

// PKCE helpers
const generateCodeVerifier = (): string => {
  // Generate a random code verifier (43-128 characters, URL-safe)
  // Using base64url encoding for URL-safe characters
  const array = new Uint8Array(32); // 32 bytes = 43 characters when base64url encoded
  crypto.getRandomValues(array);
  
  // Convert to base64url (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return base64;
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Spotify OAuth
export const getSpotifyConfig = (): StreamingConfig | null => {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}spotify`);
  return stored ? JSON.parse(stored) : null;
};

export const saveSpotifyConfig = (config: Partial<StreamingConfig>): void => {
  const existing = getSpotifyConfig() || { clientId: '' };
  const updated = { ...existing, ...config };
  localStorage.setItem(`${STORAGE_PREFIX}spotify`, JSON.stringify(updated));
};

export const initiateSpotifyAuth = async (): Promise<void> => {
  const config = getSpotifyConfig();
  if (!config?.clientId) {
    throw new Error('Spotify Client ID niet geconfigureerd. Configureer eerst je Client ID.');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store verifier for later
  sessionStorage.setItem('spotify_code_verifier', codeVerifier);

  const redirectUri = getRedirectUri('#spotify-callback');
  const scopes = 'playlist-modify-public playlist-modify-private';
  
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', codeChallenge);

  window.location.href = authUrl.toString();
};

export const handleSpotifyCallback = async (code: string): Promise<void> => {
  const config = getSpotifyConfig();
  if (!config?.clientId) {
    throw new Error('Spotify Client ID niet gevonden. Configureer eerst je Client ID in de instellingen.');
  }

  const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
  if (!codeVerifier) {
    throw new Error('Code verifier niet gevonden. Start de autorisatie opnieuw vanaf het begin.');
  }

  const redirectUri = getRedirectUri('#spotify-callback');

  try {
    // Exchange code for token (client-side, no backend needed with PKCE)
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Spotify token exchange mislukt';
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error_description) {
          errorMessage = `Spotify fout: ${errorData.error_description}`;
        } else if (errorData.error) {
          errorMessage = `Spotify fout: ${errorData.error}`;
        }
      } catch {
        // If JSON parsing fails, use the raw text
        errorMessage = `Spotify fout: ${errorText}`;
      }
      
      // Check for common errors
      if (errorText.includes('invalid_grant') || errorText.includes('expired')) {
        errorMessage += ' De autorisatiecode is verlopen. Probeer het opnieuw.';
      } else if (errorText.includes('invalid_client')) {
        errorMessage += ' Client ID is ongeldig. Controleer je Client ID in de instellingen.';
      } else if (errorText.includes('redirect_uri_mismatch')) {
        errorMessage += ` Redirect URI komt niet overeen. Zorg dat deze exact overeenkomt: ${redirectUri}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('Geen access token ontvangen van Spotify');
    }
    
    saveSpotifyConfig({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    });

    sessionStorage.removeItem('spotify_code_verifier');
  } catch (error: any) {
    // Re-throw with more context if it's not already our custom error
    if (error.message && error.message.includes('Spotify')) {
      throw error;
    }
    throw new Error(`Fout bij verbinden met Spotify: ${error.message || 'Onbekende fout'}`);
  }
};

const refreshSpotifyToken = async (): Promise<string> => {
  const config = getSpotifyConfig();
  if (!config?.refreshToken) {
    throw new Error('Geen refresh token beschikbaar');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId!,
    }),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const data = await response.json();
  saveSpotifyConfig({
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  });

  return data.access_token;
};

const getSpotifyAccessToken = async (): Promise<string> => {
  const config = getSpotifyConfig();
  if (!config?.accessToken) {
    throw new Error('Niet geauthenticeerd met Spotify');
  }

  // Check if token expired
  if (config.expiresAt && Date.now() >= config.expiresAt - 60000) {
    return await refreshSpotifyToken();
  }

  return config.accessToken;
};

export const createSpotifyPlaylist = async (songs: SongData[], playlistName: string): Promise<string> => {
  const token = await getSpotifyAccessToken();

  // Get user ID
  const userResponse = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Kon gebruikersinformatie niet ophalen');
  }

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

  if (!playlistResponse.ok) {
    const error = await playlistResponse.text();
    throw new Error(`Kon playlist niet aanmaken: ${error}`);
  }

  const playlist = await playlistResponse.json();

  // Search and add tracks
  const trackUris: string[] = [];
  let addedCount = 0;

  for (const song of songs.slice(0, 100)) { // Spotify limit: 100 tracks per request
    try {
      const searchQuery = encodeURIComponent(`artist:${song.artist} track:${song.title}`);
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.tracks.items.length > 0) {
          trackUris.push(searchData.tracks.items[0].uri);
          addedCount++;
        }
      }
    } catch (e) {
      console.warn(`Kon ${song.title} niet vinden op Spotify:`, e);
    }
  }

  // Add tracks to playlist (in batches of 100)
  if (trackUris.length > 0) {
    for (let i = 0; i < trackUris.length; i += 100) {
      const batch = trackUris.slice(i, i + 100);
      const addResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: batch,
        }),
      });

      if (!addResponse.ok) {
        console.warn('Kon sommige tracks niet toevoegen aan playlist');
      }
    }
  }

  return `https://open.spotify.com/playlist/${playlist.id}`;
};

// Deezer OAuth
export const getDeezerConfig = (): StreamingConfig | null => {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}deezer`);
  return stored ? JSON.parse(stored) : null;
};

export const saveDeezerConfig = (config: Partial<StreamingConfig>): void => {
  const existing = getDeezerConfig() || { clientId: '' };
  const updated = { ...existing, ...config };
  localStorage.setItem(`${STORAGE_PREFIX}deezer`, JSON.stringify(updated));
};

export const initiateDeezerAuth = (): void => {
  const config = getDeezerConfig();
  if (!config?.clientId) {
    throw new Error('Deezer App ID niet geconfigureerd. Configureer eerst je App ID.');
  }

  const redirectUri = getRedirectUri('#deezer-callback');
  const scopes = 'manage_library,delete_library';
  
  const authUrl = new URL('https://connect.deezer.com/oauth/auth.php');
  authUrl.searchParams.set('app_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('perms', scopes);
  authUrl.searchParams.set('response_type', 'token');

  window.location.href = authUrl.toString();
};

export const handleDeezerCallback = (accessToken: string, expires: number): void => {
  saveDeezerConfig({
    accessToken,
    expiresAt: Date.now() + (expires * 1000),
  });
};

const getDeezerAccessToken = (): string => {
  const config = getDeezerConfig();
  if (!config?.accessToken) {
    throw new Error('Niet geauthenticeerd met Deezer');
  }

  if (config.expiresAt && Date.now() >= config.expiresAt - 60000) {
    throw new Error('Deezer token verlopen. Log opnieuw in.');
  }

  return config.accessToken;
};

export const createDeezerPlaylist = async (songs: SongData[], playlistName: string): Promise<string> => {
  const token = getDeezerAccessToken();

  // Get user ID
  const userResponse = await fetch(`https://api.deezer.com/user/me?access_token=${token}`);
  if (!userResponse.ok) {
    throw new Error('Kon gebruikersinformatie niet ophalen');
  }

  const user = await userResponse.json();

  // Create playlist
  const createResponse = await fetch(`https://api.deezer.com/user/${user.id}/playlists?access_token=${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      title: playlistName,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Kon playlist niet aanmaken: ${error}`);
  }

  const playlist = await createResponse.json();

  // Search and add tracks
  const trackIds: number[] = [];
  let addedCount = 0;

  for (const song of songs.slice(0, 200)) { // Deezer limit
    try {
      const searchQuery = encodeURIComponent(`${song.artist} ${song.title}`);
      const searchResponse = await fetch(
        `https://api.deezer.com/search?q=${searchQuery}&limit=1&access_token=${token}`
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          trackIds.push(searchData.data[0].id);
          addedCount++;
        }
      }
    } catch (e) {
      console.warn(`Kon ${song.title} niet vinden op Deezer:`, e);
    }
  }

  // Add tracks to playlist
  if (trackIds.length > 0) {
    const addResponse = await fetch(
      `https://api.deezer.com/playlist/${playlist.id}/tracks?access_token=${token}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          songs: trackIds.join(','),
        }),
      }
    );

    if (!addResponse.ok) {
      console.warn('Kon sommige tracks niet toevoegen aan playlist');
    }
  }

  return `https://www.deezer.com/playlist/${playlist.id}`;
};

// YouTube Music OAuth (uses YouTube Data API)
export const getYouTubeConfig = (): StreamingConfig | null => {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}youtube`);
  return stored ? JSON.parse(stored) : null;
};

export const saveYouTubeConfig = (config: Partial<StreamingConfig>): void => {
  const existing = getYouTubeConfig() || { clientId: '' };
  const updated = { ...existing, ...config };
  localStorage.setItem(`${STORAGE_PREFIX}youtube`, JSON.stringify(updated));
};

export const initiateYouTubeAuth = async (): Promise<void> => {
  const config = getYouTubeConfig();
  if (!config?.clientId) {
    throw new Error('YouTube Client ID niet geconfigureerd. Configureer eerst je Client ID.');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  sessionStorage.setItem('youtube_code_verifier', codeVerifier);

  const redirectUri = getRedirectUri('#youtube-callback');
  const scopes = 'https://www.googleapis.com/auth/youtube.force-ssl';
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  window.location.href = authUrl.toString();
};

export const handleYouTubeCallback = async (code: string): Promise<void> => {
  const config = getYouTubeConfig();
  if (!config?.clientId) {
    throw new Error('YouTube Client ID niet gevonden');
  }

  const codeVerifier = sessionStorage.getItem('youtube_code_verifier');
  if (!codeVerifier) {
    throw new Error('Code verifier niet gevonden');
  }

  const redirectUri = getRedirectUri('#youtube-callback');

  // Exchange code for token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`YouTube token exchange failed: ${error}`);
  }

  const data = await response.json();
  saveYouTubeConfig({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  });

  sessionStorage.removeItem('youtube_code_verifier');
};

const refreshYouTubeToken = async (): Promise<string> => {
  const config = getYouTubeConfig();
  if (!config?.refreshToken) {
    throw new Error('Geen refresh token beschikbaar');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId!,
    }),
  });

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

export const createYouTubePlaylist = async (songs: SongData[], playlistName: string): Promise<string> => {
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
      status: {
        privacyStatus: 'private',
      },
    }),
  });

  if (!playlistResponse.ok) {
    const error = await playlistResponse.text();
    throw new Error(`Kon playlist niet aanmaken: ${error}`);
  }

  const playlist = await playlistResponse.json();

  // Search and add tracks
  const videoIds: string[] = [];
  let addedCount = 0;

  for (const song of songs.slice(0, 50)) { // YouTube API has rate limits
    try {
      const searchQuery = encodeURIComponent(`${song.artist} ${song.title}`);
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=1`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.items && searchData.items.length > 0) {
          videoIds.push(searchData.items[0].id.videoId);
          addedCount++;
        }
      }
    } catch (e) {
      console.warn(`Kon ${song.title} niet vinden op YouTube:`, e);
    }
  }

  // Add videos to playlist
  if (videoIds.length > 0) {
    for (const videoId of videoIds) {
      const addResponse = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            playlistId: playlist.id,
            resourceId: {
              kind: 'youtube#video',
              videoId: videoId,
            },
          },
        }),
      });

      if (!addResponse.ok) {
        console.warn('Kon video niet toevoegen aan playlist');
      }
    }
  }

  return `https://www.youtube.com/playlist?list=${playlist.id}`;
};

// Check authentication status
export const isSpotifyAuthenticated = (): boolean => {
  const config = getSpotifyConfig();
  return !!(config?.accessToken && config.expiresAt && Date.now() < config.expiresAt - 60000);
};

export const isDeezerAuthenticated = (): boolean => {
  const config = getDeezerConfig();
  return !!(config?.accessToken && config.expiresAt && Date.now() < config.expiresAt - 60000);
};

export const isYouTubeAuthenticated = (): boolean => {
  const config = getYouTubeConfig();
  return !!(config?.accessToken && config.expiresAt && Date.now() < config.expiresAt - 60000);
};
