import { useState } from "react";
import { Tag, Loader2 } from "lucide-react";
import { listForSale } from "../lib/nft";
import { useToasts } from "../hooks/useToasts";
import { isPositiveDecimal, toDecimalString } from "../lib/decimal";
import { NATIVE_CURRENCY } from "../lib/constants";

interface Props {
  contract: string;
  tokenId: string;
  onClose: () => void;
  onListed: () => void;
}

export function ListingDialog({ contract, tokenId, onClose, onListed }: Props) {
  const { push } = useToasts();
  const [currencyContract, setCurrencyContract] = useState(NATIVE_CURRENCY);
  const [price, setPrice] = useState("");
  const [reservedFor, setReservedFor] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPositiveDecimal(price)) {
      push({ kind: "error", title: "Invalid price", message: "Price must be a positive decimal." });
      return;
    }
    const priceStr = toDecimalString(price);
    setBusy(true);
    try {
      const result = await listForSale({
        contract,
        tokenId,
        currencyContract: currencyContract.trim(),
        price: priceStr,
        reservedFor: reservedFor.trim() || undefined
      });
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Listing failed"));
      }
      push({ kind: "success", title: "Listed for sale", message: `${tokenId} priced at ${priceStr}` });
      onListed();
      onClose();
    } catch (e) {
      push({
        kind: "error",
        title: "Failed to list",
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
          <Tag size={18} /> List for sale
        </h3>
        <p className="text-sm text-base-content/60 mt-1">
          Anyone holding the chosen currency token can buy your NFT instantly.
        </p>
        <div className="space-y-3 mt-5">
          <label className="form-control w-full">
            <span className="label-text text-sm">Payment token contract</span>
            <input
              type="text"
              className="input input-bordered w-full font-mono"
              value={currencyContract}
              onChange={(e) => setCurrencyContract(e.target.value)}
              placeholder="currency"
            />
            <span className="label-text-alt text-xs text-base-content/50 mt-1">
              Default: <code className="font-mono">currency</code> (native XIAN)
            </span>
          </label>
          <label className="form-control w-full">
            <span className="label-text text-sm">Price</span>
            <input
              type="number"
              step="any"
              min="0"
              className="input input-bordered w-full"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="100"
              required
            />
          </label>
          <label className="form-control w-full">
            <span className="label-text text-sm">
              Reserved for <span className="text-base-content/50">(optional)</span>
            </span>
            <input
              type="text"
              className="input input-bordered w-full font-mono text-xs"
              value={reservedFor}
              onChange={(e) => setReservedFor(e.target.value)}
              placeholder="64-char address"
            />
            <span className="label-text-alt text-xs text-base-content/50 mt-1">
              Only this address will be allowed to buy.
            </span>
          </label>
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary gap-2" disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
            List
          </button>
        </div>
      </form>
      <button className="modal-backdrop" onClick={onClose} aria-label="Close" />
    </dialog>
  );
}
