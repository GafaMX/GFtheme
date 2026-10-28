import { afterEach, describe, expect, it, vi } from "vitest";
import { RESERVATE_BACKOFF_MS, RESERVATE_MAX_ATTEMPTS, reservateRetryWait, retryReservate } from "./reservateRetry";

describe("retryReservate", () => {
  it.each([Object.assign(new Error("Unprocessable"), { status: 422 }), Object.assign(new Error("Forbidden"), { status: 403 }), new Error("El código ha alcanzado el límite de usos")])("no reintenta errores de validación: %s", async (error) => {
    const run = vi.fn().mockRejectedValue(error);
    await expect(retryReservate(run)).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("expone el intento para quitar descuentos al reintentar", async () => {
    reservateRetryWait.wait = async () => undefined;
    const run = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({ purchaseId: 1 });
    await retryReservate(run);
    expect(run.mock.calls).toEqual([[0], [1]]);
  });

  afterEach(() => {
    reservateRetryWait.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  });

  it("no reintenta si el primer /reservate responde", async () => {
    const run = vi.fn(async () => ({ purchaseId: 88 }));
    await expect(retryReservate(run)).resolves.toEqual({ purchaseId: 88 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("reintenta con backoff y se queda con el éxito", async () => {
    const waits: number[] = [];
    reservateRetryWait.wait = async (ms) => {
      waits.push(ms);
    };
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ purchaseId: 91 });

    await expect(retryReservate(run)).resolves.toEqual({ purchaseId: 91 });
    expect(run).toHaveBeenCalledTimes(RESERVATE_MAX_ATTEMPTS);
    expect(waits).toEqual([...RESERVATE_BACKOFF_MS]);
  });

  it("agota los intentos y lanza el último error", async () => {
    reservateRetryWait.wait = async () => undefined;
    const run = vi.fn(async () => {
      throw new Error("Server Error");
    });

    await expect(retryReservate(run)).rejects.toThrow("Server Error");
    expect(run).toHaveBeenCalledTimes(RESERVATE_MAX_ATTEMPTS);
  });
});
