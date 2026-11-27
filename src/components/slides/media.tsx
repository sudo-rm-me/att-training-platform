/* eslint-disable @next/next/no-img-element */

export function videoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (u.hostname.includes("microsoftstream.com") || u.hostname.includes("sharepoint.com")) return url;
  } catch {
    /* relative URL, treat as file */
  }
  return null;
}

export function SlideVideo({ url, className }: { url: string; className?: string }) {
  const embed = videoEmbedUrl(url);
  if (embed)
    return (
      <iframe
        src={embed}
        className={className}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        title="Video"
      />
    );
  return <video src={url} controls className={className} />;
}

export function SlideImage({ url, className, alt = "" }: { url: string; className?: string; alt?: string }) {
  return <img src={url} alt={alt} className={className} draggable={false} />;
}
