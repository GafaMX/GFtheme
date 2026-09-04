import { afterEach, describe, expect, it } from "vitest";
import { clearToasts, dismissToast, getToasts, showToast, subscribeToasts } from "./toastStore";

afterEach(() => {
  clearToasts();
});

describe("toastStore", () => {
  it("no apila el mismo mensaje", () => {
    showToast("Completa los campos marcados en rojo.", "error");
    showToast("Completa los campos marcados en rojo.", "error");
    expect(getToasts()).toHaveLength(1);
  });

  it("avisa a los suscriptores y se puede cerrar", () => {
    let ticks = 0;
    const stop = subscribeToasts(() => {
      ticks += 1;
    });
    const id = showToast("Credenciales inválidas.", "error");
    expect(ticks).toBe(1);
    dismissToast(id);
    expect(getToasts()).toHaveLength(0);
    expect(ticks).toBe(2);
    stop();
  });
});
