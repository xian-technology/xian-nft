import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { changeMetadata, changeOperator, type ContractMetadata } from "../lib/nft";
import { useToasts } from "../hooks/useToasts";

interface Props {
  contract: string;
  metadata: ContractMetadata;
  onChanged: () => void;
}

type Field = {
  key: "collection_name" | "collection_symbol" | "collection_description" | "collection_image" | "collection_website";
  label: string;
  placeholder: string;
};

const FIELDS: Field[] = [
  { key: "collection_name", label: "Name", placeholder: "Collection name" },
  { key: "collection_symbol", label: "Symbol", placeholder: "SYM" },
  { key: "collection_description", label: "Description", placeholder: "Short description" },
  { key: "collection_image", label: "Image URL", placeholder: "https://… or ipfs://…" },
  { key: "collection_website", label: "Website", placeholder: "https://…" }
];

/**
 * Inline operator panel for the XSC-0005 `change_metadata` and
 * `change_operator` surface. Renders inside CollectionDetail only when
 * the connected wallet is the collection operator.
 */
export function OperatorPanel({ contract, metadata, onChanged }: Props) {
  const { push } = useToasts();
  const [busy, setBusy] = useState<string | null>(null);
  const [newOperator, setNewOperator] = useState("");
  const [values, setValues] = useState<Record<Field["key"], string>>({
    collection_name: metadata.name ?? "",
    collection_symbol: metadata.symbol ?? "",
    collection_description: metadata.description ?? "",
    collection_image: metadata.image ?? "",
    collection_website: metadata.website ?? ""
  });

  async function saveField(field: Field) {
    setBusy(field.key);
    try {
      const result = await changeMetadata(contract, field.key, values[field.key]);
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Update failed"));
      }
      push({ kind: "success", title: "Saved", message: field.label });
      onChanged();
    } catch (e) {
      push({
        kind: "error",
        title: "Update failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusy(null);
    }
  }

  async function handOff() {
    const target = newOperator.trim();
    if (!target) return;
    if (!window.confirm(`Hand off operator role to ${target}? This cannot be undone.`)) return;
    setBusy("change_operator");
    try {
      const result = await changeOperator(contract, target);
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Operator change failed"));
      }
      push({ kind: "success", title: "Operator updated" });
      setNewOperator("");
      onChanged();
    } catch (e) {
      push({
        kind: "error",
        title: "Operator change failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass rounded-2xl hairline p-5 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ShieldCheck size={18} /> Operator tools
      </h2>
      <p className="text-xs text-base-content/60">
        You are this collection's operator. Edit collection metadata or hand off the role.
      </p>

      <div className="space-y-3">
        {FIELDS.map((field) => (
          <div key={field.key} className="join w-full">
            <span className="join-item btn btn-ghost no-animation pointer-events-none w-32 justify-start text-xs">
              {field.label}
            </span>
            <input
              type="text"
              className="join-item input input-bordered flex-1 text-sm"
              placeholder={field.placeholder}
              value={values[field.key]}
              onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
            />
            <button
              type="button"
              className="join-item btn btn-primary"
              onClick={() => saveField(field)}
              disabled={busy != null}
            >
              {busy === field.key ? <Loader2 size={14} className="animate-spin" /> : "Save"}
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-base-content/5 pt-3">
        <span className="text-xs uppercase tracking-wider text-base-content/60">
          Transfer operator role
        </span>
        <div className="join w-full mt-2">
          <input
            type="text"
            className="join-item input input-bordered flex-1 font-mono text-xs"
            placeholder="New operator address"
            value={newOperator}
            onChange={(e) => setNewOperator(e.target.value)}
          />
          <button
            type="button"
            className="join-item btn btn-warning"
            onClick={handOff}
            disabled={busy != null || !newOperator.trim()}
          >
            {busy === "change_operator" ? <Loader2 size={14} className="animate-spin" /> : "Hand off"}
          </button>
        </div>
      </div>
    </div>
  );
}
