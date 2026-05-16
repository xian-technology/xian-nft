const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export function ipfsToGatewayUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("ipfs://")) return trimmed;
  const cidPath = trimmed.replace(/^ipfs:\/\//, "").replace(/^ipfs\//, "");
  return `${IPFS_GATEWAY}${cidPath}`;
}

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = ipfsToGatewayUrl(value);
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = ipfsToGatewayUrl(value);
  try {
    const url = new URL(normalized);
    if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "data:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}
