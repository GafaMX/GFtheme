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
