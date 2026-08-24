import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const themeCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "theme.css"),
  "utf8",
);

describe("theme CSS isolation vs GafaPay", () => {
  it("no resetea botones/svg de la isla de PayPal (gafa-pay-native)", () => {
    expect(themeCss).toContain("button:not(.gafa-pay-native *)");
    expect(themeCss).toContain("svg[stroke]:not([fill]):not(.gafa-pay-native *)");
    expect(themeCss).toContain("input:not(.gafa-pay-native *)");
    expect(themeCss).toContain("select:not(.gafa-pay-native *)");
    expect(themeCss).toMatch(/box-sizing:\s*content-box/);
  });
});
