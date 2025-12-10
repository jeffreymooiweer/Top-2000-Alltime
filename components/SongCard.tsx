
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { SongData } from '../types';
import { fetchSongMetadata } from '../services/itunesService';
import AudioPlayer from './AudioPlayer';

interface SongCardProps {
  song: SongData;
  rank: number;
  previousRank?: number | null; // Optional to support existing calls, but logic expects it for badge
  onSelect: (song: SongData) => void;
}

const SongCard: React.FC<SongCardProps> = memo(({ song, rank, previousRank, onSelect }) => {
  const [coverUrl, setCoverUrl] = useState<string | null | undefined>(song.coverUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null | undefined>(song.previewUrl);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for Lazy Loading
  useEffect(() => {
    const target = cardRef.current;
    if (!target || isVisible) return; // Early return if already visible

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only need to trigger once
        }
      },
      { threshold: 0.1, rootMargin: '50px' } // Load slightly before it comes into view
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  // Fetch Metadata only when visible
  useEffect(() => {
    if (!isVisible || coverUrl !== undefined) return;

    let isMounted = true;

    const loadData = async () => {
      const meta = await fetchSongMetadata(song.artist, song.title);
      if (isMounted) {
        setCoverUrl(meta.coverUrl);
        setPreviewUrl(meta.previewUrl);
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [isVisible, song.artist, song.title, coverUrl]);

  // Determine Badge Status
  let statusBg = "bg-gray-500";
  let statusText = "-";
  
  if (!previousRank || previousRank === 0) {
      statusBg = "bg-gray-500";
      statusText = "Nieuw";
  } else {
      const diff = previousRank - rank;
      if (diff > 0) {
          statusBg = "bg-[#22c55e]"; // Green
          statusText = `+${diff}`;
      } else if (diff < 0) {
          statusBg = "bg-[#d00018]"; // Red
          statusText = `${diff}`;
      } else {
          statusBg = "bg-gray-500";
          statusText = "-";
      }
  }

  const handleClick = useCallback(() => {
    onSelect({ ...song, coverUrl, previewUrl });
  }, [onSelect, song, coverUrl, previewUrl]);

  return (
    <div 
        ref={cardRef}
        onClick={handleClick}
        className="bg-white rounded overflow-hidden flex shadow-md group cursor-pointer transition-transform duration-200 hover:-translate-y-1 min-h-[96px] items-stretch"
    >
        {/* Rank Badge Section */}
        <div className="w-16 md:w-20 bg-gray-50 flex flex-col items-center justify-center p-2 shrink-0 border-r border-gray-100">
             <div className="w-full bg-white border border-gray-200 rounded flex flex-col items-center overflow-hidden shadow-sm">
                 <div className="py-1 w-full text-center font-bold text-gray-900 text-lg md:text-xl">
                     {rank}
                 </div>
                 <div className={`w-full text-center text-white font-bold text-xs py-1 ${statusBg}`}>
                     {statusText}
                 </div>
             </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex items-center p-3 gap-4 relative overflow-hidden">
                {/* Image with Play Overlay */}
                <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 bg-gray-200 rounded-sm overflow-hidden group/image">
                    {isVisible && coverUrl ? (
                    <img 
                        src={coverUrl} 
                        alt={song.title} 
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover animate-fade-in" 
                    />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {coverUrl === undefined ? (
                            /* Loading State */
                            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            /* Failed / Null State - Vinyl Icon */
                            <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-500 opacity-50" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>
                            </div>
                        )}
                        </div>
                    )}
                    
                    {/* Play Button Overlay - Only show if we have a preview url */}
                    {previewUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/image:bg-black/10 transition-colors">
                        <AudioPlayer previewUrl={previewUrl} mini={true} />
                    </div>
                    )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 pr-8">
                    <h3 className="text-black font-bold text-base md:text-lg truncate group-hover:text-[#d00018] transition-colors">{song.artist}</h3>
                    <p className="text-gray-600 text-sm md:text-base truncate">{song.title}</p>
                    <p className="text-gray-400 text-xs mt-1">Score: {song.totalScore?.toLocaleString()}</p>
                </div>

                {/* Right Icon */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
        </div>
    </div>
  );
});

SongCard.displayName = 'SongCard';

export default SongCard;
