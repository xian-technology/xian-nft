import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPalette,
  paletteColorToCss,
  pixelsToFrames,
  type ResolvedPalette
} from "../lib/pixelgrid";

export interface PixelGridCanvasProps {
  contract: string;
  paletteId: string;
  width: number;
  height: number;
  frameCount: number;
  frameDelayMs: number;
  pixels: string;
  /** Optional className applied to the wrapper. */
  className?: string;
  /** Render at this many CSS pixels per pixel-art cell (default: auto-fit). */
  cellSize?: number;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Renders an XSC-0005 PixelGrid token by decoding the `palette-index-64`
 * string against the on-chain palette, then drawing each frame to a
 * canvas at native resolution. CSS scales it up with image-rendering:
 * pixelated so the art stays crisp at any size.
 *
 * Animated tokens cycle through frames at `frame_delay_ms`; honors
 * `prefers-reduced-motion` by holding on the first frame.
 */
export function PixelGridCanvas(props: PixelGridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [palette, setPalette] = useState<ResolvedPalette | null>(null);
  const [paletteError, setPaletteError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPaletteError(false);
    void fetchPalette(props.contract, props.paletteId).then((p) => {
      if (cancelled) return;
      if (!p) setPaletteError(true);
      setPalette(p);
    });
    return () => {
      cancelled = true;
    };
  }, [props.contract, props.paletteId]);

  const frames = useMemo(() => {
    try {
      return pixelsToFrames({
        paletteId: props.paletteId,
        width: props.width,
        height: props.height,
        frameCount: props.frameCount,
        frameDelayMs: props.frameDelayMs,
        pixels: props.pixels
      });
    } catch {
      return null;
    }
  }, [
    props.paletteId,
    props.width,
    props.height,
    props.frameCount,
    props.frameDelayMs,
    props.pixels
  ]);

  // Drawing loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !palette || !frames || frames.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = props.width;
    canvas.height = props.height;
    ctx.imageSmoothingEnabled = false;

    const colors = palette.colors.map(paletteColorToCss);
    const draw = (frameIndex: number) => {
      const frame = frames[frameIndex];
      if (!frame) return;
      ctx.clearRect(0, 0, props.width, props.height);
      for (let y = 0; y < props.height; y++) {
        for (let x = 0; x < props.width; x++) {
          const palIdx = frame.indices[y * props.width + x];
          const color = colors[palIdx] ?? "transparent";
          if (color === "transparent") continue;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    };

    draw(0);
    if (frames.length <= 1 || prefersReducedMotion()) return;
    let frameIndex = 0;
    const interval = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      draw(frameIndex);
    }, Math.max(1, props.frameDelayMs));
    return () => window.clearInterval(interval);
  }, [palette, frames, props.width, props.height, props.frameDelayMs]);

  if (paletteError) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center bg-base-200 text-base-content/50 ${props.className ?? ""}`}
      >
        <span className="text-xs font-mono">Palette {props.paletteId} unavailable</span>
      </div>
    );
  }

  if (!palette || !frames) {
    return (
      <div className={`w-full h-full shimmer ${props.className ?? ""}`} aria-busy="true" />
    );
  }

  return (
    <div
      className={`w-full h-full flex items-center justify-center bg-base-200 ${props.className ?? ""}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain pixelated"
        style={{ imageRendering: "pixelated" }}
        aria-label="Pixel art"
      />
    </div>
  );
}
