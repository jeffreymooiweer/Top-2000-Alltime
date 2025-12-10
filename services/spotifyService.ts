// Spotify Web API Service
// Uses OAuth 2.0 Authorization Code Flow with PKCE for security

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = 'playlist-modify-public playlist-modify-private';

// Storage keys
const SPOTIFY_ACCESS_TOKEN_KEY = 'spotify_access_token';
const SPOTIFY_REFRESH_TOKEN_KEY = 'spotify_refresh_token';
const SPOTIFY_TOKEN_EXPIRY_KEY = 'spotify_token_expiry';
const SPOTIFY_CODE_VERIFIER_KEY = 'spotify_code_verifier';

// Generate a random string for PKCE
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

// Generate code verifier and challenge for PKCE
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  const token = localStorage.getItem(SPOTIFY_ACCESS_TOKEN_KEY);
  const expiry = localStorage.getItem(SPOTIFY_TOKEN_EXPIRY_KEY);
  
  if (!token || !expiry) return false;
  
  // Check if token is expired (with 60 second buffer)
  return Date.now() < parseInt(expiry) - 60000;
}

// Get access token (refresh if needed)
async function getAccessToken(): Promise<string | null> {
  const token = localStorage.getItem(SPOTIFY_ACCESS_TOKEN_KEY);
  const expiry = localStorage.getItem(SPOTIFY_TOKEN_EXPIRY_KEY);
  const refreshToken = localStorage.getItem(SPOTIFY_REFRESH_TOKEN_KEY);
  
  if (!token || !expiry || !refreshToken) return null;
  
  // If token is still valid, return it
  if (Date.now() < parseInt(expiry) - 60000) {
    return token;
  }
  
  // Token expired, refresh it
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }
    
    const data = await response.json();
    const newToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    
    localStorage.setItem(SPOTIFY_ACCESS_TOKEN_KEY, newToken);
    localStorage.setItem(SPOTIFY_TOKEN_EXPIRY_KEY, (Date.now() + expiresIn * 1000).toString());
    
    if (data.refresh_token) {
      localStorage.setItem(SPOTIFY_REFRESH_TOKEN_KEY, data.refresh_token);
    }
    
    return newToken;
  } catch (error) {
    console.error('Error refreshing token:', error);
    // Clear tokens on error
    localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(SPOTIFY_REFRESH_TOKEN_KEY);
    localStorage.removeItem(SPOTIFY_TOKEN_EXPIRY_KEY);
    return null;
  }
}

// Initiate OAuth flow
export async function initiateAuth(): Promise<void> {
  if (!CLIENT_ID) {
    alert('Spotify Client ID is niet geconfigureerd. Voeg VITE_SPOTIFY_CLIENT_ID toe aan je .env bestand.');
    throw new Error('Spotify Client ID not configured');
  }
  
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store verifier for later
  localStorage.setItem(SPOTIFY_CODE_VERIFIER_KEY, codeVerifier);
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });
  
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// Handle OAuth callback
export async function handleAuthCallback(): Promise<boolean> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');
  
  if (error) {
    console.error('Spotify auth error:', error);
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return false;
  }
  
  if (!code) return false;
  
  const codeVerifier = localStorage.getItem(SPOTIFY_CODE_VERIFIER_KEY);
  if (!codeVerifier) {
    console.error('Code verifier not found');
    return false;
  }
  
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }
    
    const data = await response.json();
    const expiresIn = data.expires_in || 3600;
    
    localStorage.setItem(SPOTIFY_ACCESS_TOKEN_KEY, data.access_token);
    localStorage.setItem(SPOTIFY_REFRESH_TOKEN_KEY, data.refresh_token);
    localStorage.setItem(SPOTIFY_TOKEN_EXPIRY_KEY, (Date.now() + expiresIn * 1000).toString());
    
    // Clean up
    localStorage.removeItem(SPOTIFY_CODE_VERIFIER_KEY);
    
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    return true;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return false;
  }
}

