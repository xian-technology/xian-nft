import { describe, expect, it } from "vitest";
import { resolveMedia } from "./content";

describe("UTF-8 media references", () => {
  it.each([
    ["https://example.org/art.png", "https://example.org/art.png"],
    ["ipfs://bafyexample/art.png", "https://ipfs.io/ipfs/bafyexample/art.png"]
  ])("renders an image content URL %s", (content, expected) => {
    expect(resolveMedia({ mimeType: "image/png", encoding: "utf8", content, uri: "" })).toEqual({
      kind: "image",
      url: expected,
      mimeType: "image/png"
    });
  });

  it("keeps inline SVG markup as image bytes", () => {
    const content = '<svg xmlns="http://www.w3.org/2000/svg" />';
    expect(resolveMedia({ mimeType: "image/svg+xml", encoding: "utf8", content, uri: "" })).toEqual({
      kind: "image",
      url: `data:image/svg+xml;utf8,${encodeURIComponent(content)}`,
      inlineSvg: content,
      mimeType: "image/svg+xml"
    });
  });

  it("keeps base64 image bytes in a data URL", () => {
    expect(resolveMedia({ mimeType: "image/png", encoding: "base64", content: "aGVsbG8=", uri: "" }).url)
      .toBe("data:image/png;base64,aGVsbG8=");
  });

  it("does not interpret textual content as a media reference", () => {
    expect(resolveMedia({ mimeType: "text/plain", encoding: "utf8", content: "https://example.org", uri: "" }))
      .toEqual({ kind: "text", url: null, text: "https://example.org", mimeType: "text/plain" });
  });

  it.each(["javascript:alert(1)", "unrecognized image bytes"])("never uses unsafe image content %s as a URL", (content) => {
    expect(resolveMedia({ mimeType: "image/png", encoding: "utf8", content, uri: "" }).url)
      .toBe(`data:image/png;charset=utf-8,${encodeURIComponent(content)}`);
  });

  it("preserves data rendering for other UTF-8 payloads", () => {
    expect(resolveMedia({ mimeType: "application/octet-stream", encoding: "utf8", content: "payload", uri: "" }).url)
      .toBe("data:application/octet-stream;charset=utf-8,payload");
  });

  it.each([
    ['{"name":"art"}', '{\n  "name": "art"\n}'],
    ["invalid JSON", "invalid JSON"]
  ])("renders JSON content %s", (content, text) => {
    expect(resolveMedia({ mimeType: "application/json", encoding: "utf8", content, uri: "" }))
      .toEqual({ kind: "json", url: null, text, mimeType: "application/json" });
  });

  it("normalizes empty input fields", () => {
    expect(resolveMedia({ mimeType: "", encoding: "", content: "", uri: "" }))
      .toEqual({ kind: "unknown", url: null, mimeType: "application/octet-stream" });
  });

  it("uses the external URI when inline content is absent", () => {
    expect(resolveMedia({ mimeType: "image/png", encoding: "UTF8", content: "", uri: "ipfs://bafyexample/art.png" }).url)
      .toBe("https://ipfs.io/ipfs/bafyexample/art.png");
  });
});
