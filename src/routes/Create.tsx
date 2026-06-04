import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Loader2,
  Upload,
  AlertCircle,
  Sparkles,
  ImageIcon,
  Hash,
  ChevronRight,
  Layers,
  Grid3x3
} from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useCollections } from "../hooks/useCollections";
import { useToasts } from "../hooks/useToasts";
import { addCustomCollection } from "../lib/collections";
import {
  createPalette,
  getContractMetadata,
  getPaletteColors,
  getPaletteInfo,
  isXSC005,
  lockContent,
  lockPalette,
  mint,
  mintChunked,
  mintPixelGrid,
  setContentChunk
} from "../lib/nft";
import { NFTMedia } from "../components/NFTMedia";
import { EmptyState } from "../components/EmptyState";
import {
  PixelEditor,
  blankFrame,
  clampPaletteIndices,
  framesToPixelString,
  resizeFrames,
  type PixelEditorFrame
} from "../components/PixelEditor";
import {
  MAX_CONTENT_CHUNK_COUNT,
  MAX_CONTENT_CHUNK_LENGTH,
  MAX_INLINE_CONTENT_LENGTH,
  MAX_TOKEN_ID_LENGTH,
  ROYALTY_BPS_MAX,
  STORAGE_KEYS
} from "../lib/constants";
import { isSameAddress, shortAddress } from "../lib/format";
import { sha256Hex, splitIntoChunks } from "../lib/hash";
import { MAX_PALETTE_SIZE } from "../lib/pixelgrid";

type Tab = "mint" | "pixelgrid" | "register";

interface ChunkedMintProgress {
  contract: string;
  tokenId: string;
  chunkCount: number;
  chunkSize: number;
  contentHash: string;
  /** Index of next chunk to upload. chunkCount means "ready to lock". */
  nextIndex: number;
  /** Marker so we don't try to "resume" an already-locked token. */
  locked: boolean;
}

const CHUNKED_PROGRESS_KEY = STORAGE_KEYS.chunkedMintProgress;

