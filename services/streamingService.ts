import { SongData } from '../types';

// Storage keys
const STORAGE_PREFIX = 'top2000_streaming_';

interface StreamingConfig {
  clientId: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

// Helper to get consistent redirect URI
const getRedirectUri = (callbackHash: string, useQueryParam: boolean = false): string => {
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
  
  // For Google OAuth (YouTube), use query parameter instead of hash
  // Google doesn't accept hash fragments in redirect URIs
  if (useQueryParam) {
    // Extract callback name from hash format (e.g., '#youtube-callback' -> 'youtube-callback')
    const callbackName = callbackHash.startsWith('#') ? callbackHash.substring(1) : callbackHash;
    // For Google OAuth, we use the base URL without any callback identifier
    // The callback will be detected via query parameters
    return `${origin}${basePath}`.replace(/\/$/, '') || `${origin}/`;
  }
  
  // For other services (Spotify, Deezer), use hash fragment
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

export interface PlaylistResult {
  playlistUrl: string;
  addedCount: number;
  failedSongs: Array<{ title: string; artist: string }>;
}

export type SpotifyPlaylistResult = PlaylistResult;

// Helper function to clean and normalize search strings
const cleanSearchString = (str: string): string => {
  return str
    .trim()
    // Remove common prefixes/suffixes that might interfere
    .replace(/^the\s+/i, '')
    .replace(/\s+the\s*$/i, '');
};

// Helper function to extract main artist (remove featured artists)
const extractMainArtist = (artist: string): string => {
  // Remove common featured artist patterns
  const cleaned = artist
    .split(/ft\.|feat\.|featuring|&|,|en|met/i)[0]
    .trim();
  return cleanSearchString(cleaned);
};

// Helper function to clean title (remove parenthetical info that might not match)
const cleanTitle = (title: string): string => {
  // Remove content in parentheses, but keep it for fallback
  const withoutParens = title.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  return cleanSearchString(withoutParens || title);
};

// Helper function to escape special characters for Spotify search
const escapeSpotifyQuery = (str: string): string => {
  // Spotify search doesn't need escaping for most characters, but quotes should be handled
  // We'll use quotes in the query string itself, so we need to escape internal quotes
  return str.replace(/"/g, '\\"');
};

// Search for a track on Spotify using multiple strategies
const searchSpotifyTrack = async (
  token: string,
  artist: string,
  title: string
): Promise<string | null> => {
  // Generate multiple search queries to try
  const mainArtist = extractMainArtist(artist);
  const cleanTitleStr = cleanTitle(title);
  const originalTitle = title.trim();
  
  // Build search queries with proper escaping
  const searchQueries = [
    // Strategy 1: Exact match with original artist and title (quoted for exact match)
    `artist:"${escapeSpotifyQuery(artist)}" track:"${escapeSpotifyQuery(title)}"`,
    // Strategy 2: Exact match with cleaned artist and title
    `artist:"${escapeSpotifyQuery(mainArtist)}" track:"${escapeSpotifyQuery(cleanTitleStr)}"`,
    // Strategy 3: Without quotes (more flexible matching)
    `artist:${artist} track:${title}`,
    // Strategy 4: Main artist without quotes, cleaned title
    `artist:${mainArtist} track:${cleanTitleStr}`,
    // Strategy 5: Simple search without operators (most flexible)
    `${artist} ${title}`,
    // Strategy 6: Main artist with original title
    `${mainArtist} ${title}`,
    // Strategy 7: Main artist with cleaned title
    `${mainArtist} ${cleanTitleStr}`,
    // Strategy 8: Just title (sometimes works for very popular songs)
    title,
    // Strategy 9: Clean title only
    cleanTitleStr,
  ];

  // Try each search query
  for (const query of searchQueries) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodedQuery}&type=track&limit=5`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.tracks?.items?.length > 0) {
          // Try to find the best match
          const items = searchData.tracks.items;
          
          // Helper to normalize strings for comparison
          const normalize = (str: string): string => {
            return str
              .toLowerCase()
              .replace(/[^\w\s]/g, '') // Remove punctuation
              .replace(/\s+/g, ' ')
              .trim();
          };
          
          // Helper to check if two strings match (fuzzy)
          const stringsMatch = (str1: string, str2: string): boolean => {
            const norm1 = normalize(str1);
            const norm2 = normalize(str2);
            
            // Exact match
            if (norm1 === norm2) return true;
            
            // One contains the other (good match)
            if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
            
            // Check if they share significant common words (for longer strings)
            const words1 = norm1.split(/\s+/).filter(w => w.length > 2);
            const words2 = norm2.split(/\s+/).filter(w => w.length > 2);
            
            if (words1.length > 0 && words2.length > 0) {
              const commonWords = words1.filter(w => words2.includes(w));
              // If more than 50% of words match, consider it a match
              const matchRatio = commonWords.length / Math.max(words1.length, words2.length);
              if (matchRatio > 0.5) return true;
            }
            
            return false;
          };
          
          // First, try exact match on artist and title
          const exactMatch = items.find((item: any) => {
            const itemArtist = item.artists?.[0]?.name || '';
            const itemTitle = item.name || '';
            
            return stringsMatch(itemArtist, artist) && stringsMatch(itemTitle, title);
          });
          
          if (exactMatch) {
            return exactMatch.uri;
          }
          
          // If no exact match, try with main artist and original title
          const mainArtistOriginalTitleMatch = items.find((item: any) => {
            const itemArtist = item.artists?.[0]?.name || '';
            const itemTitle = item.name || '';
            
            return stringsMatch(itemArtist, mainArtist) && stringsMatch(itemTitle, title);
          });
          
          if (mainArtistOriginalTitleMatch) {
            return mainArtistOriginalTitleMatch.uri;
          }
          
          // Try with main artist and cleaned title
          const mainArtistCleanTitleMatch = items.find((item: any) => {
            const itemArtist = item.artists?.[0]?.name || '';
            const itemTitle = item.name || '';
            
            return stringsMatch(itemArtist, mainArtist) && stringsMatch(itemTitle, cleanTitleStr);
          });
          
          if (mainArtistCleanTitleMatch) {
            return mainArtistCleanTitleMatch.uri;
          }
          
          // If still no match, check if title matches well (title is most important)
          const titleMatch = items.find((item: any) => {
            const itemTitle = item.name || '';
            return stringsMatch(itemTitle, cleanTitleStr) || stringsMatch(itemTitle, title);
          });
          
          if (titleMatch) {
            return titleMatch.uri;
          }
          
          // Last resort: return first result if we have any
          // This might not be the right song, but it's better than nothing
          return items[0].uri;
        }
      }
    } catch (e) {
      // Continue to next search strategy
      continue;
    }
  }

  return null;
};

export const createSpotifyPlaylist = async (
  songs: SongData[], 
  playlistName: string,
  onProgress?: (current: number, total: number) => void
): Promise<SpotifyPlaylistResult> => {
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

  // Search and add tracks - process ALL songs
  const trackUris: string[] = [];
  const failedSongs: Array<{ title: string; artist: string }> = [];
  const totalSongs = songs.length;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, totalSongs);
    }

    try {
      const trackUri = await searchSpotifyTrack(token, song.artist, song.title);
      if (trackUri) {
        trackUris.push(trackUri);
      } else {
        failedSongs.push({ title: song.title, artist: song.artist });
      }
    } catch (e) {
      console.warn(`Kon ${song.title} niet vinden op Spotify:`, e);
      failedSongs.push({ title: song.title, artist: song.artist });
    }
  }

  // Add tracks to playlist (in batches of 100 - Spotify API limit)
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
        const errorData = await addResponse.json().catch(() => ({}));
        console.warn('Kon sommige tracks niet toevoegen aan playlist:', errorData);
        // If batch add fails, we can't identify which specific tracks failed
        // So we'll just log it
      }
    }
  }

  return {
    playlistUrl: `https://open.spotify.com/playlist/${playlist.id}`,
    addedCount: trackUris.length,
    failedSongs,
  };
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

  // For Google OAuth, use query parameter instead of hash (Google doesn't accept hash in redirect URIs)
  const redirectUri = getRedirectUri('#youtube-callback', true);
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

  // For Google OAuth, use query parameter instead of hash (must match redirect URI used in auth)
  const redirectUri = getRedirectUri('#youtube-callback', true);

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
      client_secret: config.clientSecret || '',
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
      client_secret: config.clientSecret || '',
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

export const searchYouTubeVideo = async (artist: string, title: string): Promise<string | null> => {
  try {
    const token = await getYouTubeAccessToken();
    const searchQuery = encodeURIComponent(`${artist} ${title}`);
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
      if (searchData.items && searchData.items.length > 0 && searchData.items[0].id?.videoId) {
        return searchData.items[0].id.videoId;
      }
    }
  } catch (e) {
    console.warn('Error searching YouTube video:', e);
  }
  return null;
};

export const createYouTubePlaylist = async (
  songs: SongData[], 
  playlistName: string,
  onProgress?: (current: number, total: number) => void
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
  const failedSongs: Array<{ title: string; artist: string }> = [];
  let addedCount = 0;
  
  // YouTube API has rate limits (quota), so we limit the number of songs for now
  // In a production app you'd want to batch this or handle quotas better
  const songsToProcess = songs; 
  const totalToProcess = songsToProcess.length;

  for (let i = 0; i < totalToProcess; i++) {
    const song = songsToProcess[i];
    
    if (onProgress) {
       // Report progress relative to total input array
       onProgress(i + 1, songs.length);
    }

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
        if (searchData.items && searchData.items.length > 0 && searchData.items[0].id?.videoId) {
          videoIds.push(searchData.items[0].id.videoId);
        } else {
          console.warn(`Geen video gevonden voor: ${song.artist} - ${song.title}`);
          failedSongs.push({ title: song.title, artist: song.artist });
        }
      } else {
        const errorText = await searchResponse.text();
        console.warn(`YouTube search error for ${song.title}: ${errorText}`);
        
        // Check for quota exceeded
        if (searchResponse.status === 403 && (errorText.includes('quota') || errorText.includes('limit'))) {
           throw new Error('YouTube API quota overschreden. De limiet van Google is bereikt voor vandaag. Probeer het morgen opnieuw of gebruik Spotify/Deezer.');
        }
        
        failedSongs.push({ title: song.title, artist: song.artist });
      }
    } catch (e: any) {
      // Re-throw if it's our quota error
      if (e.message && e.message.includes('quota')) {
        throw e;
      }
      console.warn(`Kon ${song.title} niet vinden op YouTube:`, e);
      failedSongs.push({ title: song.title, artist: song.artist });
    }
  }

  // Add videos to playlist
  if (videoIds.length > 0) {
    for (const videoId of videoIds) {
      try {
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

        if (addResponse.ok) {
          addedCount++;
        } else {
          console.warn('Kon video niet toevoegen aan playlist');
          // We can't easily map back to song here, but we know it failed
        }
      } catch (e) {
         console.warn('Fout bij toevoegen video aan playlist', e);
      }
    }
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
