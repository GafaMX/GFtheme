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

  it("sigue bloqueando origenes que no estan en el allowlist", () => {
    expect(isTrustedConciergePreviewOrigin("https://evil.example.com")).toBe(false);
    expect(() => assertConciergeOriginAllowed(DEMO_CONCIERGE_CONFIG, "https://evil.example.com")).toThrow(
      /not allowed/,
    );
    expect(() => assertConciergeOriginAllowed(DEMO_CONCIERGE_CONFIG, "https://demo.example.com")).not.toThrow();
  });
});