function readChunkedProgress(): ChunkedMintProgress | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHUNKED_PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChunkedMintProgress;
    if (!parsed || !parsed.contract || !parsed.tokenId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeChunkedProgress(value: ChunkedMintProgress | null): void {
  if (typeof localStorage === "undefined") return;
  if (!value) {
    localStorage.removeItem(CHUNKED_PROGRESS_KEY);
  } else {
    localStorage.setItem(CHUNKED_PROGRESS_KEY, JSON.stringify(value));
  }
}

function maxPaletteIndex(frames: PixelEditorFrame[]): number {
  let max = 0;
  for (const frame of frames) {
    for (const index of frame.indices) {
      if (index > max) max = index;
    }
  }
  return max;
}

const DEFAULT_PALETTE_COLORS = [
  "transparent",
  "#0d0d0d",
  "#1f1f1f",
  "#ff00aa",
  "#00ffff",
  "#ffd400",
  "#ffffff",
  "#48b3ff"
];

interface MintForm {
  contract: string;
  tokenId: string;
  to: string;
  name: string;
  description: string;
  mimeType: string;
  encoding: string;
  content: string;
  uri: string;
  royaltyReceiver: string;
  royaltyBps: number;
}

export default function Create() {
  const wallet = useWallet();
  const { collections, refresh: refreshCollections } = useCollections();
  const { push } = useToasts();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("mint");

  // ── Mint form
  const ownedCollections = useMemo(
    () => (wallet.account ? collections.filter((c) => isSameAddress(c.operator, wallet.account)) : []),
    [collections, wallet.account]
  );
  const pixelGridCollections = useMemo(
    () => (ownedCollections.length > 0 ? ownedCollections : collections),
    [collections, ownedCollections]
  );
  const [form, setForm] = useState<MintForm>({
    contract: "",
    tokenId: "",
    to: "",
    name: "",
    description: "",
    mimeType: "image/svg+xml",
    encoding: "utf8",
    content: "",
    uri: "",
    royaltyReceiver: "",
    royaltyBps: 500
  });
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);

  // ── Register form
  const [registerContract, setRegisterContract] = useState("");
  const [registerBusy, setRegisterBusy] = useState(false);

  // ── Persisted chunked-mint progress (for resume hints)
  const [resumeProgress, setResumeProgress] = useState<ChunkedMintProgress | null>(() =>
    readChunkedProgress()
  );
  function persistChunkedProgress(value: ChunkedMintProgress | null) {
    writeChunkedProgress(value);
    setResumeProgress(value);
  }
  useEffect(() => {
    function onStorage() {
      setResumeProgress(readChunkedProgress());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── PixelGrid form
  const [pgContract, setPgContract] = useState("");
  const [pgTokenId, setPgTokenId] = useState("");
  const [pgName, setPgName] = useState("");
  const [pgDescription, setPgDescription] = useState("");
  const [pgPaletteId, setPgPaletteId] = useState("");
  const [pgPaletteColors, setPgPaletteColors] = useState<string[]>([...DEFAULT_PALETTE_COLORS]);
  const [pgPaletteExists, setPgPaletteExists] = useState<boolean | null>(null);
  const [pgPaletteLocked, setPgPaletteLocked] = useState(false);
  const [pgWidth, setPgWidth] = useState(8);
  const [pgHeight, setPgHeight] = useState(8);
  const [pgFrameDelayMs, setPgFrameDelayMs] = useState(150);
  const [pgRoyaltyBps, setPgRoyaltyBps] = useState(500);
  const [pgFrames, setPgFrames] = useState<PixelEditorFrame[]>(() => [blankFrame(8, 8)]);
  const [pgBusy, setPgBusy] = useState(false);
  const [pgBusyMessage, setPgBusyMessage] = useState<string | null>(null);

  // Auto-select the first operator collection for minting, but keep the
  // PixelGrid editor available for draw-only work if the local operator match
  // is inconclusive.
  useEffect(() => {
    if (!pgContract && pixelGridCollections.length > 0) {
      setPgContract(pixelGridCollections[0].contract);
    } else if (
      pgContract &&
      pixelGridCollections.length > 0 &&
      !pixelGridCollections.some((c) => c.contract === pgContract)
    ) {
      setPgContract(pixelGridCollections[0].contract);
    }
  }, [pixelGridCollections, pgContract]);

  // Probe palette existence whenever the user types a palette id.
  useEffect(() => {
    let cancelled = false;
    if (!pgContract || !pgPaletteId) {
      setPgPaletteExists(null);
      setPgPaletteLocked(false);
      return;
    }
    void (async () => {
      const info = await getPaletteInfo(pgContract, pgPaletteId);
      if (cancelled) return;
      setPgPaletteExists(!!info);
      setPgPaletteLocked(!!info?.locked);
      if (info) {
        const colors = await getPaletteColors(pgContract, pgPaletteId, info.size).catch(
          () => [] as string[]
        );
        if (cancelled || colors.length === 0) return;
        setPgPaletteColors(colors);
        setPgFrames((current) => clampPaletteIndices(current, colors.length));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pgContract, pgPaletteId]);

  // Track previous dims so we can resize frames without losing existing art.
  const prevPgDims = useRef({ w: pgWidth, h: pgHeight });
  useEffect(() => {
    const prev = prevPgDims.current;
    if (prev.w === pgWidth && prev.h === pgHeight) {
      setPgFrames((current) => clampPaletteIndices(current, pgPaletteColors.length));
      return;
    }
    setPgFrames((current) =>
      clampPaletteIndices(
        resizeFrames(current, prev.w, prev.h, pgWidth, pgHeight),
        pgPaletteColors.length
      )
    );
    prevPgDims.current = { w: pgWidth, h: pgHeight };
  }, [pgWidth, pgHeight, pgPaletteColors.length]);

  useEffect(() => {
    if (wallet.account && !form.to) {
      setForm((f) => ({ ...f, to: wallet.account!, royaltyReceiver: f.royaltyReceiver || wallet.account! }));
    }
  }, [wallet.account, form.to]);

  useEffect(() => {
    if (!form.contract && ownedCollections.length > 0) {
      setForm((f) => ({ ...f, contract: ownedCollections[0].contract }));
    }
  }, [ownedCollections, form.contract]);

  function update<K extends keyof MintForm>(key: K, value: MintForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function removePaletteColor(index: number) {
    setPgPaletteColors((colors) => colors.filter((_, i) => i !== index));
    setPgFrames((frames) =>
      frames.map((frame) => ({
        indices: frame.indices.map((paletteIndex) => {
          if (paletteIndex === index) return 0;
          if (paletteIndex > index) return paletteIndex - 1;
          return paletteIndex;
        })
      }))
    );
  }

  function inferMimeType(file: File): string {
    const lowerName = file.name.toLowerCase();
    if (file.type) return file.type;
    if (lowerName.endsWith(".svg")) return "image/svg+xml";
    if (lowerName.endsWith(".json")) return "application/json";
    if (lowerName.endsWith(".txt")) return "text/plain";
    return "application/octet-stream";
  }

  async function handleFile(file: File) {
    const reader = new FileReader();
    const mimeType = inferMimeType(file);
    const isText =
      mimeType.startsWith("text/") ||
      mimeType === "image/svg+xml" ||
      mimeType === "application/json";
    reader.onload = () => {
      if (typeof reader.result === "string") {
        if (isText) {
          update("encoding", "utf8");
          update("mimeType", mimeType);
          update("content", reader.result);
        } else if (reader.result.startsWith("data:")) {
          const idx = reader.result.indexOf("base64,");
          if (idx > -1) {
            const base64 = reader.result.substring(idx + 7);
            update("encoding", "base64");
            update("mimeType", mimeType);
            update("content", base64);
          }
        }
      }
    };
    if (isText) reader.readAsText(file);
    else reader.readAsDataURL(file);
  }

  async function submitMint(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.account) {
      await wallet.connect();
      return;
    }
    if (!form.contract || !form.tokenId || !form.name) {
      push({ kind: "error", title: "Missing required fields" });
      return;
    }
    if (/[.:]/.test(form.tokenId)) {
      push({
        kind: "error",
        title: "Invalid token ID",
        message: "Token IDs cannot contain ':' or '.'."
      });
      return;
    }
    if (form.tokenId.length > MAX_TOKEN_ID_LENGTH) {
      push({
        kind: "error",
        title: "Token ID too long",
        message: `Token IDs must be ≤ ${MAX_TOKEN_ID_LENGTH} characters.`
      });
      return;
    }
    setBusy(true);
    setBusyMessage("Minting token");
    try {
      const common = {
        contract: form.contract,
        tokenId: form.tokenId,
        to: form.to || wallet.account,
        name: form.name,
        description: form.description,
        mimeType: form.mimeType,
        encoding: form.encoding,
        uri: form.uri,
        royaltyReceiver: form.royaltyReceiver || undefined,
        royaltyBps: form.royaltyBps
      };

      if (form.content.length <= MAX_INLINE_CONTENT_LENGTH) {
        await mint({ ...common, content: form.content });
      } else {
        const chunks = splitIntoChunks(form.content, MAX_CONTENT_CHUNK_LENGTH);
        if (chunks.length > MAX_CONTENT_CHUNK_COUNT) {
          throw new Error(
            `Media is too large for on-chain chunked storage (${chunks.length}/${MAX_CONTENT_CHUNK_COUNT} chunks).`
          );
        }

        setBusyMessage(`Preparing ${chunks.length} content chunks`);
        const contentHash = await sha256Hex(form.content);

        // Resume support: if the previous attempt died after mint_chunked but
        // before lock_content for this exact (contract, tokenId, contentHash),
        // pick up from `nextIndex` instead of re-minting.
        const prior = readChunkedProgress();
        const canResume =
          prior != null &&
          prior.contract === form.contract &&
          prior.tokenId === form.tokenId &&
          prior.contentHash === contentHash &&
          prior.chunkCount === chunks.length &&
          !prior.locked;

        let progress: ChunkedMintProgress;
        if (canResume && prior) {
          progress = prior;
        } else {
          await mintChunked({
            ...common,
            contentHash,
            chunkCount: chunks.length
          });
          progress = {
            contract: form.contract,
            tokenId: form.tokenId,
            chunkCount: chunks.length,
            chunkSize: MAX_CONTENT_CHUNK_LENGTH,
            contentHash,
            nextIndex: 0,
            locked: false
          };
          persistChunkedProgress(progress);
        }

        for (let index = progress.nextIndex; index < chunks.length; index++) {
          setBusyMessage(`Uploading chunk ${index + 1}/${chunks.length}`);
          await setContentChunk({
            contract: form.contract,
            tokenId: form.tokenId,
            chunkIndex: index,
            content: chunks[index]
          });
          progress = { ...progress, nextIndex: index + 1 };
          persistChunkedProgress(progress);
        }

        setBusyMessage("Locking content");
        await lockContent(form.contract, form.tokenId);
        // Clear after lock so we don't keep dead state around forever.
        persistChunkedProgress(null);
      }

      push({ kind: "success", title: "Token minted!", message: form.tokenId });
      navigate(`/collections/${form.contract}/token/${encodeURIComponent(form.tokenId)}`);
    } catch (e) {
      setResumeProgress(readChunkedProgress());
      push({
        kind: "error",
        title: "Mint failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  }

  async function submitPixelGridMint(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.account) {
      await wallet.connect();
      return;
    }
    if (!pgContract || !pgTokenId || !pgName || !pgPaletteId) {
      push({ kind: "error", title: "Missing required fields" });
      return;
    }
    if (/[.:]/.test(pgTokenId)) {
      push({
        kind: "error",
        title: "Invalid token ID",
        message: "Token IDs cannot contain ':' or '.'."
      });
      return;
    }
    if (pgTokenId.length > MAX_TOKEN_ID_LENGTH) {
      push({ kind: "error", title: "Token ID too long" });
      return;
    }
    if (pgPaletteColors.length === 0 || pgPaletteColors.length > MAX_PALETTE_SIZE) {
      push({ kind: "error", title: "Palette size out of range" });
      return;
    }

    setPgBusy(true);
    try {
      // Pre-flight: confirm this wallet is the collection operator BEFORE any
      // write. The contract's require_operator() is the real gate, but reading
      // it here means we fail with a precise message instead of a reverted
      // (and stamp-costing) create_palette / mint. We read live rather than
      // trusting the possibly-stale local collection list, so this also clears
      // a legitimate operator whose collection hasn't been discovered yet.
      setPgBusyMessage("Checking operator");
      const collectionMeta = await getContractMetadata(pgContract);
      if (!collectionMeta) {
        throw new Error(
          `"${pgContract}" is not a valid XSC-0005 collection on the current node.`
        );
      }
      if (!isSameAddress(collectionMeta.operator, wallet.account)) {
        throw new Error(
          `This wallet is not the operator of "${pgContract}" (operator is ${shortAddress(
            collectionMeta.operator
          )}). Only the collection operator can mint into it.`
        );
      }

      let paletteSize = pgPaletteColors.length;
      const onChainPalette = await getPaletteInfo(pgContract, pgPaletteId);

      // 1. Create palette if missing.
      if (!onChainPalette) {
        setPgBusyMessage("Creating palette");
        await createPalette({
          contract: pgContract,
          paletteId: pgPaletteId,
          colors: pgPaletteColors,
          locked: true
        });
        setPgPaletteExists(true);
        setPgPaletteLocked(true);
      } else {
        setPgPaletteExists(true);
        setPgPaletteLocked(onChainPalette.locked);
        paletteSize = onChainPalette.size;
        const colors = await getPaletteColors(pgContract, pgPaletteId, onChainPalette.size).catch(
          () => [] as string[]
        );
        if (colors.length > 0) {
          setPgPaletteColors(colors);
          paletteSize = colors.length;
        }
      }

      const maxIndex = maxPaletteIndex(pgFrames);
      if (maxIndex >= paletteSize) {
        throw new Error(
          `Pixel art uses palette index ${maxIndex}, but palette "${pgPaletteId}" only has ${paletteSize} colors.`
        );
      }

      const pixels = framesToPixelString(pgFrames);
      if (!pixels) {
        throw new Error("Nothing to mint.");
      }

      if (onChainPalette && !onChainPalette.locked) {
        // Palette exists but isn't locked yet — lock it before mint.
        setPgBusyMessage("Locking palette");
        await lockPalette(pgContract, pgPaletteId);
        setPgPaletteLocked(true);
      }

      // 2. Mint the pixel-grid token.
      setPgBusyMessage("Minting pixel-grid token");
      await mintPixelGrid({
        contract: pgContract,
        tokenId: pgTokenId,
        to: wallet.account!,
        name: pgName,
        description: pgDescription,
        paletteId: pgPaletteId,
        width: pgWidth,
        height: pgHeight,
        frameCount: pgFrames.length,
        frameDelayMs: pgFrames.length > 1 ? pgFrameDelayMs : 0,
        pixels,
        royaltyBps: pgRoyaltyBps
      });

      push({ kind: "success", title: "Pixel-grid minted!", message: pgTokenId });
      navigate(`/collections/${pgContract}/token/${encodeURIComponent(pgTokenId)}`);
    } catch (e) {
      push({
        kind: "error",
        title: "Pixel-grid mint failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setPgBusy(false);
      setPgBusyMessage(null);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    const c = registerContract.trim();
    if (!c) return;
    setRegisterBusy(true);
    try {
      const ok = await isXSC005(c);
      if (!ok) {
        push({
          kind: "error",
          title: "Not a valid XSC-0005 contract",
          message: "The contract failed the on-chain XSC-0005 checker."
        });
        return;
      }
      const meta = await getContractMetadata(c);
      addCustomCollection(c);
      await refreshCollections();
      push({
        kind: "success",
        title: "Collection registered",
        message: meta?.name ?? c
      });
      setRegisterContract("");
      navigate(`/collections/${c}`);
    } catch (e) {
      push({
        kind: "error",
        title: "Registration failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setRegisterBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
          <Sparkles size={12} /> Create on Xian
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Mint & register</h1>
        <p className="text-base-content/60">
          Mint a new XSC-0005 token in a collection you operate, or register an existing collection
          contract so it shows up in PixelSnek.
        </p>
      </header>

      <div role="tablist" className="tabs tabs-boxed w-fit">
        <button
          role="tab"
          className={`tab gap-2 ${tab === "mint" ? "tab-active" : ""}`}
          onClick={() => setTab("mint")}
        >
          <Plus size={14} /> Mint a token
        </button>
        <button
          role="tab"
          className={`tab gap-2 ${tab === "pixelgrid" ? "tab-active" : ""}`}
          onClick={() => setTab("pixelgrid")}
        >
          <Grid3x3 size={14} /> Pixel grid
        </button>
        <button
          role="tab"
          className={`tab gap-2 ${tab === "register" ? "tab-active" : ""}`}
          onClick={() => setTab("register")}
        >
          <Layers size={14} /> Register a collection
        </button>
      </div>

      {tab === "pixelgrid" ? (
        !wallet.account ? (
          <EmptyState
            icon={AlertCircle}
            title="Wallet required"
            description="Connect your Xian wallet to mint pixel-grid tokens."
          >
            <button className="btn btn-primary btn-sm" onClick={() => wallet.connect()}>
              Connect wallet
            </button>
          </EmptyState>
        ) : (
          <form className="glass rounded-2xl hairline p-6 space-y-6" onSubmit={submitPixelGridMint}>
            {ownedCollections.length === 0 && (
              <div className="alert alert-warning text-sm">
                <AlertCircle size={14} />
                <span>
                  {pixelGridCollections.length === 0
                    ? "No registered collections found. Paste a collection contract below, or register it first."
                    : `No registered operator match for ${shortAddress(wallet.account)}. Minting will only succeed if the selected collection accepts this wallet as operator.`}
                </span>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={() => setTab("register")}
                >
                  Register
                </button>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: identity + palette */}
              <div className="space-y-4">
                <label className="form-control w-full">
                  <span className="label-text text-sm">Collection</span>
                  {pixelGridCollections.length > 0 ? (
                    <select
                      className="select select-bordered w-full"
                      value={pgContract}
                      onChange={(e) => setPgContract(e.target.value)}
                      required
                    >
                      {pixelGridCollections.map((c) => (
                        <option key={c.contract} value={c.contract}>
                          {c.name} — {c.contract}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="input input-bordered w-full font-mono"
                      value={pgContract}
                      onChange={(e) => setPgContract(e.target.value.trim())}
                      placeholder="con_my_collection"
                      required
                    />
                  )}
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-sm">Token ID *</span>
                  <input
                    type="text"
                    className="input input-bordered w-full font-mono"
                    value={pgTokenId}
                    onChange={(e) => setPgTokenId(e.target.value)}
                    placeholder="my-grid-1"
                    required
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-sm">Name *</span>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={pgName}
                    onChange={(e) => setPgName(e.target.value)}
                    required
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-sm">Description</span>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={2}
                    value={pgDescription}
                    onChange={(e) => setPgDescription(e.target.value)}
                  />
                </label>

                <div className="border-t border-base-content/5 pt-3">
                  <label className="form-control w-full">
                    <span className="label-text text-sm">Palette ID *</span>
                    <input
                      type="text"
                      className="input input-bordered w-full font-mono"
                      value={pgPaletteId}
                      onChange={(e) => setPgPaletteId(e.target.value)}
                      placeholder="snek-default"
                      required
                    />
                    <span className="label-text-alt text-xs text-base-content/60 mt-1">
                      {pgPaletteExists === null
                        ? "Type an ID to check the chain."
                        : pgPaletteExists
                          ? pgPaletteLocked
                            ? "Palette exists on-chain (locked). The current colors above are ignored."
                            : "Palette exists but is unlocked — it will be locked before mint."
                          : "Palette does not exist yet — we'll create it as locked with the colors below."}
                    </span>
                  </label>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {pgPaletteColors.map((color, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <input
                          type="color"
                          className="w-8 h-8 rounded cursor-pointer border border-base-content/20"
                          value={color === "transparent" ? "#000000" : color}
                          disabled={pgPaletteExists === true}
                          onChange={(e) => {
                            const next = [...pgPaletteColors];
                            next[i] = e.target.value;
                            setPgPaletteColors(next);
                          }}
                          title={color}
                        />
                        {pgPaletteExists !== true && (
                          <button
                            type="button"
                            className="text-[10px] text-base-content/50 hover:text-error"
                            onClick={() => removePaletteColor(i)}
                            disabled={pgPaletteColors.length <= 1}
                          >
                            remove
                          </button>
                        )}
                      </div>
                    ))}
                    {pgPaletteExists !== true && pgPaletteColors.length < MAX_PALETTE_SIZE && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline gap-1"
                        onClick={() => setPgPaletteColors([...pgPaletteColors, "#ffffff"])}
                      >
                        <Plus size={12} /> Color
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: dimensions, frame delay, royalty, editor */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="form-control w-full">
                    <span className="label-text text-sm">Width</span>
                    <input
                      type="number"
                      min={1}
                      max={32}
                      className="input input-bordered w-full"
                      value={pgWidth}
                      onChange={(e) => setPgWidth(Math.max(1, Math.min(32, Number(e.target.value) || 1)))}
                    />
                  </label>
                  <label className="form-control w-full">
                    <span className="label-text text-sm">Height</span>
                    <input
                      type="number"
                      min={1}
                      max={32}
                      className="input input-bordered w-full"
                      value={pgHeight}
                      onChange={(e) => setPgHeight(Math.max(1, Math.min(32, Number(e.target.value) || 1)))}
                    />
                  </label>
                </div>
                <label className="form-control w-full">
                  <span className="label-text text-sm">
                    Frame delay (ms) {pgFrames.length > 1 ? "" : "— ignored for single-frame"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    className="input input-bordered w-full"
                    value={pgFrameDelayMs}
                    onChange={(e) => setPgFrameDelayMs(Math.max(0, Math.min(10000, Number(e.target.value) || 0)))}
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-sm">
                    Royalty (bps) — currently {(pgRoyaltyBps / 100).toFixed(1)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={ROYALTY_BPS_MAX}
                    step={50}
                    className="range range-primary"
                    value={pgRoyaltyBps}
                    onChange={(e) => setPgRoyaltyBps(Number(e.target.value))}
                  />
                </label>
                <PixelEditor
                  width={pgWidth}
                  height={pgHeight}
                  paletteColors={pgPaletteColors}
                  frames={pgFrames}
                  onFramesChange={setPgFrames}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-base-content/5">
              <button type="submit" className="btn btn-primary gap-2" disabled={pgBusy}>
                {pgBusy ? <Loader2 size={14} className="animate-spin" /> : <Grid3x3 size={14} />}
                {pgBusyMessage ?? "Mint pixel-grid token"}
              </button>
            </div>
          </form>
        )
      ) : tab === "mint" ? (
        !wallet.account ? (
          <EmptyState
            icon={AlertCircle}
            title="Wallet required"
            description="Connect your Xian wallet to mint tokens."
          >
            <button className="btn btn-primary btn-sm" onClick={() => wallet.connect()}>
              Connect wallet
            </button>
          </EmptyState>
        ) : ownedCollections.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="You're not the operator of any registered collection"
            description="PixelSnek can only mint into collections where you are the operator. Register your collection first, or deploy one via the Xian IDE."
          >
            <button className="btn btn-primary btn-sm gap-2" onClick={() => setTab("register")}>
              <Plus size={14} /> Register a collection
            </button>
          </EmptyState>
        ) : (
          <>
            {resumeProgress && (
              <div className="alert alert-warning text-sm">
                <span>
                  Chunked mint of <span className="font-mono">{resumeProgress.tokenId}</span> in
                  collection <span className="font-mono">{resumeProgress.contract}</span> stopped at
                  chunk {resumeProgress.nextIndex} / {resumeProgress.chunkCount}. Re-upload the same
                  media and submit again to resume.
                </span>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={() => {
                    persistChunkedProgress(null);
                  }}
                >
                  Discard
                </button>
              </div>
            )}
          <form className="glass rounded-2xl hairline p-6 space-y-6" onSubmit={submitMint}>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: token data */}
              <div className="space-y-4">
                <div>
                  <label className="form-control w-full">
                    <span className="label-text text-sm">Collection</span>
                    <select
                      className="select select-bordered w-full"
                      value={form.contract}
                      onChange={(e) => update("contract", e.target.value)}
                      required
                    >
                      {ownedCollections.map((c) => (
                        <option key={c.contract} value={c.contract}>
                          {c.name} — {c.contract}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="form-control w-full">
                  <span className="label-text text-sm">Token ID *</span>
                  <input
                    type="text"
                    className="input input-bordered w-full font-mono"
                    value={form.tokenId}
                    onChange={(e) => update("tokenId", e.target.value)}
                    placeholder="my-pixel-1"
                    required
                  />
                  <span className="label-text-alt text-xs text-base-content/50 mt-1">
                    Unique within the collection. No ":" or "." allowed.
                  </span>
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-sm">Name *</span>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="My first pixel"
                    required
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-sm">Description</span>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={3}
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="What is this NFT about?"
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-sm">Mint to</span>
                  <input
                    type="text"
                    className="input input-bordered w-full font-mono text-xs"
                    value={form.to}
                    onChange={(e) => update("to", e.target.value)}
                    placeholder={wallet.account}
                  />
                </label>
              </div>

              {/* Right: content + royalty */}
              <div className="space-y-4">
                <div className="form-control w-full">
                  <span className="label-text text-sm">Media file</span>
                  <label
                    htmlFor="file-input"
                    className="mt-2 flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-base-content/20 bg-base-300/40 cursor-pointer hover:border-primary/60 transition-colors relative overflow-hidden"
                  >
                    {form.content ? (
                      <NFTMedia
                        mimeType={form.mimeType}
                        encoding={form.encoding}
                        content={form.content}
                        uri={form.uri}
                        fallbackSeed={form.tokenId || "preview"}
                        fallbackLabel={form.name || "Preview"}
                      />
                    ) : (
                      <>
                        <Upload size={32} className="text-base-content/40" />
                        <span className="text-sm text-base-content/60 mt-2">
                          Click to upload media
                        </span>
                        <span className="text-xs text-base-content/40 mt-1">
                          SVG · PNG · JPEG · GIF · JSON · TXT
                        </span>
                      </>
                    )}
                    <input
                      id="file-input"
                      type="file"
                      accept="image/*,video/*,audio/*,text/*,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFile(f);
                      }}
                    />
                  </label>
                  {form.content && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs mt-2"
                      onClick={() => update("content", "")}
                    >
                      Clear media
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="form-control w-full">
                    <span className="label-text text-sm">MIME</span>
                    <input
                      type="text"
                      className="input input-bordered w-full text-xs font-mono"
                      value={form.mimeType}
                      onChange={(e) => update("mimeType", e.target.value)}
                    />
                  </label>
                  <label className="form-control w-full">
                    <span className="label-text text-sm">Encoding</span>
                    <select
                      className="select select-bordered w-full"
                      value={form.encoding}
                      onChange={(e) => update("encoding", e.target.value)}
                    >
                      <option value="utf8">utf8</option>
                      <option value="base64">base64</option>
                    </select>
                  </label>
                </div>
                <label className="form-control w-full">
                  <span className="label-text text-sm">External URI (optional)</span>
                  <input
                    type="text"
                    className="input input-bordered w-full text-xs"
                    value={form.uri}
                    onChange={(e) => update("uri", e.target.value)}
                    placeholder="https://… or ipfs://…"
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-sm">
                    Royalty (bps) — currently {(form.royaltyBps / 100).toFixed(1)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={ROYALTY_BPS_MAX}
                    step={50}
                    className="range range-primary"
                    value={form.royaltyBps}
                    onChange={(e) => update("royaltyBps", Number(e.target.value))}
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-sm">Royalty receiver</span>
                  <input
                    type="text"
                    className="input input-bordered w-full font-mono text-xs"
                    value={form.royaltyReceiver}
                    onChange={(e) => update("royaltyReceiver", e.target.value)}
                    placeholder={wallet.account}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-base-content/5">
              <button
                type="submit"
                className="btn btn-primary gap-2"
                disabled={busy}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {busyMessage ?? "Mint token"}
              </button>
            </div>
          </form>
          </>
        )
      ) : (
        <div className="space-y-6">
          <form className="glass rounded-2xl hairline p-6 space-y-4" onSubmit={submitRegister}>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Hash size={16} /> Register an XSC-0005 collection
            </h2>
            <p className="text-sm text-base-content/60">
              Paste the contract address of an XSC-0005 collection you want to view & manage on
              PixelSnek. We'll run it through the on-chain{" "}
              <code className="font-mono">con_xsc005.is_XSC005</code> checker before adding it.
            </p>
            <div className="join w-full">
              <input
                type="text"
                className="join-item input input-bordered flex-1 font-mono"
                placeholder="con_xsc005_nft"
                value={registerContract}
                onChange={(e) => setRegisterContract(e.target.value)}
                required
              />
              <button type="submit" className="join-item btn btn-primary gap-2" disabled={registerBusy}>
                {registerBusy ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                Register
              </button>
            </div>
          </form>

          <div className="glass rounded-2xl hairline p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <ImageIcon size={16} /> Want to deploy a new collection?
            </h3>
            <p className="text-sm text-base-content/60">
              You can deploy a new XSC-0005 collection via the{" "}
              <a
                href="https://ide.xian.org"
                target="_blank"
                rel="noreferrer"
                className="link link-primary"
              >
                Xian IDE
              </a>{" "}
              by submitting the{" "}
              <code className="font-mono">con_xsc005_nft</code> reference contract. Once deployed,
              register it here to start minting.
            </p>
            <Link to="/collections" className="btn btn-ghost btn-sm gap-1 mt-3">
              Browse registered collections <ChevronRight size={14} />
            </Link>
          </div>

          {wallet.account && (
            <div className="glass rounded-2xl hairline p-6">
              <h3 className="font-semibold mb-3">Collections you operate</h3>
              {ownedCollections.length === 0 ? (
                <p className="text-sm text-base-content/60">
                  No registered collections where you ({shortAddress(wallet.account)}) are the operator.
                </p>
              ) : (
                <ul className="space-y-2">
                  {ownedCollections.map((c) => (
                    <li key={c.contract} className="flex items-center justify-between gap-3">
                      <Link
                        to={`/collections/${c.contract}`}
                        className="font-medium hover:text-primary"
                      >
                        {c.name}
                      </Link>
                      <span className="font-mono text-xs text-base-content/50">{c.contract}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
