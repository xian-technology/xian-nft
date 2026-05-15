export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="snek-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.72 0.18 320)" />
          <stop offset="0.5" stopColor="oklch(0.70 0.18 200)" />
          <stop offset="1" stopColor="oklch(0.78 0.18 80)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="oklch(0.13 0.03 290)" />
      <g fill="url(#snek-grad)">
        <rect x="12" y="12" width="8" height="8" rx="2" />
        <rect x="20" y="12" width="8" height="8" rx="2" />
        <rect x="28" y="20" width="8" height="8" rx="2" />
        <rect x="36" y="28" width="8" height="8" rx="2" />
        <rect x="44" y="36" width="8" height="8" rx="2" />
        <rect x="44" y="44" width="8" height="8" rx="2" />
        <rect x="36" y="44" width="8" height="8" rx="2" />
        <rect x="20" y="36" width="8" height="8" rx="2" />
        <rect x="12" y="28" width="8" height="8" rx="2" />
      </g>
    </svg>
  );
}
