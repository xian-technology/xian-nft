import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import {
  approve as approveToken,
  getApproved,
  isApprovedForAll,
  revokeApproval,
  setApprovalForAll
} from "../lib/nft";
import { useToasts } from "../hooks/useToasts";
import { shortAddress } from "../lib/format";

interface Props {
  contract: string;
  tokenId: string;
  owner: string;
  account: string;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * UI for the XSC-0005 approval surface: per-token `approve` / `revoke`,
 * and collection-wide `set_approval_for_all`. Only the token owner can
 * grant these; the dialog is gated on `isOwner` upstream.
 */
export function ApprovalsDialog({ contract, tokenId, owner, account, onClose, onChanged }: Props) {
  const { push } = useToasts();
  const [perToken, setPerToken] = useState("");
  const [operator, setOperator] = useState("");
  const [currentApproved, setCurrentApproved] = useState("");
  const [operatorApproved, setOperatorApproved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const v = await getApproved(contract, tokenId).catch(() => "");
      if (!cancelled) setCurrentApproved(v);
    })();
    return () => {
      cancelled = true;
    };
  }, [contract, tokenId]);

  async function approveOne() {
    if (!perToken.trim()) return;
    setBusy("approve");
    try {
      const result = await approveToken(contract, tokenId, perToken.trim());
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Approve failed"));
      }
      push({ kind: "success", title: "Approved", message: shortAddress(perToken.trim()) });
      setCurrentApproved(perToken.trim());
      onChanged();
    } catch (e) {
      push({
        kind: "error",
        title: "Approve failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusy(null);
    }
  }

  async function revokeOne() {
    setBusy("revoke");
    try {
      const result = await revokeApproval(contract, tokenId);
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Revoke failed"));
      }
      push({ kind: "success", title: "Approval revoked" });
      setCurrentApproved("");
      onChanged();
    } catch (e) {
      push({
        kind: "error",
        title: "Revoke failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusy(null);
    }
  }

  async function checkOperator() {
    if (!operator.trim()) return;
    setBusy("query");
    try {
      const v = await isApprovedForAll(contract, owner, operator.trim());
      setOperatorApproved((prev) => ({ ...prev, [operator.trim()]: v }));
    } finally {
      setBusy(null);
    }
  }

  async function setOperatorState(value: boolean) {
    if (!operator.trim()) return;
    setBusy("operator");
    try {
      const result = await setApprovalForAll(contract, operator.trim(), value);
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Operator update failed"));
      }
      push({
        kind: "success",
        title: value ? "Operator approved" : "Operator removed",
        message: shortAddress(operator.trim())
      });
      setOperatorApproved((prev) => ({ ...prev, [operator.trim()]: value }));
      onChanged();
    } catch (e) {
      push({
        kind: "error",
        title: "Operator update failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusy(null);
    }
  }

  const queriedOperator = operator.trim();
  const operatorState =
    queriedOperator in operatorApproved ? operatorApproved[queriedOperator] : null;

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <KeyRound size={18} /> Manage approvals
        </h3>
        <p className="text-sm text-base-content/60 mt-1">
          Signed-in as <span className="font-mono">{shortAddress(account)}</span>. Owner can grant a
          single spender per token (`approve`) or operator-approve any address to manage every
          token they own in this collection.
        </p>

        <div className="space-y-4 mt-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-base-content/60">
              Per-token spender
            </div>
            <div className="text-sm mt-1">
              Currently approved:{" "}
              {currentApproved ? (
                <span className="font-mono">{shortAddress(currentApproved)}</span>
              ) : (
                <span className="text-base-content/40">none</span>
              )}
            </div>
            <div className="join w-full mt-2">
              <input
                type="text"
                className="join-item input input-bordered flex-1 font-mono text-xs"
                placeholder="Spender address"
                value={perToken}
                onChange={(e) => setPerToken(e.target.value)}
              />
              <button
                type="button"
                className="join-item btn btn-primary"
                onClick={approveOne}
                disabled={busy != null}
              >
                {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : "Approve"}
              </button>
              {currentApproved && (
                <button
                  type="button"
                  className="join-item btn btn-warning"
                  onClick={revokeOne}
                  disabled={busy != null}
                >
                  {busy === "revoke" ? <Loader2 size={14} className="animate-spin" /> : "Revoke"}
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-base-content/5 pt-3">
            <div className="text-xs uppercase tracking-wider text-base-content/60">
              Collection-wide operator
            </div>
            <p className="text-xs text-base-content/50 mt-1">
              Operators can transfer any token you own in this collection.
            </p>
            <div className="join w-full mt-2">
              <input
                type="text"
                className="join-item input input-bordered flex-1 font-mono text-xs"
                placeholder="Operator address"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              />
              <button
                type="button"
                className="join-item btn btn-ghost"
                onClick={checkOperator}
                disabled={busy != null}
              >
                {busy === "query" ? <Loader2 size={14} className="animate-spin" /> : "Check"}
              </button>
            </div>
            {operatorState !== null && (
              <div className="text-xs mt-2 flex items-center gap-2">
                <span className="text-base-content/60">Status:</span>
                <span className={operatorState ? "text-success" : "text-base-content/50"}>
                  {operatorState ? "approved" : "not approved"}
                </span>
                <button
                  type="button"
                  className="btn btn-xs btn-primary"
                  onClick={() => setOperatorState(!operatorState)}
                  disabled={busy != null}
                >
                  {busy === "operator" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : operatorState ? (
                    "Revoke"
                  ) : (
                    "Approve"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy != null}>
            Close
          </button>
        </div>
      </div>
      <button className="modal-backdrop" onClick={onClose} aria-label="Close" />
    </dialog>
  );
}
