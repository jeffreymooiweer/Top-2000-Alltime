
import React, { useEffect, useState, useMemo, useRef, useCallback, Suspense, lazy } from 'react';
import { SongData } from './types';
import { scrapeWikipediaData } from './services/wikipediaService'; 
import { exportToExcel, exportToPDF, exportForTransfer } from './services/exportService';
import {
  initiateSpotifyAuth,
  handleSpotifyCallback,
  initiateDeezerAuth,
  handleDeezerCallback,
  initiateYouTubeAuth,
  handleYouTubeCallback,
  createSpotifyPlaylist,
  createDeezerPlaylist,
  createYouTubePlaylist,
  isSpotifyAuthenticated,
  isDeezerAuthenticated,
  isYouTubeAuthenticated,
  SpotifyPlaylistResult,
} from './services/streamingService';
import SongCard from './components/SongCard';
import NewsFeed from './components/NewsFeed';
import StreamingSetupModal from './components/StreamingSetupModal';

// Lazy load Modal component (large component with chart and analysis)
const Modal = lazy(() => import('./components/Modal'));

import HowItWorksModal from './components/HowItWorksModal';

// Calculation Logic:
// Rank 1 = 2000 points. Rank 2000 = 1 point.
// Formula: Points = 2001 - Rank.
const calculateScoreForYear = (rank: number | null | undefined): number => {
    if (rank !== null && rank !== undefined && rank > 0 && rank <= 2000) {
        return 2001 - rank;
    }
    return 0;
};

// Updated to accept a cutoff year to exclude partial data
const calculateAllTimeScore = (song: SongData, limitYear?: number): number => {
  let score = 0;
  Object.entries(song.rankings).forEach(([yearStr, rank]) => {
    const year = parseInt(yearStr);
    // If a limitYear is set, ignore rankings from years AFTER that limit
    if (limitYear !== undefined && year > limitYear) return;
    score += calculateScoreForYear(rank);
  });
  return score;
};

