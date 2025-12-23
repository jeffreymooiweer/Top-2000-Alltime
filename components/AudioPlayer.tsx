import React, { useState, useEffect, memo, useCallback } from 'react';

// Global Audio Singleton
const globalAudio = new Audio();
let stopCurrentPlayer: (() => void) | null = null;

interface AudioPlayerProps {
  previewUrl: string | undefined | null;
  mini?: boolean;
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = memo(({ previewUrl, mini = false, className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Cleanup on unmount if this is the active player
  useEffect(() => {
    return () => {
      if (isPlaying && stopCurrentPlayer) {
        // If we are unmounting but playing, pause the global audio
        // Check if we are really the one playing (url check)
        // Actually, relying on isPlaying state is safe here
        globalAudio.pause();
        stopCurrentPlayer = null;
      }
    };
  }, [isPlaying]);

  const handleAudioEvents = useCallback(() => {
    // These handlers are attached to the global audio when THIS component takes control
    
    globalAudio.onended = () => {
      setIsPlaying(false);
      stopCurrentPlayer = null;
    };

    globalAudio.onpause = () => {
      // This triggers if paused by code or user. 
      // We need to differentiate between "switched to another song" and "paused this song".
      // If switched, stopCurrentPlayer would have been called already by the new player.
      // But checking here ensures UI sync.
      setIsPlaying(false);
    };

    globalAudio.onerror = () => {
      const err = globalAudio.error;
      console.warn("Audio playback error:", err);
      
      setHasError(true);
      setIsPlaying(false);
      
      // Retry logic logic could be here, but global singleton makes it trickier.
      // For now, simple error indication.
    };

    globalAudio.onplay = () => {
        setIsPlaying(true);
        setHasError(false);
    };
  }, []);

  const togglePlay = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!previewUrl) return;

    if (isPlaying) {
      globalAudio.pause();
      // onpause handler will update state
    } else {
      // Stop previous player if exists
      if (stopCurrentPlayer) {
        stopCurrentPlayer();
      }

      // Set this component as the active player stopper
      stopCurrentPlayer = () => {
        setIsPlaying(false);
      };

      try {
        globalAudio.src = previewUrl;
        
        // Setup events
        handleAudioEvents();

        await globalAudio.play();
        setHasError(false);
      } catch (err) {
        console.error("Play request failed:", err);
        setHasError(true);
        setIsPlaying(false);
        stopCurrentPlayer = null;
      }
    }
  }, [previewUrl, isPlaying, handleAudioEvents]);

  if (!previewUrl) return null;

  return (
    <div 
        className={`flex items-center justify-center ${className} ${hasError ? 'opacity-50' : ''}`} 
        onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={togglePlay}
        className={`${
          mini 
          ? 'w-10 h-10' 
          : 'w-14 h-14'
        } rounded-full bg-[#d00018] text-white flex items-center justify-center shadow-lg hover:bg-[#b00014] hover:scale-105 transition-all duration-200 z-10 ring-2 ring-white/20`}
        aria-label={isPlaying ? "Pauzeer" : "Afspelen"}
      >
        {isPlaying ? (
          <svg className={`${mini ? 'w-4 h-4' : 'w-6 h-6'} fill-current`} viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        ) : (
          <svg className={`${mini ? 'w-4 h-4' : 'w-6 h-6'} fill-current ml-1`} viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
