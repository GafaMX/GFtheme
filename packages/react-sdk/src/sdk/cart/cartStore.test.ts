import { afterEach, describe, expect, it } from "vitest";
import { useCartStore, type CartLine } from "./cartStore";

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
