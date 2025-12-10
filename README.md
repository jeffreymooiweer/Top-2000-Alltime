<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/a/a4/NPO_Radio_2_Top_2000_logo.png" alt="NPO Radio 2 Top 2000 Logo" width="400"/>
</div>

# Top 2000 Allertijden

Een interactieve webapplicatie die de NPO Radio 2 Top 2000 Allertijden berekent en visualiseert op basis van historische noteringen. De applicatie haalt data op van Wikipedia en berekent automatisch de allertijden-lijst op basis van een puntensysteem.

## 🎵 Over het Project

De Top 2000 Allertijden is een berekening van de beste nummers aller tijden op basis van alle historische Top 2000 noteringen. Het project scrapet automatisch de meest actuele data van Wikipedia en berekent scores waarbij:
- **Plek 1** = 2000 punten
- **Plek 2000** = 1 punt
- **Niet in de lijst** = 0 punten

De totale score van een nummer is de som van alle punten die het heeft behaald over alle jaren heen.

## ✨ Features

- 📊 **Allertijden Lijst**: Automatische berekening van de Top 2000 Allertijden op basis van historische data
- 📅 **Jaaroverzicht**: Bekijk de Top 2000 per jaar (1999-2024)
- 🔍 **Zoekfunctie**: Zoek op artiest of titel
- 📈 **Ranking Grafieken**: Visualiseer de historische noteringen van elk nummer
- 🎵 **Audio Previews**: Luister naar 30-seconden previews via de iTunes API
- 🖼️ **Album Covers**: Automatisch opgehaalde album artwork
- 📰 **Nieuwsfeed**: Laatste nieuws over de Top 2000 met loading indicator
- 💾 **Caching**: Lokale opslag voor snellere laadtijden (24 uur cache)
- ♾️ **Infinite Scroll**: Laad automatisch meer nummers tijdens het scrollen
- 📱 **Responsive Design**: Werkt perfect op desktop, tablet en mobiel
- 📥 **Export Functionaliteit**: Download de lijst in verschillende formaten:
  - **Excel**: Exporteer naar .xlsx bestand met volledige data
  - **PDF**: Genereer een professionele PDF met de Top 2000 lijst
- 🎵 **Streaming Dienst Integratie**: Koppel je accounts en maak automatisch playlists aan:
  - **Spotify**: Koppel je Spotify account en maak direct een playlist aan in je account
  - **Deezer**: Koppel je Deezer account en voeg nummers toe aan een nieuwe playlist
  - **YouTube Music**: Koppel je Google account en maak een YouTube Music playlist aan

## 🚀 Technologie Stack

- **React 19.2.1** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool en development server
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - React chart library voor visualisaties
- **xlsx** - Excel bestandsgeneratie
- **jspdf** - PDF generatie
- **OAuth 2.0** - Authenticatie voor streamingdiensten
- **PKCE** - Veilige client-side OAuth flow
- **Spotify Web API** - Spotify integratie
- **Deezer API** - Deezer integratie
- **YouTube Data API v3** - YouTube Music integratie

## 📁 Project Structuur

```
top-2000-allertijden/
├── components/          # React componenten
│   ├── AudioPlayer.tsx
│   ├── Modal.tsx
│   ├── NewsFeed.tsx
│   ├── SongCard.tsx
│   ├── SongChart.tsx
│   └── StreamingSetupModal.tsx
├── services/            # API services en data logica
│   ├── exportService.ts
│   ├── geminiService.ts
│   ├── itunesService.ts
│   ├── lyricsService.ts
│   ├── mockData.ts
│   ├── rssService.ts
│   ├── streamingService.ts
│   └── wikipediaService.ts
├── App.tsx              # Hoofdcomponent
├── index.tsx            # Entry point
├── types.ts             # TypeScript type definities
├── vite.config.ts       # Vite configuratie
└── package.json         # Dependencies en scripts
```

## 🔧 Configuratie

### Base Path voor GitHub Pages

De applicatie is geconfigureerd voor GitHub Pages deployment. De base path staat ingesteld in `vite.config.ts`:

```typescript
base: '/Top-2000-Alltime/'
```

Pas dit aan naar je eigen repository naam indien nodig.

### Streaming Dienst Setup

Om de streamingdienst integratie te gebruiken, moet je eerst een OAuth app aanmaken bij elke dienst:

#### Spotify Setup
1. Ga naar [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Maak een nieuwe app aan
3. Voeg deze redirect URI toe: `https://jouw-domein.nl/path#spotify-callback`
4. Kopieer je Client ID
5. Voer de Client ID in via de setup modal in de applicatie

#### Deezer Setup
1. Ga naar [Deezer Developer Portal](https://developers.deezer.com/myapps)
2. Maak een nieuwe applicatie aan
3. Voeg deze redirect URI toe: `https://jouw-domein.nl/path#deezer-callback`
4. Kopieer je Application ID
5. Voer de Application ID in via de setup modal in de applicatie

#### YouTube Music Setup
1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Maak een nieuw project aan of selecteer een bestaand project
3. Schakel YouTube Data API v3 in
4. Maak OAuth 2.0 credentials aan (Web application)
5. Voeg deze redirect URI toe: `https://jouw-domein.nl/path` (ZONDER hashtag!)
6. Kopieer je Client ID
7. Voer de Client ID in via de setup modal in de applicatie

**Belangrijk**: 
- Google accepteert GEEN hashtag (#) in redirect URIs
- Gebruik de exacte URL die in de setup modal wordt getoond (zonder hashtag)
- De callback wordt automatisch afgehandeld via query parameters

## 📊 Data Bronnen

- **Wikipedia**: Historische Top 2000 data wordt gescrapet van de pagina "Lijst_van_Radio_2-Top_2000's"
- **iTunes API**: Album covers en audio previews
- **RSS Feed**: Nieuws over de Top 2000
- **Spotify Web API**: Playlist creatie en track zoeken
- **Deezer API**: Playlist creatie en track zoeken
- **YouTube Data API v3**: Playlist creatie en video zoeken

## 🎯 Berekening Allertijden

De allertijden score wordt berekend met de volgende formule:

```
Score per jaar = 2001 - Rank
Totale Score = Σ (Score per jaar voor alle jaren)
```

**Voorbeeld:**
- Een nummer staat op plek 1 in 2020 → 2000 punten
- Hetzelfde nummer staat op plek 100 in 2021 → 1901 punten
- Totale score = 2000 + 1901 = 3901 punten

## 🔄 Caching Systeem

De applicatie gebruikt localStorage om data 24 uur lang te cachen. Dit zorgt voor:
- Snellere laadtijden bij terugkerende bezoekers
- Minder belasting op Wikipedia servers
- Offline beschikbaarheid van eerder opgehaalde data

Cache wordt automatisch ververst na 24 uur of kan handmatig worden gewist via de browser developer tools.

## ⚡ Performance Optimalisaties

De applicatie is geoptimaliseerd voor snelle laadtijden en soepele gebruikerservaring:

### React Optimalisaties
- **React.memo**: Componenten worden alleen opnieuw gerenderd wanneer nodig
- **useMemo**: Dure berekeningen worden gecached
- **useCallback**: Event handlers worden gememoized om re-renders te voorkomen
- **Code Splitting**: Grote componenten (zoals Modal) worden lazy loaded

### Search Optimalisaties
- **Debouncing**: Zoekopdrachten worden 300ms vertraagd om onnodige re-renders te voorkomen
- **Efficiënte filtering**: Filtering gebeurt alleen wanneer nodig

### Image Optimalisaties
- **Lazy Loading**: Afbeeldingen worden alleen geladen wanneer ze zichtbaar zijn
- **Priority Loading**: Kritieke afbeeldingen (logo's) worden met hoge prioriteit geladen
- **Async Decoding**: Afbeeldingen worden asynchroon gedecodeerd voor betere rendering

### Intersection Observer
- **Efficiënte lazy loading**: Componenten worden alleen geladen wanneer ze in beeld komen
- **Proper cleanup**: Observers worden correct opgeruimd om memory leaks te voorkomen

### Build Optimalisaties
- **Code Splitting**: Vendor libraries worden gescheiden in chunks
- **Tree Shaking**: Ongebruikte code wordt verwijderd
- **Minification**: Code wordt geminified voor kleinere bundle sizes
- **Chunk Optimization**: Intelligente chunking voor optimale laadtijden

## 📥 Export Functionaliteit

De applicatie biedt uitgebreide export mogelijkheden om de Top 2000 lijst te downloaden en te gebruiken in andere applicaties:

### Excel Export
Exporteer de volledige lijst naar een Excel bestand (.xlsx) met alle relevante informatie:
- Rank (Allertijden of per jaar)
- Artiest
- Titel
- Jaar
- Score

### PDF Export
Genereer een professioneel PDF document met de Top 2000 lijst in landscape formaat, geschikt voor printen of delen.

### Streaming Dienst Integratie

De applicatie ondersteunt directe integratie met populaire streamingdiensten. Je kunt je account koppelen en automatisch playlists aanmaken zonder handmatig werk.

#### Spotify Integratie
1. Klik op "Spotify" in de download dropdown
2. Volg de setup instructies om je Spotify Client ID in te voeren
3. Voeg de redirect URI toe aan je Spotify App in de [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
4. Koppel je account via OAuth
5. Maak automatisch een playlist aan met alle nummers uit de lijst

**Features:**
- Automatische track zoekfunctie
- Maximaal 100 tracks per batch
- Playlist wordt direct aangemaakt in je Spotify account
- Link naar de aangemaakte playlist

#### Deezer Integratie
1. Klik op "Deezer" in de download dropdown
2. Volg de setup instructies om je Deezer Application ID in te voeren
3. Voeg de redirect URI toe aan je Deezer App in de [Deezer Developer Portal](https://developers.deezer.com/myapps)
4. Koppel je account via OAuth
5. Maak automatisch een playlist aan met alle nummers uit de lijst

**Features:**
- Automatische track zoekfunctie
- Maximaal 200 tracks
- Playlist wordt direct aangemaakt in je Deezer account
- Link naar de aangemaakte playlist

#### YouTube Music Integratie
1. Klik op "YouTube Music" in de download dropdown
2. Volg de setup instructies om je Google Client ID in te voeren
3. Maak een OAuth Client ID aan in [Google Cloud Console](https://console.cloud.google.com/)
4. Zorg dat YouTube Data API v3 is ingeschakeld
5. Voeg de redirect URI toe aan je OAuth Client
6. Koppel je account via OAuth
7. Maak automatisch een playlist aan met alle nummers uit de lijst

**Features:**
- Automatische video zoekfunctie
- Maximaal 50 tracks per keer (vanwege API rate limits)
- Playlist wordt direct aangemaakt in je YouTube account
- Link naar de aangemaakte playlist

#### Beveiliging
- **PKCE (Proof Key for Code Exchange)**: Veilige OAuth flow zonder backend
- **Client-side authenticatie**: Geen server nodig voor OAuth flows
- **Token refresh**: Automatische token vernieuwing voor langdurige sessies
- **Lokale opslag**: Tokens worden veilig opgeslagen in browser localStorage

#### Setup Instructies
Elke streamingdienst heeft een eigen setup modal met:
- Stap-voor-stap instructies
- Automatisch gegenereerde redirect URI
- Link naar de developer portal
- Duidelijke uitleg over het verkrijgen van Client ID's

De export functies werken met de actieve filter (jaar selectie en zoekopdracht), zodat je alleen de nummers exporteert die je wilt.

## 🌐 Browser Ondersteuning

De applicatie werkt in alle moderne browsers:
- Chrome (laatste versie)
- Firefox (laatste versie)
- Safari (laatste versie)
- Edge (laatste versie)

## 📝 Licentie

Dit project is gemaakt voor educatieve doeleinden en gebruikt data van Wikipedia en de iTunes API.

---

**Disclaimer**: Dit project is niet officieel geassocieerd met NPO Radio 2. Het is een onafhankelijk project dat gebruik maakt van publiek beschikbare data.
