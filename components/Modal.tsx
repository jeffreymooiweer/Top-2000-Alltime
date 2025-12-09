import React, { useEffect, useState } from 'react';
import { SongData } from '../types';
import SongChart from './SongChart';
import AudioPlayer from './AudioPlayer';
import { getSongAnalysis } from '../services/geminiService';
import { getLyrics } from '../services/lyricsService';
import { fetchSongMetadata } from '../services/itunesService';

interface ModalProps {
  song: SongData;
  onClose: () => void;
  otherSongsByArtist: SongData[];
  onSelectSong: (song: SongData) => void;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

type Tab = 'overview' | 'lyrics';

// Sub-component for the "More from artist" list items
const RelatedSongRow: React.FC<{ song: SongData; onClick: () => void }> = ({ song, onClick }) => {
  const [cover, setCover] = useState<string | null | undefined>(song.coverUrl);
  const [preview, setPreview] = useState<string | null | undefined>(song.previewUrl);

  useEffect(() => {
    // If parent passed data, use it. Otherwise fetch.
    if (!song.coverUrl) {
      let isMounted = true;
      fetchSongMetadata(song.artist, song.title).then(meta => {
        if (isMounted) {
          setCover(meta.coverUrl);
          setPreview(meta.previewUrl);
        }
      });
      return () => { isMounted = false; };
    }
  }, [song]);

  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-white hover:bg-gray-50 border border-gray-200 hover:border-[#d00018] rounded-lg cursor-pointer transition group shadow-sm"
    >
      <div className="relative w-12 h-12 bg-gray-200 rounded overflow-hidden shrink-0 group/image">
        {cover ? (
          <img src={cover} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 font-bold text-xs">
            #
          </div>
        )}
        
        {/* Mini Play Button Overlay */}
        {preview && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/image:opacity-100 transition-opacity">
            <AudioPlayer previewUrl={preview} mini={true} className="scale-75" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-gray-900 font-bold text-sm truncate group-hover:text-[#d00018] transition">
          {song.title}
        </h4>
        <p className="text-gray-500 text-xs font-mono">Rank #{song.allTimeRank}</p>
      </div>
    </div>
  );
};

const Modal: React.FC<ModalProps> = ({
  song,
  onClose,
  otherSongsByArtist,
  onSelectSong,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  // Local Metadata State (in case song prop is missing data)
  const [localCover, setLocalCover] = useState<string | null | undefined>(song.coverUrl);
  const [localPreview, setLocalPreview] = useState<string | null | undefined>(song.previewUrl);

  // Analysis State
  const [analysis, setAnalysis] = useState<string>('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  
  // Lyrics State
  const [lyrics, setLyrics] = useState<string>('');
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrevious) onPrevious();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrevious, onNext, onPrevious, onClose]);

  // Sync state when song changes
  useEffect(() => {
    setActiveTab('overview');
    setAnalysis('');
    setLyrics('');
    setLocalCover(song.coverUrl);
    setLocalPreview(song.previewUrl);
    
    // If metadata is missing, try to fetch it
    if (!song.coverUrl) {
      fetchSongMetadata(song.artist, song.title).then(meta => {
        setLocalCover(meta.coverUrl);
        setLocalPreview(meta.previewUrl);
      });
    }

    // Fetch Analysis immediately
    const fetchAnalysis = async () => {
      setLoadingAnalysis(true);
      const text = await getSongAnalysis(song.artist, song.title);
      setAnalysis(text);
      setLoadingAnalysis(false);
    };

    fetchAnalysis();
  }, [song.id, song.artist, song.title, song.coverUrl, song.previewUrl]);

  // Fetch Lyrics when tab changes to lyrics
  useEffect(() => {
    if (activeTab === 'lyrics' && !lyrics && !loadingLyrics) {
      const fetchLyrics = async () => {
        setLoadingLyrics(true);
        const text = await getLyrics(song.artist, song.title);
        setLyrics(text);
        setLoadingLyrics(false);
      };
      fetchLyrics();
    }
  }, [activeTab, song.id, lyrics, loadingLyrics]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Content */}
      <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="relative bg-[#d00018] text-white p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-end">
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition z-20"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation Arrows (Desktop/Visible in Header) */}
          <button 
            onClick={(e) => { e.stopPropagation(); onPrevious(); }}
            disabled={!hasPrevious}
            className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition z-20 ${hasPrevious ? 'text-white/70 hover:text-white hover:bg-black/20' : 'text-white/20 cursor-not-allowed'}`}
            title="Vorige (Pijl Links)"
          >
            <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            disabled={!hasNext}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition z-20 ${hasNext ? 'text-white/70 hover:text-white hover:bg-black/20' : 'text-white/20 cursor-not-allowed'}`}
            title="Volgende (Pijl Rechts)"
          >
            <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="relative shrink-0 group ml-8 md:ml-10">
            <img 
              src={localCover || 'https://picsum.photos/200/200'} 
              className="w-32 h-32 rounded shadow-lg border-2 border-white/20 bg-gray-800 object-cover"
              alt={song.title}
            />
            <div className="absolute -bottom-4 -right-4">
              <AudioPlayer previewUrl={localPreview} />
            </div>
          </div>
          
          <div className="flex-1 min-w-0 pb-2 mr-8 md:mr-10">
            <h2 className="text-3xl md:text-5xl font-bold brand-font truncate leading-tight">
              {song.title}
            </h2>
            <p className="text-xl opacity-90 font-medium">{song.artist}</p>
            <div className="flex flex-wrap gap-2 mt-3 text-sm font-semibold opacity-90">
              <span className="bg-white/20 px-2 py-1 rounded">
                Allertijden Rank #{song.allTimeRank}
              </span>
              <span className="bg-white/20 px-2 py-1 rounded">
                {song.releaseYear > 0 ? song.releaseYear : 'N/A'}
              </span>
              <span className="bg-white/20 px-2 py-1 rounded">
                {song.totalScore?.toLocaleString()} punten
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-6 md:px-8 flex space-x-8">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`py-4 font-bold uppercase tracking-wider text-sm border-b-4 transition-colors ${activeTab === 'overview' ? 'border-[#d00018] text-[#d00018]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            Overzicht
          </button>
          <button 
            onClick={() => setActiveTab('lyrics')}
            className={`py-4 font-bold uppercase tracking-wider text-sm border-b-4 transition-colors ${activeTab === 'lyrics' ? 'border-[#d00018] text-[#d00018]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            Songtekst
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50">
          {activeTab === 'overview' ? (
            <div className="space-y-8 animate-fade-in">
              {/* Chart Section */}
              <section>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 brand-font uppercase">
                  <svg className="w-5 h-5 text-[#d00018]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  Notering Geschiedenis
                </h3>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <SongChart song={song} />
                </div>
              </section>

              {/* Analysis Section */}
              <section>
                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2 brand-font uppercase">
                  <svg className="w-5 h-5 text-[#d00018]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Wist je dat?
                </h3>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-gray-700 leading-relaxed relative">
                  {loadingAnalysis ? (
                    <div className="animate-pulse flex space-x-4">
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-2 bg-gray-200 rounded"></div>
                        <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                        <div className="h-2 bg-gray-200 rounded w-4/6"></div>
                      </div>
                    </div>
                  ) : (
                    <p>{analysis}</p>
                  )}
                  <div className="absolute top-0 right-0 p-2 opacity-5">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
                    </svg>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-4 text-right">
                    Analyse gegenereerd met Groq (llama-3.1-8b-instant)
                  </p>
                </div>
              </section>

              {/* Other Songs */}
              {otherSongsByArtist.length > 0 && (
                <section>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 brand-font uppercase">
                    Meer van {song.artist} in de lijst
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {otherSongsByArtist.map((s) => (
                      <RelatedSongRow 
                        key={s.id}
                        song={s}
                        onClick={() => onSelectSong(s)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="animate-fade-in bg-white p-6 md:p-10 rounded-xl shadow-inner min-h-[300px]">
              {loadingLyrics ? (
                <div className="flex justify-center items-center h-40">
                  <div className="w-8 h-8 border-4 border-[#d00018] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="text-center">
                  <h4 className="font-bold text-lg mb-6 brand-font uppercase text-gray-400">
                    Songtekst
                  </h4>
                  <p className="whitespace-pre-line text-gray-800 leading-8 font-medium text-lg font-serif">
                    {lyrics}
                  </p>
                  <p className="mt-8 text-xs text-gray-400">
                    Songteksten aangeboden door lyrics.ovh
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
