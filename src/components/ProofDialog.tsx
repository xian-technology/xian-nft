import { useState } from "react";
import { Award, Loader2 } from "lucide-react";
import { proveOwnership } from "../lib/nft";
import { useToasts } from "../hooks/useToasts";
import { MAX_PROOF_LENGTH } from "../lib/constants";

interface Props {
  contract: string;
  tokenId: string;
  current: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * UI for the XSC-0005 `prove_ownership` write. Lets an owner attach a
 * short signed proof string to their token (for example, a signed
 * message linking their identity to the token). Anyone can read it
 * back from `token.proof`.
 */
export function ProofDialog({ contract, tokenId, current, onClose, onSaved }: Props) {
  const { push } = useToasts();
  const [proof, setProof] = useState(current ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = proof.trim();
    if (trimmed.length > MAX_PROOF_LENGTH) {
      push({
        kind: "error",
        title: "Proof too long",
        message: `Proof must be ≤ ${MAX_PROOF_LENGTH} characters.`
      });
      return;
    }
    setBusy(true);
    try {
      const result = await proveOwnership(contract, tokenId, trimmed);
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Proof write failed"));
      }
      push({ kind: "success", title: "Ownership proof saved" });
      onSaved();
      onClose();
    } catch (e) {
      push({
        kind: "error",
        title: "Proof write failed",
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
          <Award size={18} /> Sign ownership proof
        </h3>
        <p className="text-sm text-base-content/60 mt-1">
          Attach a short string (often a signed message from off-chain) to your token. Stored
          on-chain in <code className="font-mono">token_data[token_id, "proof"]</code>.
        </p>
        <label className="form-control w-full mt-5">
          <span className="label-text text-sm">Proof</span>
          <textarea
            className="textarea textarea-bordered w-full font-mono text-xs"
            rows={5}
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            maxLength={MAX_PROOF_LENGTH}
            placeholder="signed message, hash, or arbitrary attestation…"
          />
          <span className="label-text-alt text-xs text-base-content/50 mt-1">
            {proof.length} / {MAX_PROOF_LENGTH}
          </span>
        </label>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary gap-2" disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />}
            Save proof
          </button>
        </div>
      </form>
      <button className="modal-backdrop" onClick={onClose} aria-label="Close" />
    </dialog>
  );
}
