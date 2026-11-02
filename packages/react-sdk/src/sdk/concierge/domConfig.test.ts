import { describe, expect, it } from "vitest";
import { DEMO_CONCIERGE_CONFIG } from "./fixtures";
import { assertConciergeOriginAllowed, isTrustedConciergePreviewOrigin } from "./domConfig";

describe("assertConciergeOriginAllowed", () => {
  it("acepta loopback y Quick Tunnels de Cloudflare", () => {
    expect(isTrustedConciergePreviewOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(isTrustedConciergePreviewOrigin("http://localhost:5173")).toBe(true);
    expect(isTrustedConciergePreviewOrigin("https://consistency-tony-hall-segments.trycloudflare.com")).toBe(true);
    expect(() =>
      assertConciergeOriginAllowed(
        DEMO_CONCIERGE_CONFIG,
        "https://consistency-tony-hall-segments.trycloudflare.com",
      ),
    ).not.toThrow();
  });

  it("acepta solo el link fijo de staging, no cualquier workers.dev", () => {
    expect(isTrustedConciergePreviewOrigin("https://gftheme-staging.i-f47.workers.dev")).toBe(true);
    expect(isTrustedConciergePreviewOrigin("https://otro.i-f47.workers.dev")).toBe(false);
    expect(isTrustedConciergePreviewOrigin("https://gftheme-staging.evil.workers.dev")).toBe(false);
  });

  it("sigue bloqueando origenes que no estan en el allowlist", () => {
    expect(isTrustedConciergePreviewOrigin("https://evil.example.com")).toBe(false);
    expect(() => assertConciergeOriginAllowed(DEMO_CONCIERGE_CONFIG, "https://evil.example.com")).toThrow(
      /not allowed/,
    );
    expect(() => assertConciergeOriginAllowed(DEMO_CONCIERGE_CONFIG, "https://demo.example.com")).not.toThrow();
  });
});
