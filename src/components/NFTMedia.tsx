import { useMemo } from "react";
import { fallbackDataUrl, resolveMedia, type ResolvedMedia } from "../lib/content";
import { FileQuestion } from "lucide-react";

interface NFTMediaInputProps {
  mimeType: string;
  encoding: string;
  content: string;
  uri: string;
  /** Used for the generative fallback when no media is resolvable. */
  fallbackSeed: string;
  fallbackLabel: string;
  /** Optional: pixelated rendering for low-res pixel art. */
  pixelated?: boolean;
  /** Optional: muted/looping for inline video previews. */
  muteVideo?: boolean;
  className?: string;
}

export function NFTMedia(props: NFTMediaInputProps) {
  const resolved: ResolvedMedia = useMemo(
    () =>
      resolveMedia({
        mimeType: props.mimeType,
        encoding: props.encoding,
        content: props.content,
        uri: props.uri
      }),
    [props.mimeType, props.encoding, props.content, props.uri]
  );

  const fallback = useMemo(
    () => fallbackDataUrl(props.fallbackSeed, props.fallbackLabel),
    [props.fallbackSeed, props.fallbackLabel]
  );

  // No usable media — show the generative fallback
  if (!resolved.url && !resolved.text) {
    return (
      <img
        src={fallback}
        alt={props.fallbackLabel}
        className={`w-full h-full object-cover ${props.pixelated ? "pixelated" : ""} ${props.className ?? ""}`}
      />
    );
  }

  if (resolved.kind === "image" && resolved.url) {
    return (
      <img
        src={resolved.url}
        alt={props.fallbackLabel}
        className={`w-full h-full object-cover ${props.pixelated ? "pixelated" : ""} ${props.className ?? ""}`}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = fallback;
        }}
      />
    );
  }

  if (resolved.kind === "video" && resolved.url) {
    return (
      <video
        src={resolved.url}
        className={`w-full h-full object-cover ${props.className ?? ""}`}
        autoPlay={props.muteVideo}
        muted={props.muteVideo}
        loop
        playsInline
        controls={!props.muteVideo}
      />
    );
  }

  if (resolved.kind === "audio" && resolved.url) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-base-200 gap-3 p-6 ${props.className ?? ""}`}>
        <img src={fallback} alt="" className="w-40 h-40 rounded-2xl object-cover" />
        <audio src={resolved.url} controls className="w-full max-w-xs" />
      </div>
    );
  }

  if ((resolved.kind === "text" || resolved.kind === "json") && resolved.text) {
    return (
      <pre
        className={`w-full h-full overflow-auto p-4 text-xs font-mono bg-base-200 ${props.className ?? ""}`}
      >
        {resolved.text}
      </pre>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-base-200 text-base-content/40 gap-2 ${props.className ?? ""}`}>
      <FileQuestion size={48} />
      <span className="text-xs font-mono">{resolved.mimeType}</span>
    </div>
  );
}
