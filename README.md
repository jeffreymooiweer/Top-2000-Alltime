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
  - **Spotify Playlist**: Exporteer als CSV met zoeklinks voor Spotify
  - **Deezer Playlist**: Exporteer als CSV met zoeklinks voor Deezer
  - **YouTube Music Playlist**: Exporteer als CSV voor import in YouTube Music

## 🚀 Technologie Stack

- **React 19.2.1** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool en development server
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - React chart library voor visualisaties
- **xlsx** - Excel bestandsgeneratie
- **jspdf** - PDF generatie

## 📁 Project Structuur

```
top-2000-allertijden/
├── components/          # React componenten
│   ├── AudioPlayer.tsx
│   ├── Modal.tsx
│   ├── NewsFeed.tsx
│   ├── SongCard.tsx
│   └── SongChart.tsx
├── services/            # API services en data logica
│   ├── exportService.ts
│   ├── geminiService.ts
│   ├── itunesService.ts
│   ├── lyricsService.ts
│   ├── mockData.ts
│   ├── rssService.ts
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

## 📊 Data Bronnen

- **Wikipedia**: Historische Top 2000 data wordt gescrapet van de pagina "Lijst_van_Radio_2-Top_2000's"
- **iTunes API**: Album covers en audio previews
- **RSS Feed**: Nieuws over de Top 2000

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

### Playlist Export
Exporteer de lijst als afspeellijst voor verschillende muziekdiensten:

- **Spotify**: CSV bestand met zoeklinks naar elk nummer op Spotify
- **Deezer**: CSV bestand met zoeklinks naar elk nummer op Deezer  
- **YouTube Music**: CSV bestand dat direct geïmporteerd kan worden in YouTube Music

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