const BATCH_SIZE = 20;
const CACHE_KEY = 'top2000_data_v3'; // Version bump for partial data fix
const CACHE_TIME_KEY = 'top2000_timestamp_v3';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const App: React.FC = () => {
  const [songs, setSongs] = useState<SongData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Verbinding maken met Wikipedia...");
  const [selectedSong, setSelectedSong] = useState<SongData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Header Menus State
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  
  // Streaming Setup State
  const [streamingSetupService, setStreamingSetupService] = useState<'spotify' | 'deezer' | 'youtube' | null>(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [playlistProgress, setPlaylistProgress] = useState({ current: 0, total: 0 });
  const [playlistResult, setPlaylistResult] = useState<{ playlistUrl: string; addedCount: number; failedSongs: Array<{ title: string; artist: string }> } | null>(null);
  
  // Year Selection State: 'all-time' or a specific year string like '2023'
  const [selectedYear, setSelectedYear] = useState<string>('all-time');
  
  // Infinite Scroll State
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const spotifyCallbackProcessed = useRef(false);
  
  // Refs for click-outside detection
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const shareDropdownRef = useRef<HTMLDivElement>(null);
  const newsFeedRef = useRef<HTMLDivElement>(null);
  
  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        
        if (isDownloadOpen && 
            downloadButtonRef.current && !downloadButtonRef.current.contains(target) &&
            downloadDropdownRef.current && !downloadDropdownRef.current.contains(target)) {
            setIsDownloadOpen(false);
        }
        
        if (isShareOpen && 
            shareButtonRef.current && !shareButtonRef.current.contains(target) &&
            shareDropdownRef.current && !shareDropdownRef.current.contains(target)) {
            setIsShareOpen(false);
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDownloadOpen, isShareOpen]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Generate available years list based on data
  const availableYears = useMemo(() => {
    if (songs.length === 0) return [];
    const years = Object.keys(songs[0].rankings)
        .filter(k => !isNaN(parseInt(k)))
        .sort((a, b) => parseInt(b) - parseInt(a));
    return years;
  }, [songs]);

  // Filter and Sort Songs based on Search AND Selected Year
  const processedSongs = useMemo(() => {
    let result = [...songs];

    // 1. Search Filter (using debounced query)
    if (debouncedSearchQuery) {
        const lowerQuery = debouncedSearchQuery.toLowerCase();
        result = result.filter(s => 
            s.title.toLowerCase().includes(lowerQuery) || 
            s.artist.toLowerCase().includes(lowerQuery)
        );
    }

    // 2. Year Filter & Sort
    if (selectedYear !== 'all-time') {
        result = result.filter(s => s.rankings[selectedYear] !== null && s.rankings[selectedYear] !== undefined);
        result.sort((a, b) => {
            const rankA = a.rankings[selectedYear] as number;
            const rankB = b.rankings[selectedYear] as number;
            return rankA - rankB;
        });
    } else {
        result.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    }

    return result;
  }, [songs, debouncedSearchQuery, selectedYear]);
  
  // Handle OAuth Callbacks
  useEffect(() => {
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    
    // Spotify callback
    if ((hash.includes('spotify-callback') || searchParams.has('code')) && !spotifyCallbackProcessed.current) {
      // Mark as processed immediately to prevent double processing
      spotifyCallbackProcessed.current = true;
      
      // Try to extract code from hash first, then from query string
      let code: string | null = null;
      let error: string | null = null;
      
      // Check hash for callback
      if (hash.includes('spotify-callback')) {
        // Format could be: #spotify-callback?code=... or #spotify-callback&code=...
        const hashWithoutHash = hash.substring(1); // Remove #
        const hashParts = hashWithoutHash.split('?');
        if (hashParts.length > 1) {
          const queryString = hashParts[1];
          const params = new URLSearchParams(queryString);
          code = params.get('code');
          error = params.get('error');
        } else {
          // Try splitting by &
          const hashParts2 = hashWithoutHash.split('&');
          for (const part of hashParts2) {
            if (part.startsWith('code=')) {
              code = part.substring(5);
            } else if (part.startsWith('error=')) {
              error = part.substring(6);
            }
          }
        }
      }
      
      // If not found in hash, check query string
      if (!code && !error) {
        code = searchParams.get('code');
        error = searchParams.get('error');
      }
      
      if (error) {
        alert(`Spotify authenticatie mislukt: ${error}`);
        window.location.hash = '';
        window.history.replaceState(null, '', window.location.pathname);
        spotifyCallbackProcessed.current = false; // Reset on error
        return;
      }
      
      if (code) {
        // Show loading indicator
        setIsCreatingPlaylist(true);
        
        handleSpotifyCallback(code)
          .then(async () => {
            window.location.hash = '';
            window.history.replaceState(null, '', window.location.pathname);
            setStreamingSetupService(null);
            
            // Automatically create playlist after successful authentication
            if (processedSongs.length > 0) {
              try {
                const yearLabel = selectedYear === 'all-time' ? 'Allertijden' : selectedYear;
                const playlistName = `Top 2000 ${yearLabel} - ${new Date().toLocaleDateString('nl-NL')}`;
                const playlistUrl = await createSpotifyPlaylist(processedSongs, playlistName);
                alert(`Playlist succesvol aangemaakt! Open de playlist: ${playlistUrl}`);
                window.open(playlistUrl, '_blank');
              } catch (error: any) {
                alert(`Fout bij aanmaken playlist: ${error.message}`);
              } finally {
                setIsCreatingPlaylist(false);
              }
            } else {
              setIsCreatingPlaylist(false);
              alert('Spotify account succesvol gekoppeld! Je kunt nu een playlist aanmaken via het download menu.');
            }
          })
          .catch((err) => {
            setIsCreatingPlaylist(false);
            console.error('Spotify callback error:', err);
            alert(`Fout bij koppelen Spotify account: ${err.message || 'Onbekende fout. Controleer de console voor meer details.'}`);
            window.location.hash = '';
            window.history.replaceState(null, '', window.location.pathname);
            spotifyCallbackProcessed.current = false; // Reset on error so user can retry
          });
      } else if (hash.includes('spotify-callback')) {
        // Hash contains spotify-callback but no code - might be an error
        console.warn('Spotify callback detected but no code found in URL:', hash);
        setIsCreatingPlaylist(false);
        alert('Geen autorisatiecode ontvangen van Spotify. Probeer het opnieuw.');
        window.location.hash = '';
        window.history.replaceState(null, '', window.location.pathname);
        spotifyCallbackProcessed.current = false; // Reset on error
      }
    }
    
    // Deezer callback
    if (hash.includes('deezer-callback') || hash.includes('access_token')) {
      // Deezer uses implicit flow - token is in hash fragment
      // Format could be: #deezer-callback#access_token=... or #access_token=...
      // Find the part with access_token or error
      const hashParts = hash.split('#').filter(Boolean);
      let queryString = hash.substring(1); // Default to entire hash without #
      
      for (const part of hashParts) {
        if (part.includes('access_token') || part.includes('error_reason')) {
          queryString = part;
          break;
        }
      }
      
      const params = new URLSearchParams(queryString);
      const accessToken = params.get('access_token');
      const expires = params.get('expires');
      const error = params.get('error_reason');
      
      if (error) {
        alert(`Deezer authenticatie mislukt: ${error}`);
        window.location.hash = '';
        return;
      }
      
      if (accessToken && expires) {
        handleDeezerCallback(accessToken, parseInt(expires));
        window.location.hash = '';
        setStreamingSetupService(null);
        
        // Automatically create playlist after successful authentication
        if (processedSongs.length > 0) {
          setIsCreatingPlaylist(true);
          (async () => {
            try {
              const yearLabel = selectedYear === 'all-time' ? 'Allertijden' : selectedYear;
              const playlistName = `Top 2000 ${yearLabel} - ${new Date().toLocaleDateString('nl-NL')}`;
              const playlistUrl = await createDeezerPlaylist(processedSongs, playlistName);
              alert(`Playlist succesvol aangemaakt! Open de playlist: ${playlistUrl}`);
              window.open(playlistUrl, '_blank');
            } catch (error: any) {
              alert(`Fout bij aanmaken playlist: ${error.message}`);
            } finally {
              setIsCreatingPlaylist(false);
            }
          })();
        } else {
          alert('Deezer account succesvol gekoppeld! Je kunt nu een playlist aanmaken via het download menu.');
        }
      }
    }
    
    // YouTube callback - Google OAuth uses query parameters, not hash fragments
    const youtubeCode = searchParams.get('code');
    const youtubeError = searchParams.get('error');
    const youtubeState = searchParams.get('state');
    
    // Check if this is a YouTube callback (either via query param or hash for backwards compatibility)
    if (youtubeCode || youtubeError || hash.includes('youtube-callback')) {
      // For Google OAuth, code comes via query parameters
      if (youtubeError) {
        alert(`YouTube authenticatie mislukt: ${youtubeError}`);
        // Clean up URL
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }
      
      if (youtubeCode) {
        handleYouTubeCallback(youtubeCode)
          .then(async () => {
            // Clean up URL - remove query parameters
            window.history.replaceState(null, '', window.location.pathname);
            setStreamingSetupService(null);
            
            // Automatically create playlist after successful authentication
            if (processedSongs.length > 0) {
              setIsCreatingPlaylist(true);
              try {
                const yearLabel = selectedYear === 'all-time' ? 'Allertijden' : selectedYear;
                const playlistName = `Top 2000 ${yearLabel} - ${new Date().toLocaleDateString('nl-NL')}`;
                const result = await createYouTubePlaylist(processedSongs, playlistName);
                setPlaylistResult(result);
              } catch (error: any) {
                setIsCreatingPlaylist(false);
                alert(`Fout bij aanmaken playlist: ${error.message}`);
              }
            } else {
              alert('YouTube account succesvol gekoppeld! Je kunt nu een playlist aanmaken via het download menu.');
            }
          })
          .catch((err) => {
            alert(`Fout bij koppelen: ${err.message}`);
            // Clean up URL
            window.history.replaceState(null, '', window.location.pathname);
          });
      } else if (hash.includes('youtube-callback')) {
        // Backwards compatibility: handle old hash-based callback
        const hashParts = hash.split('?');
        const queryString = hashParts.length > 1 ? hashParts[1] : '';
        const params = new URLSearchParams(queryString);
        const code = params.get('code');
        const error = params.get('error');
        
        if (error) {
          alert(`YouTube authenticatie mislukt: ${error}`);
          window.location.hash = '';
          return;
        }
        
        if (code) {
          handleYouTubeCallback(code)
            .then(async () => {
              window.location.hash = '';
              setStreamingSetupService(null);
              
              if (processedSongs.length > 0) {
                setIsCreatingPlaylist(true);
                try {
                  const yearLabel = selectedYear === 'all-time' ? 'Allertijden' : selectedYear;
                  const playlistName = `Top 2000 ${yearLabel} - ${new Date().toLocaleDateString('nl-NL')}`;
                  const result = await createYouTubePlaylist(processedSongs, playlistName);
                  setPlaylistResult(result);
                } catch (error: any) {
                  setIsCreatingPlaylist(false);
                  alert(`Fout bij aanmaken playlist: ${error.message}`);
                }
              } else {
                alert('YouTube account succesvol gekoppeld! Je kunt nu een playlist aanmaken via het download menu.');
              }
            })
            .catch((err) => {
              alert(`Fout bij koppelen: ${err.message}`);
              window.location.hash = '';
            });
        }
      }
    }
  }, [processedSongs, selectedYear]);

  // Initialize Data
  useEffect(() => {
    const initData = async () => {
      try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        
        if (cachedData && cachedTime) {
            const age = Date.now() - parseInt(cachedTime);
            if (age < CACHE_DURATION) {
                console.log("Loading data from local cache...");
                const parsedSongs = JSON.parse(cachedData);
                setSongs(parsedSongs);
                setLoading(false);
                return;
            }
        }
      } catch (e) {
        console.warn("Cache read error", e);
      }

      try {
        setLoadingStatus("Top 2000 tabel downloaden en verwerken...");
        const rawSongs = await scrapeWikipediaData();
        
        if (rawSongs.length === 0) {
            setLoadingStatus("Fout: Kon geen data vinden op de Wikipedia pagina. Controleer console.");
            setLoading(false);
            return; 
        }

        setLoadingStatus(`Scores berekenen voor ${rawSongs.length} nummers...`);

        // 1. Determine the effective data range
        // We need to check if the latest year is "complete".
        // If only the Top 10 is known for 2025, we must NOT include it in All-Time calc
        // or it will unfairly boost those 10 songs by +2000 points.
        let maxYear = 0;
        let maxYearCount = 0;
        
        if (rawSongs.length > 0) {
            const allYears = new Set<number>();
            rawSongs.forEach(s => {
               Object.keys(s.rankings).forEach(y => {
                   const yInt = parseInt(y);
                   if(!isNaN(yInt)) allYears.add(yInt);
               });
            });
            
            if (allYears.size > 0) {
               maxYear = Math.max(...Array.from(allYears));
               // Count how many songs actually have a ranking for this maxYear
               maxYearCount = rawSongs.filter(s => s.rankings[maxYear.toString()] !== undefined && s.rankings[maxYear.toString()] !== null).length;
            }
        }

        // Threshold: If fewer than 1500 songs are known for the year, treat it as partial/incomplete.
        // Top 2000 should have... 2000.
        const isLatestYearIncomplete = maxYearCount < 1500;
        const effectiveAllTimeYear = isLatestYearIncomplete ? maxYear - 1 : maxYear;
        
        console.log(`Max Year found: ${maxYear} (${maxYearCount} entries). Using ${effectiveAllTimeYear} as cutoff for All-Time list.`);

        // Calculate scores
        let scoredSongs = rawSongs.map(song => {
          // Calculate All-Time score up to the effective safe year
          const totalScore = calculateAllTimeScore(song, effectiveAllTimeYear);
          
          // Calculate "Previous" score (One year before the effective year)
          // This allows us to compare "2023 All Time" vs "2022 All Time" properly
          const previousTotalScore = calculateAllTimeScore(song, effectiveAllTimeYear - 1);
          
          return {
              ...song,
              totalScore,
              previousTotalScore, // Temporary field for sorting
              coverUrl: undefined, 
              previewUrl: undefined
          };
        });

        // 1. Assign All-Time Ranks (Current Safe Year)
        scoredSongs.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
        scoredSongs = scoredSongs.map((song, index) => ({
          ...song,
          allTimeRank: index + 1
        }));

        // 2. Assign All-Time Ranks (Previous Safe Year)
        // We sort by the score calculated for the year prior
        const prevSorted = [...scoredSongs].sort((a, b) => (b.previousTotalScore || 0) - (a.previousTotalScore || 0));
        
        // Create a map to quickly look up the previous rank
        const prevRankMap = new Map<string, number>();
        prevSorted.forEach((song, index) => {
            // Only assign a previous rank if they actually had points previously
            if ((song.previousTotalScore || 0) > 0) {
                prevRankMap.set(song.id, index + 1);
            }
        });

        // Merge back into main array and cleanup temporary field
        const finalSongs = scoredSongs.map(song => {
            const { previousTotalScore, ...rest } = song; // Remove temp field
            return {
                ...rest,
                previousAllTimeRank: prevRankMap.get(song.id) // undefined if new entry or 0 points previously
            };
        });

        // Initial Sort is already done (by totalScore)

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(finalSongs));
          localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        } catch (e) {
          console.warn("Cache write error", e);
        }

        setSongs(finalSongs);
        setLoading(false);
      } catch (error) {
        console.error("Error initializing data:", error);
        setLoadingStatus("Fout bij het laden van data. Probeer de pagina te vernieuwen.");
        setLoading(false);
      }
    };

    initData();
  }, []);


  // Reset infinite scroll when filters change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    if (debouncedSearchQuery) {
        // Only scroll if we are deep down, otherwise it feels jumpy
        if (window.scrollY > 500) {
            window.scrollTo({ top: 400, behavior: 'smooth' });
        }
    }
  }, [debouncedSearchQuery, selectedYear]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (loading || processedSongs.length === 0) return;

    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < processedSongs.length) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, processedSongs.length));
        }
      },
      { threshold: 0.1, rootMargin: '400px' } // Increased rootMargin for earlier loading
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [loading, processedSongs.length, visibleCount]);

  const visibleSongs = useMemo(() => processedSongs.slice(0, visibleCount), [processedSongs, visibleCount]);

  // Derived state for Modal (Other songs by artist)
  const otherSongsBySelectedArtist = useMemo(() => {
    if (!selectedSong) return [];
    return songs
        .filter(s => s.artist === selectedSong.artist && s.id !== selectedSong.id)
        .sort((a,b) => (a.allTimeRank || 9999) - (b.allTimeRank || 9999));
  }, [selectedSong, songs]);

  const handleSelectSong = useCallback((song: SongData) => {
    setSelectedSong(song);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedSong(null);
  }, []);

  // Derived state for Navigation
  const selectedSongIndex = useMemo(() => {
    if (!selectedSong) return -1;
    return processedSongs.findIndex(s => s.id === selectedSong.id);
  }, [selectedSong, processedSongs]);

  const hasNext = selectedSongIndex >= 0 && selectedSongIndex < processedSongs.length - 1;
  const hasPrevious = selectedSongIndex > 0;

  const handleNext = useCallback(() => {
    if (hasNext) {
      setSelectedSong(processedSongs[selectedSongIndex + 1]);
    }
  }, [hasNext, processedSongs, selectedSongIndex]);

  const handlePrevious = useCallback(() => {
    if (hasPrevious) {
      setSelectedSong(processedSongs[selectedSongIndex - 1]);
    }
  }, [hasPrevious, processedSongs, selectedSongIndex]);

  const handleNavbarSearchClick = () => {
      if (searchInputRef.current) {
          searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => searchInputRef.current?.focus(), 500);
      }
  };

  const toggleShare = useCallback(() => { setIsShareOpen(prev => !prev); setIsDownloadOpen(false); }, []);
  const toggleDownload = useCallback(() => { setIsDownloadOpen(prev => !prev); setIsShareOpen(false); }, []);

  const handleDownload = useCallback(async (type: string) => {
    try {
      switch (type) {
        case 'Excel':
          exportToExcel(processedSongs, selectedYear);
          setIsDownloadOpen(false);
          break;
        case 'PDF':
          exportToPDF(processedSongs, selectedYear);
          setIsDownloadOpen(false);
          break;
        case 'Spotify':
          await handleStreamingExport('spotify');
          break;
        case 'Deezer':
          await handleStreamingExport('deezer');
          break;
        case 'YouTube Music':
          await handleStreamingExport('youtube');
          break;
        case 'Transfer':
          exportForTransfer(processedSongs);
          setIsDownloadOpen(false);
          break;
        default:
          console.warn(`Unknown export type: ${type}`);
      }
    } catch (error: any) {
      console.error(`Error exporting ${type}:`, error);
      alert(`Er is een fout opgetreden: ${error.message || 'Onbekende fout'}`);
    }
  }, [processedSongs, selectedYear]);

  const handleStreamingExport = async (service: 'spotify' | 'deezer' | 'youtube') => {
    // Check if configured
    let config;
    if (service === 'spotify') {
      config = isSpotifyAuthenticated();
    } else if (service === 'deezer') {
      config = isDeezerAuthenticated();
    } else {
      config = isYouTubeAuthenticated();
    }

    if (!config) {
      // Show setup modal
      setStreamingSetupService(service);
      setIsDownloadOpen(false);
      return;
    }

    // Check if authenticated, if not initiate auth
    if (service === 'spotify' && !isSpotifyAuthenticated()) {
      await initiateSpotifyAuth();
      return;
    } else if (service === 'deezer' && !isDeezerAuthenticated()) {
      initiateDeezerAuth();
      return;
    } else if (service === 'youtube' && !isYouTubeAuthenticated()) {
      await initiateYouTubeAuth();
      return;
    }

    // Create playlist
    setIsCreatingPlaylist(true);
    setPlaylistProgress({ current: 0, total: processedSongs.length });
    setPlaylistResult(null);
    setIsDownloadOpen(false);

    try {
      const yearLabel = selectedYear === 'all-time' ? 'Allertijden' : selectedYear;
      const playlistName = `Top 2000 ${yearLabel} - ${new Date().toLocaleDateString('nl-NL')}`;
      
      if (service === 'spotify') {
        const result = await createSpotifyPlaylist(
          processedSongs, 
          playlistName,
          (current, total) => setPlaylistProgress({ current, total })
        );
        setPlaylistResult(result);
        // Don't close modal yet - show result modal instead
      } else if (service === 'deezer') {
        const playlistUrl = await createDeezerPlaylist(processedSongs, playlistName);
        setIsCreatingPlaylist(false);
        alert(`Playlist succesvol aangemaakt! Open de playlist: ${playlistUrl}`);
        window.open(playlistUrl, '_blank');
      } else {
        const result = await createYouTubePlaylist(
          processedSongs, 
          playlistName,
          (current, total) => setPlaylistProgress({ current, total })
        );
        setPlaylistResult(result);
      }
    } catch (error: any) {
      setIsCreatingPlaylist(false);
      alert(`Fout bij aanmaken playlist: ${error.message}`);
    }
  };

  const handleStreamingSetupAuth = useCallback(async () => {
    if (!streamingSetupService) return;

    try {
      if (streamingSetupService === 'spotify') {
        await initiateSpotifyAuth();
      } else if (streamingSetupService === 'deezer') {
        initiateDeezerAuth();
      } else {
        await initiateYouTubeAuth();
      }
    } catch (error: any) {
      alert(`Fout bij starten authenticatie: ${error.message}`);
    }
  }, [streamingSetupService]);

  return (
    <div className="min-h-screen bg-[#f3f4f6] font-sans">
      
      {isMenuOpen && (
          <div className="fixed inset-0 z-50 flex">
              <div className="fixed inset-0 bg-black/50" onClick={() => setIsMenuOpen(false)}></div>
              <div className="relative bg-[#e60028] w-72 h-full text-white p-6 shadow-xl animate-slide-in-left flex flex-col">
                  <button onClick={() => setIsMenuOpen(false)} className="mb-8 font-bold text-xl flex items-center gap-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      Sluiten
                  </button>
                  
                  <div className="flex-1 overflow-y-auto py-4">
                      <nav className="space-y-2">
                          <button 
                              onClick={() => { 
                                  setIsMenuOpen(false); 
                                  setSearchQuery(''); 
                                  setSelectedYear('all-time'); 
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                              }} 
                              className="block w-full text-left py-3 px-4 hover:bg-white/10 rounded transition font-medium"
                          >
                              Home
                          </button>
                          <button 
                              onClick={() => { 
                                  setIsMenuOpen(false);
                                  newsFeedRef.current?.scrollIntoView({ behavior: 'smooth' });
                              }} 
                              className="block w-full text-left py-3 px-4 hover:bg-white/10 rounded transition font-medium"
                          >
                              Nieuws
                          </button>
                          
                          <div className="h-px bg-white/20 my-2 mx-4"></div>
                          
                          <button 
                              onClick={() => { 
                                  setIsMenuOpen(false);
                                  setIsHowItWorksOpen(true);
                              }} 
                              className="block w-full text-left py-3 px-4 hover:bg-white/10 rounded transition font-medium"
                          >
                              Hoe werkt het?
                          </button>
                      </nav>
                  </div>

                  <div className="mt-auto pt-6 border-t border-white/20 text-white/80 text-sm">
                       <div className="flex items-center gap-4 mb-4">
                          <a href="https://github.com/jeffreymooiweer/Top-2000-Alltime" target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100 transition">
                              <img src={`${import.meta.env.BASE_URL}Image/Github-Emblem.png`} alt="GitHub" className="h-6 w-auto" />
                          </a>
                          <a href="https://www.cloudflare.com/" target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100 transition">
                              <img src={`${import.meta.env.BASE_URL}Image/Cloudflare_Logo.svg.png`} alt="Cloudflare" className="h-6 w-auto" />
                          </a>
                       </div>
                       <p>© 2025 Top 2000 Allertijden - <a href="https://mooiweer.me" target="_blank" rel="noopener noreferrer" className="hover:text-white underline decoration-white/30 hover:decoration-white transition">mooiweer.me</a></p>
                  </div>
              </div>
          </div>
      )}

      <header className="bg-[#e60028] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button className="text-white hover:bg-white/10 p-2 rounded transition" onClick={() => setIsMenuOpen(true)}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div className="cursor-pointer" onClick={() => { setSearchQuery(''); setSelectedYear('all-time'); window.scrollTo(0,0); }}>
                   <img 
                    src="https://assets-start.npo.nl/resources/2025/11/20/41ed2cbc-8b8b-4b71-b6ec-9af8817f2a08.png" 
                    alt="Top 2000 Logo" 
                    className="h-16 w-auto object-contain py-1"
                    loading="eager"
                    fetchPriority="high"
                   />
                </div>
            </div>

            <button onClick={handleNavbarSearchClick} className="p-2 hover:bg-white/10 rounded-full transition">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto md:px-4">
      
        {!debouncedSearchQuery && (
            <div 
                className="relative flex flex-col justify-center min-h-[400px] p-10 overflow-hidden"
                style={{
                    background: 'linear-gradient(295deg, rgb(217, 21, 27) 11%, rgb(156, 27, 33) 100%)'
                }}
            >
                 <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'url("https://www.nporadio2.nl/svg/header-large.svg") center center / cover no-repeat'
                    }}
                 ></div>
                 
                 <div className="relative z-10 max-w-xl">
                        <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/a/a4/NPO_Radio_2_Top_2000_logo.png" 
                            alt="NPO Radio 2 Top 2000"
                            className="max-w-[240px] md:max-w-[350px] mb-6 drop-shadow-2xl"
                            loading="eager"
                            fetchPriority="high"
                        />

                         <h2 className="text-2xl md:text-4xl font-bold text-white mb-8 brand-font leading-tight drop-shadow-md">
                             De ultieme lijst gebaseerd op historische data.
                         </h2>
                         <button onClick={() => searchInputRef.current?.scrollIntoView({behavior: 'smooth'})} className="bg-white text-[#d00018] px-8 py-3 font-bold uppercase tracking-wider hover:bg-gray-100 transition rounded shadow-lg border-2 border-transparent hover:border-white">
                             BEKIJK DE LIJST
                         </button>
                 </div>
            </div>
        )}

        {/* RSS Feed Section */}
        {!debouncedSearchQuery && (
          <div ref={newsFeedRef}>
            <NewsFeed />
          </div>
        )}

        {/* Promo Buttons Section */}
        {!debouncedSearchQuery && (
            <div className="mb-8 flex flex-col items-center bg-transparent">
                <h3 className="text-gray-900 text-lg font-bold mb-4 uppercase tracking-wider drop-shadow-md text-center px-4">
                    Beluister hier de lijst op je favoriete streamingdienst
                </h3>
                <div className="px-2 md:px-0 flex flex-wrap gap-2 md:gap-4 justify-center items-center">
                    {[
                        {
                            name: 'Spotify',
                            icon: 'icon_spotify.png',
                            link: 'https://open.spotify.com/playlist/2n4xz2gkGaY3GokSxeWzHC?si=eVTtfX0XSz2VIMY7OaA8Bg&pi=o3kWWqn0QSSKl'
                        },
                        {
                            name: 'Deezer',
                            icon: 'icon_deezer.png',
                            link: 'https://www.deezer.com/playlist/14697905101'
                        },
                        {
                            name: 'YouTube Music',
                            icon: 'icon_ytm.png',
                            link: 'https://music.youtube.com/playlist?list=PLIaIWD17L__XkoxtAkhMe_YIcSNov8Ox0&si=bmIrVEv1wZcNY3F1'
                        },
                        {
                            name: 'Tidal',
                            icon: 'icon_tidal.png',
                            link: 'https://tidal.com/browse/playlist/545e3d24-a1a0-47fe-af88-70a154e77073'
                        },
                        {
                            name: 'Apple Music',
                            icon: 'icon_apple.png',
                            link: '#'
                        }
                    ].map((service) => (
                        <a 
                            key={service.name}
                            href={service.link}
                            target={service.link === '#' ? undefined : "_blank"}
                            rel={service.link === '#' ? undefined : "noopener noreferrer"}
                            className={`block group relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 ${service.link === '#' ? 'cursor-default opacity-80' : ''}`}
                            onClick={service.link === '#' ? (e) => e.preventDefault() : undefined}
                        >
                            <img 
                                src={`${import.meta.env.BASE_URL}Image/${service.icon}`} 
                                alt={`Listen on ${service.name}`} 
                                className="w-12 h-12 md:w-16 md:h-16 object-contain"
                            />
                        </a>
                    ))}
                </div>
            </div>
        )}

        {/* Main List Container */}
        <div className={`bg-gradient-to-b from-[#9a1a1a] to-[#2b0505] min-h-screen ${debouncedSearchQuery ? 'rounded-t-xl' : 'rounded-t-none'} overflow-visible shadow-2xl relative pb-10`}>
            
            {/* Header / Controls Section */}
            <div className="px-4 pt-8 pb-4 space-y-4">
                
                {/* Row 1: Title and Action Buttons */}
                <div className="flex justify-between items-start">
                     <h2 className="text-white text-3xl font-bold brand-font leading-none uppercase drop-shadow-md">
                         NPO Radio 2<br/>Top 2000
                     </h2>
                     <div className="flex gap-2 relative z-30">
                         {/* Download Button */}
                         <button 
                            ref={downloadButtonRef}
                            onClick={toggleDownload} 
                            className={`p-2 rounded flex items-center justify-center transition backdrop-blur-sm border ${isDownloadOpen ? 'bg-white text-[#d00018] border-white' : 'bg-black/20 text-white border-transparent hover:bg-black/30'}`}
                         >
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         </button>
                         
                         {/* Download Menu Dropdown */}
                         {isDownloadOpen && (
                             <div ref={downloadDropdownRef} className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl overflow-hidden animate-fade-in-up origin-top-right ring-1 ring-black/5 z-60">
                                 <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                     Download als
                                 </div>
                                 <button onClick={() => handleDownload('Excel')} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-gray-700 transition">
                                     <img src={`${import.meta.env.BASE_URL}Image/xls.png`} alt="Excel" className="w-6 h-6 object-contain" />
                                     <span className="font-medium">Excel</span>
                                 </button>
                                 <button onClick={() => handleDownload('PDF')} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-gray-700 border-t border-gray-100 transition">
                                     <img src={`${import.meta.env.BASE_URL}Image/pdf.png`} alt="PDF" className="w-6 h-6 object-contain" />
                                     <span className="font-medium">PDF</span>
                                 </button>
                                 <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-t border-gray-100 mt-1">
                                     Afspeellijst
                                 </div>
                                 <button onClick={() => handleDownload('Spotify')} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-gray-700 transition">
                                     <img src={`${import.meta.env.BASE_URL}Image/spotify.png`} alt="Spotify" className="w-6 h-6 object-contain" />
                                     <div className="flex-1 flex items-center justify-between">
                                       <span className="font-medium">Spotify</span>
                                       {isSpotifyAuthenticated() && (
                                         <span className="text-xs text-green-600 font-bold">✓</span>
                                       )}
                                     </div>
                                 </button>
                                 <button onClick={() => handleDownload('Deezer')} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-gray-700 border-t border-gray-100 transition">
                                     <img src={`${import.meta.env.BASE_URL}Image/deezer.png`} alt="Deezer" className="w-6 h-6 object-contain" />
                                     <div className="flex-1 flex items-center justify-between">
                                       <span className="font-medium">Deezer</span>
                                       {isDeezerAuthenticated() && (
                                         <span className="text-xs text-green-600 font-bold">✓</span>
                                       )}
                                     </div>
                                 </button>
                                 <button onClick={() => handleDownload('YouTube Music')} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-gray-700 border-t border-gray-100 transition">
                                     <img src={`${import.meta.env.BASE_URL}Image/play.png`} alt="YouTube Music" className="w-6 h-6 object-contain" />
                                     <div className="flex-1 flex items-center justify-between">
                                       <span className="font-medium">YouTube Music</span>
                                       {isYouTubeAuthenticated() && (
                                         <span className="text-xs text-green-600 font-bold">✓</span>
                                       )}
                                     </div>
                                 </button>
                                 
                                 <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-t border-gray-100 mt-1">
                                     Overig
                                 </div>
                                 <button onClick={() => handleDownload('Transfer')} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-gray-700 transition">
                                     <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                     <span className="font-medium">Voor Soundiiz / Transfer</span>
                                 </button>
                             </div>
                         )}

                         {/* Share Button */}
                         <button 
                            ref={shareButtonRef}
                            onClick={toggleShare} 
                            className={`px-3 py-2 rounded flex items-center gap-2 font-bold text-sm transition backdrop-blur-sm border ${isShareOpen ? 'bg-white text-[#d00018] border-white' : 'bg-black/20 text-white border-transparent hover:bg-black/30'}`}
                         >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                             Delen
                         </button>

                         {/* Share Menu Dropdown */}
                         {isShareOpen && (
                             <div ref={shareDropdownRef} className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl overflow-hidden animate-fade-in-up origin-top-right ring-1 ring-black/5">
                                 <a 
                                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Check de Top 2000 Allertijden!")}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-gray-700 transition group"
                                 >
                                     <span className="font-bold text-lg w-6 text-center">𝕏</span> 
                                     <span className="font-medium group-hover:text-black">Deel via X</span>
                                 </a>
                                 <a 
                                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-gray-700 border-t border-gray-100 transition group"
                                 >
                                     <span className="font-bold text-lg w-6 text-center text-blue-600">f</span> 
                                     <span className="font-medium group-hover:text-blue-700">Deel via Facebook</span>
                                 </a>
                                 <a 
                                    href={`https://wa.me/?text=${encodeURIComponent("Check de Top 2000 Allertijden! " + window.location.href)}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-gray-700 border-t border-gray-100 transition group"
                                 >
                                     <svg className="w-6 h-6 text-green-500 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                     <span className="font-medium group-hover:text-green-600">Deel via WhatsApp</span>
                                 </a>
                             </div>
                         )}
                     </div>
                </div>

                {/* Row 2: Year Selector */}
                <div className="relative z-20">
                    <div className="w-full bg-transparent border border-white/50 rounded flex items-center text-white h-14 relative hover:border-white transition-colors cursor-pointer group">
                        <div className="px-5 font-normal text-white/90 border-r border-white/30 h-full flex items-center text-lg">Jaar</div>
                        <div className="flex-1 px-5 font-bold flex items-center justify-between text-lg">
                            <span>{selectedYear === 'all-time' ? 'Allertijden' : selectedYear}</span>
                            <svg className="w-6 h-6 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        {/* Invisible Select overlay for native behavior */}
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-black"
                        >
                             <option value="all-time" className="bg-white text-gray-900">Allertijden</option>
                             {availableYears.map(y => <option key={y} value={y} className="bg-white text-gray-900">{y}</option>)}
                        </select>
                    </div>
                </div>

                {/* Row 3: Search Bar */}
                <div className="relative flex h-14 bg-white rounded overflow-hidden shadow-lg z-10">
                     <input 
                         ref={searchInputRef}
                         id="searchInput"
                         type="text"
                         className="flex-1 px-5 text-gray-900 placeholder-gray-500 bg-white h-full outline-none text-lg"
                         placeholder="Zoeken" 
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                     />
                     <button onClick={() => searchQuery ? setSearchQuery('') : null} className="bg-[#d00018] w-14 flex items-center justify-center text-white hover:bg-[#b00014] transition">
                         {searchQuery ? (
                             <span className="text-white font-bold text-2xl">&times;</span>
                         ) : (
                             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                         )}
                     </button>
                </div>
            </div>

            <div className="p-4 md:p-6 space-y-3">
                 {loading ? (
                    <div className="text-center py-20">
                        <div className="w-12 h-12 border-4 border-[#d00018] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-white font-bold animate-pulse">{loadingStatus}</p>
                        <p className="text-white/50 text-xs mt-2">Data wordt live opgehaald van Wikipedia</p>
                    </div>
                 ) : (
                    <>
                        <div className="text-white/70 text-sm font-bold uppercase tracking-wider mb-2 px-1">
                            {processedSongs.length} {processedSongs.length === 1 ? 'Resultaat' : 'Resultaten'}
                        </div>

                        {visibleSongs.length > 0 ? (
                            visibleSongs.map((song, idx) => {
                                let displayRank = 0;
                                let previousRank: number | null | undefined = null;

                                if (selectedYear === 'all-time') {
                                    displayRank = song.allTimeRank || idx + 1;
                                    previousRank = song.previousAllTimeRank;
                                } else {
                                    displayRank = (song.rankings[selectedYear] as number) || 0;
                                    // Find the previous available year based on list logic
                                    // For a specific year, compare to year - 1
                                    const prevYear = (parseInt(selectedYear) - 1).toString();
                                    previousRank = song.rankings[prevYear];
                                }

                                return (
                                    <SongCard 
                                        key={song.id} 
                                        song={song} 
                                        rank={displayRank} 
                                        previousRank={previousRank}
                                        onSelect={handleSelectSong} 
                                    />
                                );
                            })
                        ) : (
                            <div className="text-center py-10 text-white/60">
                                {debouncedSearchQuery 
                                    ? 'Geen nummers gevonden met deze zoekterm.' 
                                    : selectedYear !== 'all-time' 
                                        ? `Geen data beschikbaar voor het jaar ${selectedYear}.` 
                                        : 'Geen data beschikbaar.'
                                }
                            </div>
                        )}
                        
                        <div ref={observerTarget} className="py-8 flex justify-center">
                            {visibleCount < processedSongs.length && (
                                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                            )}
                        </div>
                    </>
                 )}
            </div>

        </div>

      </div>

      <footer className="mt-12 bg-black py-12 text-center text-white/50 text-sm">
           <div className="flex justify-center items-center gap-2 mb-4 opacity-50 grayscale hover:grayscale-0 transition">
              <span className="font-bold">NPO</span> Radio 2 Top 2000
           </div>
           <p>© 2024 NPO Radio 2. Allertijden Calculator.</p>
      </footer>

      {selectedSong && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <Modal 
              song={selectedSong} 
              onClose={handleCloseModal} 
              otherSongsByArtist={otherSongsBySelectedArtist}
              onSelectSong={handleSelectSong}
              onNext={handleNext}
              onPrevious={handlePrevious}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
          />
        </Suspense>
      )}

      {streamingSetupService && (
        <StreamingSetupModal
          service={streamingSetupService}
          onClose={() => setStreamingSetupService(null)}
          onAuthenticated={handleStreamingSetupAuth}
        />
      )}

      {isCreatingPlaylist && !playlistResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center">
            <div className="w-12 h-12 border-4 border-[#d00018] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg font-bold text-gray-900">Playlist aanmaken...</p>
            <p className="text-sm text-gray-600 mt-2">
              Nummer {playlistProgress.current} van {playlistProgress.total}
            </p>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-[#d00018] h-3 rounded-full transition-all duration-300"
                style={{ width: `${(playlistProgress.current / playlistProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {Math.round((playlistProgress.current / playlistProgress.total) * 100)}% voltooid
            </p>
          </div>
        </div>
      )}

      {playlistResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Playlist aangemaakt!</h2>
                <button
                  onClick={() => {
                    setPlaylistResult(null);
                    setIsCreatingPlaylist(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  <strong>{playlistResult.addedCount}</strong> van <strong>{playlistProgress.total}</strong> nummers zijn toegevoegd aan de playlist.
                </p>
                {playlistResult.failedSongs.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-yellow-800 font-bold mb-2">
                      {playlistResult.failedSongs.length} nummer(s) konden niet worden toegevoegd:
                    </p>
                    <div className="max-h-64 overflow-y-auto">
                      <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                        {playlistResult.failedSongs.map((song, idx) => (
                          <li key={idx}>{song.artist} - {song.title}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {playlistResult.failedSongs.length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 font-bold">Alle nummers zijn succesvol toegevoegd! 🎉</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  window.open(playlistResult.playlistUrl, '_blank');
                }}
                className="flex-1 bg-[#1DB954] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#1ed760] transition"
              >
                Open in Spotify
              </button>
              <button
                onClick={() => {
                  setPlaylistResult(null);
                  setIsCreatingPlaylist(false);
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-bold hover:bg-gray-300 transition"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {isHowItWorksOpen && (
        <HowItWorksModal onClose={() => setIsHowItWorksOpen(false)} />
      )}

    </div>
  );
};

export default App;
