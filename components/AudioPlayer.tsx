import React, { useRef, useState, useEffect, memo, useCallback } from 'react';

interface AudioPlayerProps {
  previewUrl: string | undefined | null;
  mini?: boolean;
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = memo(({ previewUrl, mini = false, className = '' }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset when URL changes
    setIsPlaying(false);
    setHasError(false);

    if (previewUrl) {
        audio.load();
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    
    const handleError = () => {
        const err = audio.error;
        console.warn("Audio playback error:", err);
        setHasError(true);
    };
    
    const handleCanPlay = () => {
        setHasError(false);
        // If we recovered from an error and user wanted to play, we could auto-play here,
        // but explicit user action is safer.
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadeddata', handleCanPlay);

    return () => {
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadeddata', handleCanPlay);
    };
  }, [previewUrl]);

  const togglePlay = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const audio = audioRef.current;
    if (!audio || !previewUrl) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Pause others
      document.querySelectorAll('audio').forEach((el) => {
        if (el !== audio) (el as HTMLAudioElement).pause();
      });

      try {
        await audio.play();
        setHasError(false);
      } catch (err) {
        console.error("Play request failed:", err);
        // If play fails immediately (e.g. strict browser policy or network), trigger error handler
        // to start the retry loop
        if (audioRef.current) {
             const event = new Event('error');
             audioRef.current.dispatchEvent(event);
        }
      }
    }
  }, [previewUrl, isPlaying]);

  if (!previewUrl) return null;

  return (
    <div 
        className={`flex items-center justify-center ${className} ${hasError ? 'opacity-50' : ''}`} 
        onClick={(e) => e.stopPropagation()}
    >
      <audio 
        ref={audioRef} 
        src={previewUrl} 
        preload="none"
        className="hidden"
      />
      
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