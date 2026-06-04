import { useEffect, useMemo, useState } from "react";
import { Eraser, Plus, Trash2 } from "lucide-react";
import { framesToPixels, paletteColorToCss } from "../lib/pixelgrid";

/**
 * UI-only pixel-art editor.
 *
 * Lets a user pick colors from a palette and paint cells on a fixed-size
 * canvas, plus build up multi-frame animations. Capped to 32×32 (the
 * contract allows up to 512×512 but a 512² grid in raw <div>s isn't
 * usable). Outputs the `palette-index-64`-encoded `pixels` string the
 * `mint_pixel_grid` call expects.
 */

export interface PixelEditorFrame {
  /** Length = width * height. Indices into the provided palette colors. */
  indices: number[];
}

export interface PixelEditorProps {
  width: number;
  height: number;
  paletteColors: string[];
  frames: PixelEditorFrame[];
  onFramesChange: (frames: PixelEditorFrame[]) => void;
}

export const MAX_EDITOR_DIMENSION = 32;
export const MAX_EDITOR_FRAMES = 12;

export function PixelEditor(props: PixelEditorProps) {
  const { width, height, paletteColors, frames, onFramesChange } = props;
  const [activeFrame, setActiveFrame] = useState(0);
  const [activeColor, setActiveColor] = useState(0);
  const [painting, setPainting] = useState(false);

  // Keep activeFrame in range if frames change.
  useEffect(() => {
    if (activeFrame >= frames.length) setActiveFrame(Math.max(0, frames.length - 1));
  }, [frames.length, activeFrame]);

  // Keep the selected paint color in range if palette colors are removed
  // or replaced by an existing on-chain palette.
  useEffect(() => {
    if (paletteColors.length === 0) {
      if (activeColor !== 0) setActiveColor(0);
      return;
    }
    if (activeColor >= paletteColors.length) {
      setActiveColor(paletteColors.length - 1);
    }
  }, [paletteColors.length, activeColor]);

  const cellsPerFrame = width * height;

  function paintCell(cellIndex: number) {
    if (paletteColors.length === 0) return;
    const next = frames.map((f) => ({ indices: [...f.indices] }));
    if (!next[activeFrame]) return;
    next[activeFrame].indices[cellIndex] = activeColor;
    onFramesChange(next);
  }

  function addFrame() {
    if (frames.length >= MAX_EDITOR_FRAMES) return;
    const last = frames[frames.length - 1];
    const indices = last
      ? [...last.indices]
      : new Array(cellsPerFrame).fill(0);
    onFramesChange([...frames, { indices }]);
    setActiveFrame(frames.length);
  }

  function removeFrame(index: number) {
    if (frames.length <= 1) return;
    const next = frames.filter((_, i) => i !== index);
    onFramesChange(next);
    if (activeFrame >= next.length) setActiveFrame(next.length - 1);
  }

  function clearFrame() {
    const next = frames.map((f, i) =>
      i === activeFrame ? { indices: new Array(cellsPerFrame).fill(0) } : f
    );
    onFramesChange(next);
  }

  const frame = frames[activeFrame] ?? { indices: new Array(cellsPerFrame).fill(0) };

  return (
    <div className="space-y-3">
      {/* Palette row */}
      <div className="flex flex-wrap items-center gap-2">
        {paletteColors.map((color, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveColor(i)}
            className={`w-7 h-7 rounded border-2 transition-transform ${activeColor === i ? "border-primary scale-110" : "border-base-content/20"}`}
            style={{
              background:
                color === "transparent"
                  ? "repeating-conic-gradient(#0003 0 25%, transparent 0 50%) 50% / 8px 8px"
                  : paletteColorToCss(color)
            }}
            title={color}
            aria-label={`Palette color ${i}: ${color}`}
          />
        ))}
      </div>

      {/* Canvas */}
      <div
        className="inline-grid select-none border border-base-content/10 rounded-md overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${width}, 18px)`,
          gridTemplateRows: `repeat(${height}, 18px)`,
          background:
            "repeating-conic-gradient(#0003 0 25%, transparent 0 50%) 50% / 12px 12px"
        }}
        onMouseLeave={() => setPainting(false)}
      >
        {frame.indices.map((paletteIdx, cellIdx) => {
          const color = paletteColors[paletteIdx] ?? "transparent";
          return (
            <button
              key={cellIdx}
              type="button"
              className="w-[18px] h-[18px] outline-none hover:ring-1 hover:ring-primary"
              style={{
                background: color === "transparent" ? "transparent" : paletteColorToCss(color)
              }}
              onMouseDown={() => {
                setPainting(true);
                paintCell(cellIdx);
              }}
              onMouseUp={() => setPainting(false)}
              onMouseEnter={() => {
                if (painting) paintCell(cellIdx);
              }}
              aria-label={`pixel ${cellIdx}`}
            />
          );
        })}
      </div>

      {/* Frame controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-base-content/60">Frames</span>
        {frames.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`btn btn-xs ${i === activeFrame ? "btn-primary" : "btn-outline"}`}
            onClick={() => setActiveFrame(i)}
          >
            {i + 1}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-xs btn-ghost gap-1"
          onClick={addFrame}
          disabled={frames.length >= MAX_EDITOR_FRAMES}
        >
          <Plus size={12} /> Frame
        </button>
        {frames.length > 1 && (
          <button
            type="button"
            className="btn btn-xs btn-ghost gap-1 text-error"
            onClick={() => removeFrame(activeFrame)}
          >
            <Trash2 size={12} /> Remove
          </button>
        )}
        <button
          type="button"
          className="btn btn-xs btn-ghost gap-1"
          onClick={clearFrame}
        >
          <Eraser size={12} /> Clear frame
        </button>
      </div>
    </div>
  );
}

export function framesToPixelString(frames: PixelEditorFrame[]): string {
  return framesToPixels(frames.map((f) => ({ indices: f.indices })));
}

/** Initial blank frame for a width × height grid. */
export function blankFrame(width: number, height: number): PixelEditorFrame {
  return { indices: new Array(Math.max(1, width * height)).fill(0) };
}

export function resizeFrames(
  frames: PixelEditorFrame[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
): PixelEditorFrame[] {
  const next: PixelEditorFrame[] = frames.map((frame) => {
    const indices = new Array(newWidth * newHeight).fill(0);
    for (let y = 0; y < Math.min(oldHeight, newHeight); y++) {
      for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
        indices[y * newWidth + x] = frame.indices[y * oldWidth + x] ?? 0;
      }
    }
    return { indices };
  });
  return next.length ? next : [blankFrame(newWidth, newHeight)];
}

export function clampPaletteIndices(
  frames: PixelEditorFrame[],
  paletteSize: number
): PixelEditorFrame[] {
  return frames.map((frame) => ({
    indices: frame.indices.map((idx) => (idx >= paletteSize ? 0 : idx))
  }));
}

export const PixelEditorMaxFrames = MAX_EDITOR_FRAMES;

// useMemo placeholder to keep the import used in editors that compute previews
export function usePaletteHash(colors: string[]): string {
  return useMemo(() => colors.join("|"), [colors]);
}
