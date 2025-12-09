// services/spotifyService.ts
// Spotify Web API integratie voor playlist creatie

// ⚠️ LET OP: Je moet een Spotify App aanmaken op https://developer.spotify.com/dashboard
// en de Client ID hieronder invullen. De Redirect URI moet ingesteld zijn op:
// http://localhost:3000/callback (voor development)
// https://jeffreymooiweer.github.io/Top-2000-Alltime/callback (voor production)

const SPOTIFY_CLIENT_ID = "PLAATS_HIER_JE_SPOTIFY_CLIENT_ID";
const SPOTIFY_REDIRECT_URI = window.location.origin + window.location.pathname.replace(/\/$/, '') + '/callback';
const SPOTIFY_SCOPES = [
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private'
].join(' ');

// PKCE helpers
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// OAuth Flow
export const initiateSpotifyLogin = (): void => {
  if (!SPOTIFY_CLIENT_ID || SPOTIFY_CLIENT_ID === "PLAATS_HIER_JE_SPOTIFY_CLIENT_ID") {
    alert('Spotify Client ID is niet ingesteld. Configureer deze in services/spotifyService.ts');
    return;
  }

  const codeVerifier = generateRandomString(128);
  localStorage.setItem('spotify_code_verifier', codeVerifier);

  generateCodeChallenge(codeVerifier).then(codeChallenge => {
    const state = generateRandomString(16);
    localStorage.setItem('spotify_state', state);

    const args = new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: SPOTIFY_SCOPES,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      state: state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    window.location.href = 'https://accounts.spotify.com/authorize?' + args;
  });
};

// Exchange code for token
export const handleSpotifyCallback = async (): Promise<string | null> => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const storedState = localStorage.getItem('spotify_state');

  if (!code || !state || state !== storedState) {
    console.error('Spotify callback error: invalid state or code');
    return null;
  }

  const codeVerifier = localStorage.getItem('spotify_code_verifier');
  if (!codeVerifier) {
    console.error('Spotify callback error: no code verifier');
    return null;
  }

  // ⚠️ BELANGRIJK: Spotify's token endpoint heeft CORS restricties.
  // Voor productie gebruik je best een backend proxy.
  // Voor development kunnen we proberen direct, maar dit kan falen door CORS.
  
  try {
    // Try direct call first (works if CORS allows it)
    let response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });

    // If CORS fails, try with a CORS proxy (development only)
    if (!response.ok && response.status === 0) {
      console.warn('Direct CORS call failed, trying proxy...');
      // Note: This is a development workaround. For production, use your own backend.
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent('https://accounts.spotify.com/api/token')}`;
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          client_id: SPOTIFY_CLIENT_ID,
          code_verifier: codeVerifier,
        }),
      });
    }

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      console.error('Token exchange failed:', error);
      alert('Kon niet inloggen bij Spotify. CORS restricties kunnen dit blokkeren. Overweeg een backend proxy te gebruiken.');
      return null;
    }

    const data = await response.json();
    const accessToken = data.access_token;
    
    // Store token (in production, use httpOnly cookies via backend)
    localStorage.setItem('spotify_access_token', accessToken);
    localStorage.setItem('spotify_token_expiry', (Date.now() + data.expires_in * 1000).toString());
    
    // Cleanup
    localStorage.removeItem('spotify_code_verifier');
    localStorage.removeItem('spotify_state');
    
    return accessToken;
  } catch (error) {
    console.error('Token exchange error:', error);
    // Fallback: gebruik een backend proxy URL als je die hebt
    // const proxyUrl = 'YOUR_BACKEND_URL/spotify/token';
    // ... fetch naar proxy
    return null;
  }
};

// Get stored access token
const getAccessToken = (): string | null => {
  const token = localStorage.getItem('spotify_access_token');
  const expiry = localStorage.getItem('spotify_token_expiry');
  
  if (!token || !expiry) return null;
  if (Date.now() > parseInt(expiry)) {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiry');
    return null;
  }
  
  return token;
};

// Search for track on Spotify
export const searchSpotifyTrack = async (
  artist: string,
  title: string,
  accessToken?: string
): Promise<string | null> => {
  const token = accessToken || getAccessToken();
  if (!token) {
    throw new Error('No Spotify access token available');
  }

  // Clean search query
  const cleanArtist = artist.split('(')[0].split('-')[0].trim();
  const cleanTitle = title.split('(')[0].split('-')[0].trim();
  const query = `${cleanArtist} ${cleanTitle}`;

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, need to re-authenticate
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_token_expiry');
        throw new Error('Token expired. Please login again.');
      }
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.tracks?.items?.length > 0) {
      return data.tracks.items[0].uri; // Format: spotify:track:xxxxx
    }
    
    return null;
  } catch (error) {
    console.error('Spotify search error:', error);
    throw error;
  }
};

// Get current user ID
const getCurrentUser = async (accessToken?: string): Promise<string | null> => {
  const token = accessToken || getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
};

// Create playlist and add tracks
export const createSpotifyPlaylist = async (
  songs: Array<{ artist: string; title: string }>,
  playlistName: string = 'Top 2000 Allertijden',
  accessToken?: string
): Promise<{ success: boolean; playlistUrl?: string; message: string }> => {
  const token = accessToken || getAccessToken();
  if (!token) {
    return {
      success: false,
      message: 'Niet ingelogd bij Spotify. Log eerst in.',
    };
  }

  try {
    // Get user ID
    const userId = await getCurrentUser(token);
    if (!userId) {
      return {
        success: false,
        message: 'Kon gebruikersinformatie niet ophalen.',
      };
    }

    // Create playlist
    const createResponse = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName,
          description: `Top 2000 Allertijden lijst - ${new Date().toLocaleDateString('nl-NL')}`,
          public: true,
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('Create playlist error:', error);
      return {
        success: false,
        message: 'Kon playlist niet aanmaken.',
      };
    }

    const playlist = await createResponse.json();
    const playlistId = playlist.id;

    // Search and collect track URIs
    const trackUris: string[] = [];
    let found = 0;
    let notFound = 0;

    for (const song of songs) {
      try {
        const uri = await searchSpotifyTrack(song.artist, song.title, token);
        if (uri) {
          trackUris.push(uri);
          found++;
        } else {
          notFound++;
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Could not find track: ${song.artist} - ${song.title}`, error);
        notFound++;
      }
    }

    // Add tracks to playlist (Spotify allows max 100 tracks per request)
    const batchSize = 100;
    for (let i = 0; i < trackUris.length; i += batchSize) {
      const batch = trackUris.slice(i, i + batchSize);
      const addResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: batch,
          }),
        }
      );

      if (!addResponse.ok) {
        const error = await addResponse.text();
        console.error('Add tracks error:', error);
      }
    }

    return {
      success: true,
      playlistUrl: playlist.external_urls.spotify,
      message: `Playlist aangemaakt! ${found} nummers toegevoegd${notFound > 0 ? `, ${notFound} niet gevonden` : ''}.`,
    };
  } catch (error: any) {
    console.error('Create playlist error:', error);
    return {
      success: false,
      message: error.message || 'Er ging iets mis bij het aanmaken van de playlist.',
    };
  }
};

// Check if user is logged in
export const isSpotifyLoggedIn = (): boolean => {
  return getAccessToken() !== null;
};
