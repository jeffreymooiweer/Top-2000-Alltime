# Project Analyse: Top 2000 Allertijden

## Overzicht
Dit is een React/TypeScript webapplicatie die de **NPO Radio 2 Top 2000 Allertijden** visualiseert. De applicatie berekent een "allertijden" ranking op basis van historische noteringen van nummers in de Top 2000 lijst (1999-2024).

## Technologie Stack

### Frontend
- **React 19.2.1** - UI framework
- **TypeScript 5.8.2** - Type safety
- **Vite 6.2.0** - Build tool en dev server
- **Tailwind CSS** (via CDN) - Styling
- **Recharts 3.5.1** - Data visualisatie (grafieken)

### AI/ML
- **@mlc-ai/web-llm 0.2.0** - Lokale AI model voor song analyses (SmolLM2-360M-Instruct)

### Externe APIs
- **Wikipedia API** - Scraping van Top 2000 data
- **iTunes Search API** - Album covers en audio previews
- **Lyrics.ovh API** - Songteksten
- **NPO Radio 2 RSS Feed** - Nieuwsfeed
- **CORS Proxies** (AllOrigins, CorsProxy) - Voor RSS feed fetching

## Project Structuur

```
/workspace
├── components/          # React componenten
│   ├── AudioPlayer.tsx     # Audio preview speler
│   ├── Modal.tsx           # Detail modal voor songs
│   ├── NewsFeed.tsx        # RSS nieuwsfeed component
│   ├── SongCard.tsx        # Song card in lijst
│   └── SongChart.tsx       # Ranking geschiedenis grafiek
├── services/            # Business logic & API calls
│   ├── geminiService.ts    # AI song analyse (WebLLM)
│   ├── itunesService.ts    # iTunes metadata fetching
│   ├── lyricsService.ts    # Lyrics API
│   ├── mockData.ts         # Mock data voor development
│   ├── rssService.ts       # RSS feed parsing
│   └── wikipediaService.ts # Wikipedia scraping
├── App.tsx              # Hoofdcomponent
├── index.tsx            # Entry point
├── types.ts             # TypeScript type definities
├── vite.config.ts       # Vite configuratie
└── package.json         # Dependencies
```

## Kernfunctionaliteit

### 1. Data Scraping & Verwerking
- **Wikipedia Scraping** (`wikipediaService.ts`):
  - Haalt Top 2000 tabel op van Wikipedia via API
  - Parseert HTML tabel met DOM parser
  - Detecteert automatisch kolommen (artiest, titel, jaren)
  - Extraheert ranking geschiedenis per nummer (1999-2024)

### 2. Score Berekening
- **Allertijden Score**:
  - Formule: `Punten = 2001 - Rank` (Rank 1 = 2000 punten, Rank 2000 = 1 punt)
  - Sommeert punten over alle jaren
  - Detecteert incomplete jaren (minder dan 1500 entries) en sluit deze uit
  - Berekent "previous rank" voor vergelijking

### 3. Caching Strategie
- **LocalStorage**: 
  - Slaat volledige song data op (24 uur cache)
  - Versie-systeem (`v3`) voor cache invalidatie
- **IndexedDB**:
  - Slaat iTunes metadata op (covers, previews)
  - Permanente cache met timestamp
- **Memory Cache**:
  - In-memory cache voor snelle toegang tijdens sessie
  - Request deduplicatie (voorkomt dubbele API calls)

### 4. UI Features

#### Hoofdscherm
- **Hero Section**: NPO Radio 2 branding
- **Nieuwsfeed**: Top 3 Top 2000 gerelateerde nieuwsitems
- **Filtering**:
  - Zoeken op artiest/titel
  - Jaar selector (Allertijden of specifiek jaar)
- **Infinite Scroll**: Laadt 20 items per batch
- **Lazy Loading**: Images en metadata alleen bij zichtbaarheid

#### Song Cards
- Toont rank, artiest, titel, score
- Badge met rank verandering (groen=stijger, rood=daler, grijs=nieuw/gelijk)
- Lazy-loaded album covers
- Audio preview player (mini versie)
- Hover effecten en animaties

#### Detail Modal
- **Overzicht Tab**:
  - Ranking geschiedenis grafiek (Recharts)
  - AI-gegenereerde analyse (WebLLM)
  - Andere nummers van dezelfde artiest
- **Songtekst Tab**:
  - Lyrics via lyrics.ovh API
- **Navigatie**:
  - Vorige/Volgende buttons
  - Keyboard shortcuts (pijltjes, Escape)
- **Audio Player**: Volledige preview speler

### 5. Performance Optimalisaties

#### Lazy Loading
- Intersection Observer voor song cards
- Metadata alleen fetchen bij zichtbaarheid
- Images met `loading="lazy"`

#### Request Optimalisatie
- Request deduplicatie (pending requests map)
- Prefetch alleen voor top 50 songs
- Staggered prefetch (100ms delay tussen requests)

