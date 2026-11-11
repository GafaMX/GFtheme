import { afterEach, describe, expect, it } from "vitest";
import {
  PreviewTimeoutError,
  isPreviewTimeoutError,
  setPreviewPurchaseTimeoutMsForTests,
  withTimeout,
} from "./purchasePreview";

describe("withTimeout", () => {
  afterEach(() => {
    setPreviewPurchaseTimeoutMsForTests(null);
  });

  it("devuelve el valor si llega a tiempo", async () => {
    setPreviewPurchaseTimeoutMsForTests(80);
    await expect(withTimeout(Promise.resolve("ok"))).resolves.toBe("ok");
  });

  it("corta con PreviewTimeoutError si la promesa no responde", async () => {
    setPreviewPurchaseTimeoutMsForTests(20);
    await expect(withTimeout(new Promise(() => undefined))).rejects.toBeInstanceOf(PreviewTimeoutError);
    await expect(withTimeout(new Promise(() => undefined))).rejects.toSatisfy(isPreviewTimeoutError);
  });
});
