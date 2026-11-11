import { afterEach, describe, expect, it, vi } from "vitest";
import { useCartStore, type CartLine } from "./cartStore";
import { startCartGuard } from "./cartGuard";

const mk = (id: number, name: string): CartLine => ({
  key: `oasis:combo:${id}`, id, type: "combo", name, price: 100, priceLabel: "$100",
  amount: 1, brandSlug: "oasis", locationSlug: "oasis-1",
});
const rejection = () => Object.assign(new Error("Este producto no puede ser comprado porque es de uso restringido."), { status: 422 });

function client(preview: (id: number) => Promise<void>, signedIn = true) {
  return {
    getProfile: vi.fn(async () => (signedIn ? ({ id: 7 } as never) : null)),
    listLocations: vi.fn(async () => []),
    getCheckoutConfig: vi.fn(async () => ({ paymentMethods: [{ id: 1 }], userProfileId: 7 }) as never),
    previewPurchase: vi.fn(async (p: { lines: Array<{ id: number }> }) => preview(p.lines[0].id)),
  };
}

afterEach(() => {
  useCartStore.setState({ lines: [], reservation: null });
  localStorage.removeItem("gafa-sdk:cart-v1");
});

describe("cartGuard", () => {
  it("al cargar con carrito guardado quita solo los Member y avisa", async () => {
    useCartStore.setState({ lines: [mk(1, "Member A"), mk(2, "Boots"), mk(3, "Member B")] });
    const notify = vi.fn();
    const c = client(async (id) => { if (id !== 2) throw rejection(); });
    const g = startCartGuard({ client: c as never, notify, debounceMs: 0 });
    await new Promise((r) => setTimeout(r, 5));
    await g.run();
    expect(useCartStore.getState().lines.map((l) => l.id)).toEqual([2]);
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Quitamos Member A, Member B de tu carrito/));
    g.stop();
  });

  it("al agregar un producto revisa el carrito y saca el restringido", async () => {
    const notify = vi.fn();
    const c = client(async (id) => { if (id === 9) throw rejection(); });
    const g = startCartGuard({ client: c as never, notify, debounceMs: 0 });
    useCartStore.getState().addItem({ ...mk(9, "Member"), amount: 1 });
    useCartStore.getState().addItem({ ...mk(2, "Boots"), amount: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await g.run();
    expect(useCartStore.getState().lines.map((l) => l.id)).toEqual([2]);
    g.stop();
  });

  it("red caída, 500 o respuesta no JSON nunca borran", async () => {
    useCartStore.setState({ lines: [mk(1, "A"), mk(2, "B"), mk(3, "C")] });
    const errs = [new TypeError("Failed to fetch"), Object.assign(new Error("boom"), { status: 500 }),
      Object.assign(new Error("Tuvimos un problema con el servidor. Inténtalo de nuevo en unos minutos."), { status: 502 })];
    const c = client(async (id) => { throw errs[id - 1]; });
    const notify = vi.fn();
    const g = startCartGuard({ client: c as never, notify, debounceMs: 0 });
    await new Promise((r) => setTimeout(r, 5));
    await g.run();
    expect(useCartStore.getState().lines).toHaveLength(3);
    expect(notify).not.toHaveBeenCalled();
    g.stop();
  });

  it("sin sesión no revisa ni borra; al iniciar sesión sí", async () => {
    useCartStore.setState({ lines: [mk(1, "Member")] });
    let signed = false;
    const c = client(async () => { throw rejection(); });
    c.getProfile = vi.fn(async () => (signed ? ({ id: 7 } as never) : null));
    const g = startCartGuard({ client: c as never, notify: vi.fn(), debounceMs: 0 });
    await new Promise((r) => setTimeout(r, 5));
    await g.run();
    expect(useCartStore.getState().lines).toHaveLength(1);
    signed = true;
    await g.run();
    expect(useCartStore.getState().lines).toHaveLength(0);
    g.stop();
  });
});
