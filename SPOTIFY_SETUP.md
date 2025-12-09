# Spotify Integratie Setup

Deze applicatie ondersteunt het exporteren van de Top 2000 lijst naar een Spotify playlist.

## Setup Instructies

### 1. Spotify App Aanmaken

1. Ga naar [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in met je Spotify account
3. Klik op **"Create app"**
4. Vul in:
   - **App name**: Bijv. "Top 2000 Allertijden"
   - **App description**: Optioneel
   - **Redirect URI**: 
     - Voor development: `http://localhost:3000/callback`
     - Voor production: `https://jeffreymooiweer.github.io/Top-2000-Alltime/callback`
   - **Website**: Je website URL (optioneel)
5. Accepteer de terms
6. Klik **"Save"**

### 2. Client ID Instellen

1. In de Spotify Developer Dashboard, klik op je app
2. Kopieer de **Client ID**
3. Open `services/spotifyService.ts`
4. Vervang `"PLAATS_HIER_JE_SPOTIFY_CLIENT_ID"` met je echte Client ID

```typescript
const SPOTIFY_CLIENT_ID = "jouw-client-id-hier";
```

### 3. Redirect URI Configureren

Zorg dat je redirect URIs correct zijn ingesteld in de Spotify Dashboard:

**Development:**
- `http://localhost:3000/callback`

**Production (GitHub Pages):**
- `https://jeffreymooiweer.github.io/Top-2000-Alltime/callback`

### 4. CORS Opmerking

⚠️ **Belangrijk**: Spotify's token endpoint heeft CORS restricties. De applicatie probeert eerst een directe call, en valt terug op een CORS proxy als dat nodig is.

**Voor productie** wordt aangeraden om een eigen backend proxy te gebruiken voor de token exchange. Dit is veiliger en betrouwbaarder.

## Gebruik

1. **Login**: Klik op de download button → "Login met Spotify"
2. Je wordt doorgestuurd naar Spotify om in te loggen en toestemming te geven
3. Na login kom je terug op de site
4. **Export**: Klik opnieuw op download → "Export naar Spotify"
5. De applicatie:
   - Zoekt alle nummers op Spotify
   - Maakt een nieuwe playlist aan
   - Voegt gevonden nummers toe
   - Opent de playlist in Spotify

## Features

- ✅ OAuth 2.0 met PKCE (veilige client-side authenticatie)
- ✅ Automatisch nummers zoeken op Spotify
- ✅ Playlist naam gebaseerd op geselecteerd jaar/filter
- ✅ Batch processing (max 100 tracks per request)
- ✅ Error handling en gebruikersfeedback

## Beperkingen

- Nummers die niet op Spotify staan worden overgeslagen
- Rate limiting: max 100 tracks per batch (meerdere batches worden automatisch verwerkt)
- CORS restricties kunnen problemen veroorzaken (gebruik backend proxy voor productie)

## Troubleshooting

**"CORS error" bij login:**
- Gebruik een backend proxy voor token exchange
- Of gebruik een CORS proxy service (alleen voor development)

**"Token expired":**
- Log opnieuw in via de download button

**"Kon nummer niet vinden":**
- Sommige nummers staan mogelijk niet op Spotify
- De applicatie gaat door met de volgende nummers

## Backend Proxy (Optioneel, Aanbevolen)

Voor productie gebruik je best een eigen backend endpoint voor token exchange:

```javascript
// Backend endpoint: /api/spotify/token
app.post('/api/spotify/token', async (req, res) => {
  const { code, redirect_uri, code_verifier } = req.body;
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirect_uri,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      code_verifier: code_verifier,
    }),
  });
  
  const data = await response.json();
  res.json(data);
});
```

Update dan `handleSpotifyCallback` in `spotifyService.ts` om naar je backend te wijzen.
