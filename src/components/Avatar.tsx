/**
 * Deterministic gradient avatar derived from any address-like string.
 * Visually distinct even for addresses with repeated chars (e.g. all "a"s)
 * because we hash the full string instead of slicing hex windows.
 */

function hash(s: string, seed = 0): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function hueFromHash(s: string, seed: number): number {
  return hash(s, seed) % 360;
}

export function Avatar({
  address,
  size = 80
}: {
  address: string;
  size?: number;
}) {
  const a = address || "anon";
  const h1 = hueFromHash(a, 1);
  const h2 = (h1 + 80 + (hash(a, 2) % 80)) % 360;
  const h3 = (h1 + 200 + (hash(a, 3) % 60)) % 360;
  const angle = (hash(a, 4) % 360);

  return (
    <div
      className="rounded-2xl shrink-0 relative overflow-hidden border border-white/10"
      style={{
        width: size,
        height: size,
        background: `
          conic-gradient(
            from ${angle}deg,
            oklch(0.72 0.20 ${h1}),
            oklch(0.68 0.22 ${h2}),
            oklch(0.78 0.20 ${h3}),
            oklch(0.72 0.20 ${h1})
          )
        `,
        boxShadow:
          "inset 0 1px 0 0 rgba(255,255,255,0.15), 0 12px 30px -10px rgba(0,0,0,0.5)"
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.18), transparent 60%)"
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.25) 100%)"
        }}
      />
    </div>
  );
}