#### Rate Limiting Handling
- Exponential backoff voor iTunes API
- Max 50 retries met jitter
- Detectie van rate limits (429, 403)
- Fallback queries (verschillende search termen)

#### Audio Player
- Retry logic met exponential backoff
- Error handling en recovery
- Pause andere players bij play

## Data Flow

```
1. App Mount
   ↓
2. Check LocalStorage Cache
   ├─ Cache Hit (< 24h) → Load from cache
   └─ Cache Miss → Scrape Wikipedia
      ↓
3. Parse Wikipedia HTML
   ↓
4. Calculate Scores & Ranks
   ↓
5. Store in LocalStorage
   ↓
6. Render Song Cards (Lazy)
   ↓
7. On Visibility → Fetch iTunes Metadata
   ├─ Check IndexedDB
   ├─ Check Memory Cache
   └─ API Call → Store in caches
   ↓
8. User Clicks Song → Open Modal
   ↓
9. Fetch Analysis (WebLLM) + Lyrics (on demand)
```

## Type Definities

```typescript
interface SongData {
  id: string;
  artist: string;
  title: string;
  releaseYear: number;
  rankings: RankingHistory;  // { "1999": 1, "2000": 2, ... }
  totalScore?: number;         // Allertijden score
  coverUrl?: string | null;   // iTunes artwork
  previewUrl?: string | null; // iTunes preview
  allTimeRank?: number;        // Calculated rank
  previousAllTimeRank?: number; // For comparison
}
```

## Deployment

### GitHub Pages
- **Workflow**: `.github/workflows/deploy.yml`
- **Trigger**: Push naar `main` branch
- **Build**: `npm run build` → `dist/` folder
- **Base Path**: `/Top-2000-Alltime/` (configured in vite.config.ts)

### Build Configuratie
- **Base URL**: Aangepast voor GitHub Pages subdirectory
- **Server**: Port 3000, host 0.0.0.0
- **Path Aliases**: `@/*` → root directory

## Sterke Punten

1. **Robuuste Data Verwerking**:
   - Automatische detectie van incomplete jaren
   - Fallback logica voor Wikipedia parsing
   - Error handling op alle API calls

2. **Performance**:
   - Multi-layer caching (Memory, IndexedDB, LocalStorage)
   - Lazy loading en infinite scroll
   - Request deduplicatie

3. **User Experience**:
   - Responsive design
   - Smooth animaties
   - Keyboard shortcuts
   - Loading states en error handling

4. **Code Kwaliteit**:
   - TypeScript voor type safety
   - Goed gestructureerde componenten
   - Herbruikbare services
   - Duidelijke scheiding van concerns

## Mogelijke Verbeteringen

1. **Error Handling**:
   - Betere user feedback bij API failures
   - Retry UI voor failed requests
   - Offline mode indicator

2. **Testing**:
   - Geen tests aanwezig
   - Unit tests voor score berekening
   - Integration tests voor services

3. **Accessibility**:
   - ARIA labels kunnen uitgebreid worden
   - Keyboard navigation kan verbeterd worden
   - Screen reader support

4. **Performance**:
   - Virtual scrolling voor grote lijsten
   - Service Worker voor offline support
   - Image optimization (WebP, lazy loading)

5. **Features**:
   - Export functionaliteit (Excel/PDF) is nu dummy
   - Share functionaliteit kan uitgebreid worden
   - Filters (genre, decade, etc.)

## Dependencies Analyse

### Production Dependencies
- `react`, `react-dom`: Core framework
- `recharts`: Grafieken (ranking geschiedenis)
- `@mlc-ai/web-llm`: Lokale AI (geen API key nodig)

### Dev Dependencies
- `vite`: Build tool
- `@vitejs/plugin-react`: React support
- `typescript`: Type checking
- `@types/node`: Node types

### Externe Dependencies (CDN)
- Tailwind CSS (via CDN)
- Google Fonts (Inter, Oswald)
- Gemini API runtime (via CDN)

## Security Overwegingen

1. **CORS**: Gebruikt proxies voor RSS feed (AllOrigins, CorsProxy)
2. **API Keys**: Geen hardcoded keys (WebLLM is keyless)
3. **XSS**: React escapt automatisch, maar HTML parsing in Wikipedia service
4. **Rate Limiting**: Handled met exponential backoff

## Browser Compatibiliteit

- **IndexedDB**: Moderne browsers
- **Intersection Observer**: Moderne browsers
- **ES2022**: Moderne browsers (geen IE11 support)
- **WebLLM**: Vereist WebAssembly support

## Conclusie

Dit is een goed gestructureerde, moderne React applicatie met:
- ✅ Sterke data verwerking en caching
- ✅ Goede performance optimalisaties
- ✅ Mooie UX met animaties en responsive design
- ✅ TypeScript voor type safety
- ⚠️ Geen tests
- ⚠️ Sommige features zijn nog dummy (export)
- ⚠️ Kan profiteren van meer error handling UI

De applicatie is production-ready voor de core functionaliteit, maar kan nog uitgebreid worden met tests en extra features.
