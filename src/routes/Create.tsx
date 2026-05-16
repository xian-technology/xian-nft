import { useEffect, useMemo, useState } from "react";
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
  Layers
} from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useCollections } from "../hooks/useCollections";
import { useToasts } from "../hooks/useToasts";
import { addCustomCollection } from "../lib/collections";
import {
  getContractMetadata,
  isXSC005,
  lockContent,
  mint,
  mintChunked,
  setContentChunk
} from "../lib/nft";
import { NFTMedia } from "../components/NFTMedia";
import { EmptyState } from "../components/EmptyState";
import {
  MAX_CONTENT_CHUNK_COUNT,
  MAX_CONTENT_CHUNK_LENGTH,
  MAX_INLINE_CONTENT_LENGTH,
  ROYALTY_BPS_MAX
} from "../lib/constants";
import { shortAddress } from "../lib/format";
import { sha256Hex, splitIntoChunks } from "../lib/hash";

type Tab = "mint" | "register";

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
    () => (wallet.account ? collections.filter((c) => c.operator === wallet.account) : []),
    [collections, wallet.account]
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
        await mintChunked({
          ...common,
          contentHash,
          chunkCount: chunks.length
        });

        for (let index = 0; index < chunks.length; index++) {
          setBusyMessage(`Uploading chunk ${index + 1}/${chunks.length}`);
          await setContentChunk({
            contract: form.contract,
            tokenId: form.tokenId,
            chunkIndex: index,
            content: chunks[index]
          });
        }

        setBusyMessage("Locking content");
        await lockContent(form.contract, form.tokenId);
      }

      push({ kind: "success", title: "Token minted!", message: form.tokenId });
      navigate(`/collections/${form.contract}/token/${encodeURIComponent(form.tokenId)}`);
    } catch (e) {
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
          className={`tab gap-2 ${tab === "register" ? "tab-active" : ""}`}
          onClick={() => setTab("register")}
        >
          <Layers size={14} /> Register a collection
        </button>
      </div>

      {tab === "mint" ? (
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
