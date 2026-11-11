import { describe, expect, it } from "vitest";
import { fitspinWordmarkDataUri } from "./fitspinWordmark";

describe("fitspinWordmarkDataUri", () => {
  it("el canvas abraza el lockup, no deja aire a la derecha", () => {
    const decoded = decodeURIComponent(fitspinWordmarkDataUri().replace("data:image/svg+xml,", ""));
    expect(decoded).toContain('width="168"');
    expect(decoded).toContain('viewBox="0 0 168 44"');
    expect(decoded).not.toContain('width="220"');
    expect(decoded).not.toContain('x="0"');
  });
});
