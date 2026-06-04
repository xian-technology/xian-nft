import { useState } from "react";
import { ShoppingBag, Loader2, ShieldCheck } from "lucide-react";
import { approveAndBuy, type ListingInfo } from "../lib/nft";
import { useToasts } from "../hooks/useToasts";
import { formatPrice } from "../lib/decimal";
import { NATIVE_CURRENCY } from "../lib/constants";

interface Props {
  contract: string;
  tokenId: string;
  listing: ListingInfo;
  onClose: () => void;
  onBought: () => void;
}

export function BuyDialog({ contract, tokenId, listing, onClose, onBought }: Props) {
  const { push } = useToasts();
  const [busy, setBusy] = useState(false);

  const currencyLabel = listing.currencyContract === NATIVE_CURRENCY ? "XIAN" : listing.currencyContract;

  async function buy() {
    setBusy(true);
    try {
      // Pass the exact chain decimal string through — never run it through Number.
      const result = await approveAndBuy({
        contract,
        tokenId,
        currencyContract: listing.currencyContract,
        price: listing.price
      });
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Purchase failed"));
      }
      push({
        kind: "success",
        title: "Purchase complete!",
        message: `You now own ${tokenId}.`
      });
      onBought();
      onClose();
    } catch (e) {
      push({
        kind: "error",
        title: "Purchase failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <ShoppingBag size={18} /> Complete purchase
        </h3>
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-base-300 p-5 border border-base-content/5">
            <div className="text-xs text-base-content/60 mb-1">You pay</div>
            <div className="text-3xl font-bold">
              {formatPrice(listing.price)}{" "}
              <span className="text-base font-normal text-base-content/70">{currencyLabel}</span>
            </div>
            <div className="text-xs text-base-content/50 font-mono mt-2 break-all">
              token id: {tokenId}
            </div>
          </div>

          <div className="text-xs text-base-content/60 flex items-start gap-2">
            <ShieldCheck size={14} className="text-success shrink-0 mt-0.5" />
            <span>
              We'll request an <strong>approval</strong> for the exact price and then call{" "}
              <code className="font-mono">buy</code> in a single flow. Royalties (if set by the
              creator) are automatically routed to them by the contract.
            </span>
          </div>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary gap-2" onClick={buy} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
            Buy now
          </button>
        </div>
      </div>
      <button className="modal-backdrop" onClick={onClose} aria-label="Close" />
    </dialog>
  );
}
