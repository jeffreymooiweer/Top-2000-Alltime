import { useMemo, useState, useEffect } from "react";
import { searchYouTubeVideo } from "../services/youtubeService";

function buildQuery(artist: string, title: string) {
  return `top 2000 a gogo ${artist} ${title}`;
}

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
  const [loading, setLoading] = useState(false);

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

    // Fallback to search list embed if no video ID found
    const q = buildQuery(artist, title);
    const params = new URLSearchParams({
      listType: "search",
      list: q,
      playsinline: "1",
      rel: "0",
      origin,
    });

    if (autoplay) params.set("autoplay", "1");

    return `https://www.youtube-nocookie.com/embed?${params.toString()}`;
  }, [artist, title, autoplay, videoId]);

  // key ensures iframe resets
  const key = `${artist}__${title}__${videoId || 'search'}`;

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black relative">
      {loading && !videoId ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
             <div className="w-8 h-8 border-4 border-[#d00018] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <iframe
            key={key}
            className="h-full w-full"
            src={src}
            title={`YouTube: ${artist} - ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
        />
      )}
    </div>
  );
}
