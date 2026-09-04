import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "concierge.css"), "utf8");

describe("Concierge isolation vs muralla .gafa-sdk / Elementor", () => {
  it("fija --gafa-type-size y --gafa-field-* para no heredar el host", () => {
    expect(css).toContain("--gafa-type-size: 13px");
    expect(css).toContain("--gafa-field-bg: var(--concierge-field-bg, #ffffff)");
    expect(css).toContain("--gafa-control-font-size: 12px");
  });

  it("las pastillas y el input ganan al reset !important de .gafa-sdk", () => {
    expect(css).toContain(".gafa-concierge-chip");
    expect(css).toContain("--gafa-control-padding: 7px 12px");
    expect(css).toContain("html body .gafa-sdk.gafa-sdk.gafa-sdk .gafa-concierge-chip");
    expect(css).toContain("html body .gafa-sdk.gafa-sdk.gafa-sdk .gafa-concierge-input");
    expect(css).toContain("background: var(--concierge-field-bg, #ffffff) none !important");
  });
});