// Logout
export function logout(): void {
  localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(SPOTIFY_REFRESH_TOKEN_KEY);
  localStorage.removeItem(SPOTIFY_TOKEN_EXPIRY_KEY);
  localStorage.removeItem(SPOTIFY_CODE_VERIFIER_KEY);
}

// Search for a track on Spotify
export async function searchTrack(artist: string, title: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  
  // Clean search query
  const query = `${artist} ${title}`.trim();
  
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try to refresh
        const newToken = await getAccessToken();
        if (newToken) {
          // Retry with new token
          const retryResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
            {
              headers: {
                'Authorization': `Bearer ${newToken}`,
              },
            }
          );
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            return retryData.tracks?.items?.[0]?.id || null;
          }
        }
      }
      return null;
    }
    
    const data = await response.json();
    return data.tracks?.items?.[0]?.id || null;
  } catch (error) {
    console.error('Error searching track:', error);
    return null;
  }
}

// Get current user's Spotify ID
async function getCurrentUser(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.id || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Create a playlist
async function createPlaylist(userId: string, name: string, description: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  
  try {
    const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        description: description,
        public: true,
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.id || null;
  } catch (error) {
    console.error('Error creating playlist:', error);
    return null;
  }
}

// Add tracks to playlist
async function addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;
  
  // Spotify API allows max 100 tracks per request
  const batchSize = 100;
  const batches: string[][] = [];
  
  for (let i = 0; i < trackIds.length; i += batchSize) {
    batches.push(trackIds.slice(i, i + batchSize));
  }
  
  try {
    for (const batch of batches) {
      const uris = batch.map(id => `spotify:track:${id}`);
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: uris,
        }),
      });
      
      if (!response.ok) {
        console.error('Error adding tracks to playlist:', await response.text());
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error adding tracks to playlist:', error);
    return false;
  }
}

// Main function to create playlist from songs
export async function createPlaylistFromSongs(
  songs: Array<{ artist: string; title: string }>,
  playlistName: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; playlistId?: string; playlistUrl?: string; foundTracks: number; totalTracks: number }> {
  if (!CLIENT_ID) {
    alert('Spotify Client ID is niet geconfigureerd. Voeg VITE_SPOTIFY_CLIENT_ID toe aan je .env bestand.');
    return { success: false, foundTracks: 0, totalTracks: songs.length };
  }
  
  // Check authentication
  if (!isAuthenticated()) {
    await initiateAuth();
    return { success: false, foundTracks: 0, totalTracks: songs.length };
  }
  
  const token = await getAccessToken();
  if (!token) {
    await initiateAuth();
    return { success: false, foundTracks: 0, totalTracks: songs.length };
  }
  
  // Get user ID
  const userId = await getCurrentUser();
  if (!userId) {
    return { success: false, foundTracks: 0, totalTracks: songs.length };
  }
  
  // Search for tracks
  const trackIds: string[] = [];
  let foundCount = 0;
  
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    onProgress?.(i + 1, songs.length);
    
    const trackId = await searchTrack(song.artist, song.title);
    if (trackId) {
      trackIds.push(trackId);
      foundCount++;
    }
    
    // Small delay to avoid rate limiting
    if (i < songs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  if (trackIds.length === 0) {
    return { success: false, foundTracks: 0, totalTracks: songs.length };
  }
  
  // Create playlist
  const description = `Aangemaakt vanuit NPO Radio 2 Top 2000 - ${foundCount} van ${songs.length} nummers gevonden`;
  const playlistId = await createPlaylist(userId, playlistName, description);
  
  if (!playlistId) {
    return { success: false, foundTracks: foundCount, totalTracks: songs.length };
  }
  
  // Add tracks to playlist
  const added = await addTracksToPlaylist(playlistId, trackIds);
  
  if (!added) {
    return { success: false, foundTracks: foundCount, totalTracks: songs.length };
  }
  
  const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
  
  return {
    success: true,
    playlistId,
    playlistUrl,
    foundTracks: foundCount,
    totalTracks: songs.length,
  };
}
