import { Globe } from "lucide-react";
import { Logo } from "./Logo";

function GithubIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.07c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-base-content/5 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-base-content/60">
        <div className="flex items-center gap-3">
          <Logo size={20} />
          <span>
            PixelSnek &middot; XSC-0005 NFT marketplace on the{" "}
            <a className="link link-primary" href="https://xian.org" target="_blank" rel="noreferrer">
              Xian Network
            </a>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://xian.org"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-xs gap-1"
          >
            <Globe size={12} /> xian.org
          </a>
          <a
            href="https://github.com/xian-network"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-xs gap-1"
          >
            <GithubIcon size={12} /> GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
