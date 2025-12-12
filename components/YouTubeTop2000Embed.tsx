import { useMemo } from "react";

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
  const src = useMemo(() => {
    const q = buildQuery(artist, title);
    const params = new URLSearchParams({
      listType: "search",
      list: q, // YouTube interpreteert dit als search query
    });

    // player params
    if (autoplay) params.set("autoplay", "1");
    params.set("playsinline", "1");
    params.set("rel", "0");

    return `https://www.youtube.com/embed?${params.toString()}`;
  }, [artist, title, autoplay]);

  // key zorgt dat de iframe echt reset bij nieuw nummer
  const key = `${artist}__${title}`;

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <iframe
        key={key}
        className="h-full w-full"
        src={src}
        title={`YouTube: ${artist} - ${title}`}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
