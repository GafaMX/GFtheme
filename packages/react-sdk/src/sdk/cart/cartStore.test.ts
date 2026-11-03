import { afterEach, describe, expect, it } from "vitest";
import { loadPersisted, useCartStore, type CartLine } from "./cartStore";

const line: CartLine = {
  key: "fitspin:combo:3",
  id: 3,
  type: "combo",
  name: "3 Clases",
  price: 2850,
  priceLabel: "$2,850",
  amount: 1,
  brandSlug: "fitspin",
  locationSlug: "polanco",
};

afterEach(() => {
  useCartStore.setState({ lines: [], reservation: null });
  localStorage.removeItem("gafa-sdk:cart-v1");
});

describe("cartStore purchase cap", () => {
  it("addItem no suma más si reservations_max=1", () => {
    const once = { ...line, raw: { reservations_max: 1 } };
    useCartStore.getState().addItem(once);
    useCartStore.getState().addItem(once);
    expect(useCartStore.getState().lines[0]?.amount).toBe(1);
  });

  it("setAmount no pasa de reservations_max", () => {
    useCartStore.getState().addItem({ ...line, raw: { reservations_max: 1 } });
    const key = useCartStore.getState().lines[0]!.key;
    useCartStore.getState().setAmount(key, 4);
    expect(useCartStore.getState().lines[0]?.amount).toBe(1);
  });

  it("sin tope sigue pudiendo sumar", () => {
    useCartStore.getState().addItem(line);
    useCartStore.getState().addItem(line);
    expect(useCartStore.getState().lines[0]?.amount).toBe(2);
  });

  it("respeta un tope mayor a 1", () => {
    const capped = { ...line, raw: { reservations_max: 3 } };
    useCartStore.getState().addItem({ ...capped, amount: 2 });
    useCartStore.getState().addItem({ ...capped, amount: 5 });
    expect(useCartStore.getState().lines[0]?.amount).toBe(3);
  });

  it("setAmount en 0 sigue quitando la línea", () => {
    useCartStore.getState().addItem({ ...line, raw: { reservations_max: 1 } });
    const key = useCartStore.getState().lines[0]!.key;
    useCartStore.getState().setAmount(key, 0);
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it("membresía con reservations_max=1 tampoco suma", () => {
    const membership = {
      ...line,
      id: 50,
      type: "membership" as const,
      name: "Intro",
      raw: { reservations_max: 1 },
    };
    useCartStore.getState().addItem(membership);
    useCartStore.getState().addItem(membership);
    expect(useCartStore.getState().lines[0]?.type).toBe("membership");
    expect(useCartStore.getState().lines[0]?.amount).toBe(1);
  });

  it("no pierde el tope si llega un raw incompleto", () => {
    useCartStore.getState().addItem({ ...line, raw: { reservations_max: 1, name: "3 Clases" } });
    useCartStore.getState().addItem({ ...line, raw: { name: "3 Clases" }, amount: 2 });
    expect(useCartStore.getState().lines[0]?.amount).toBe(1);
    expect(useCartStore.getState().lines[0]?.raw?.reservations_max).toBe(1);
  });

  it("loadPersisted recorta una línea guardada de 4 a 1", () => {
    localStorage.setItem(
      "gafa-sdk:cart-v1",
      JSON.stringify({
        lines: [{ ...line, amount: 4, raw: { reservations_max: 1 } }],
        reservation: null,
      }),
    );
    expect(loadPersisted().lines[0]?.amount).toBe(1);
  });
});

describe("cartStore reservation", () => {
  it("clearReservation quita la clase y deja los paquetes", () => {
    useCartStore.setState({
      lines: [line],
      reservation: {
        meetingId: 99,
        meetingName: "HELIPUERTO BICI 🚲",
        startsAt: "2026-08-15T09:30:00",
        brandSlug: "fitspin",
        locationSlug: "polanco",
        locationName: "Polanco",
      },
    });

    useCartStore.getState().clearReservation();

    expect(useCartStore.getState().reservation).toBeNull();
    expect(useCartStore.getState().lines).toEqual([line]);
  });
});
