import { useMemo, useState, useEffect } from "react";
import { searchYouTubeVideo } from "../services/youtubeService";

export function YouTubeTop2000Embed({
  artist,
  title,
  autoplay = true,
}: {
  artist: string;
  title: string;
  autoplay?: boolean;
}) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setVideoId(null);

    const fetchVideo = async () => {
      // First try to get a specific video ID
      const result = await searchYouTubeVideo(artist, title);
      
      if (isMounted) {
        if (result?.videoId) {
          setVideoId(result.videoId);
        }
        setLoading(false);
      }
    };

    fetchVideo();

    return () => {
      isMounted = false;
    };
  }, [artist, title]);

  const src = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    // If we have a specific video ID, use it
    if (videoId) {
      const params = new URLSearchParams({
        playsinline: "1",
        rel: "0",
        origin,
      });
      if (autoplay) params.set("autoplay", "1");
      return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
    }

    return null;
  }, [autoplay, videoId]);

  // key ensures iframe resets
  const key = `${artist}__${title}__${videoId || 'search'}`;

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black relative">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
             <div className="w-8 h-8 border-4 border-[#d00018] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : videoId && src ? (
        <iframe
            key={key}
            className="h-full w-full"
            src={src}
            title={`YouTube: ${artist} - ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
             <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h.01M6 18h.01" />
            </svg>
            <p className="text-gray-400 font-medium">Geen video gevonden in het Top 2000 a gogo archief.</p>
        </div>
      )}
    </div>
  );
}
