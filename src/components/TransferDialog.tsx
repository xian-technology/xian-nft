import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { transfer } from "../lib/nft";
import { useToasts } from "../hooks/useToasts";

interface Props {
  contract: string;
  tokenId: string;
  onClose: () => void;
  onTransferred: () => void;
}

export function TransferDialog({ contract, tokenId, onClose, onTransferred }: Props) {
  const { push } = useToasts();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const dest = to.trim();
    if (!dest) {
      push({ kind: "error", title: "Recipient required" });
      return;
    }
    setBusy(true);
    try {
      const result = await transfer(contract, tokenId, dest);
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Transfer failed"));
      }
      push({ kind: "success", title: "Transferred", message: `${tokenId} → ${dest}` });
      onTransferred();
      onClose();
    } catch (e) {
      push({
        kind: "error",
        title: "Transfer failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog open className="modal modal-open">
      <form className="modal-box max-w-md" onSubmit={submit}>
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Send size={18} /> Transfer NFT
        </h3>
        <p className="text-sm text-base-content/60 mt-1">
          Send <span className="font-mono">{tokenId}</span> to another Xian address.
        </p>
        <label className="form-control w-full mt-5">
          <span className="label-text text-sm">Recipient address</span>
          <input
            type="text"
            className="input input-bordered w-full font-mono text-xs"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="64-character address"
            required
          />
        </label>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary gap-2" disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send
          </button>
        </div>
      </form>
      <button className="modal-backdrop" onClick={onClose} aria-label="Close" />
    </dialog>
  );
}
