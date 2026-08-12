import { create } from "zustand";
import type { CartLineType } from "../client/types";

const STORAGE_KEY = "gafa-sdk:cart-v1";

export type CartLine = {
  key: string;
  id: number;
  type: CartLineType;
  name: string;
  price: number;
  priceLabel: string;
  amount: number;
  brandSlug: string;
  locationSlug?: string;
  expirationLabel?: string;
};

/** Contexto de reserva pendiente cuando el checkout nace del calendario. */
export type CartReservationContext = {
  meetingId: number;
  meetingName: string;
  serviceName?: string;
  startsAt: string;
  timezone?: string;
  brandSlug: string;
  locationSlug: string;
  locationName?: string;
  staffName?: string;
  seatObjectId?: number;
  seatLabel?: string;
};

type CartState = {
  lines: CartLine[];
  reservation: CartReservationContext | null;
  addItem: (item: Omit<CartLine, "key" | "amount"> & { amount?: number }) => void;
  removeItem: (key: string) => void;
  setAmount: (key: string, amount: number) => void;
  clearItems: () => void;
  setReservation: (reservation: CartReservationContext | null) => void;
  clearReservation: () => void;
  /** Limpia carrito + reserva tras una compra exitosa. */
  resetAfterPurchase: () => void;
};

function lineKey(type: CartLineType, id: number, brandSlug: string): string {
  return `${brandSlug}:${type}:${id}`;
}

function loadPersisted(): Pick<CartState, "lines" | "reservation"> {
  if (typeof localStorage === "undefined") return { lines: [], reservation: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lines: [], reservation: null };
    const parsed = JSON.parse(raw) as { lines?: CartLine[]; reservation?: CartReservationContext | null };
    return {
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      reservation: parsed.reservation ?? null,
    };
  } catch {
    return { lines: [], reservation: null };
  }
}

function persist(lines: CartLine[], reservation: CartReservationContext | null) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, reservation }));
  } catch {
    // quota / private mode: el carrito vive solo en memoria
  }
}

const initial = loadPersisted();

/**
 * Carrito compartido entre calendario, catalogo y botones HTML de compra.
 * Persiste en localStorage para poder cerrar el fancy, seguir navegando y
 * volver con los productos intactos.
 */
export const useCartStore = create<CartState>((set, get) => ({
  lines: initial.lines,
  reservation: initial.reservation,

  addItem(item) {
    const key = lineKey(item.type, item.id, item.brandSlug);
    const amount = Math.max(1, item.amount ?? 1);
    const existing = get().lines.find((line) => line.key === key);
    const lines = existing
      ? get().lines.map((line) =>
          line.key === key ? { ...line, amount: line.amount + amount } : line,
        )
      : [...get().lines, { ...item, key, amount }];
    const reservation = get().reservation;
    persist(lines, reservation);
    set({ lines });
  },

  removeItem(key) {
    const lines = get().lines.filter((line) => line.key !== key);
    const reservation = get().reservation;
    persist(lines, reservation);
    set({ lines });
  },

  setAmount(key, amount) {
    const next = Math.max(0, Math.floor(amount));
    const lines =
      next === 0
        ? get().lines.filter((line) => line.key !== key)
        : get().lines.map((line) => (line.key === key ? { ...line, amount: next } : line));
    const reservation = get().reservation;
    persist(lines, reservation);
    set({ lines });
  },

  clearItems() {
    const reservation = get().reservation;
    persist([], reservation);
    set({ lines: [] });
  },

  setReservation(reservation) {
    const lines = get().lines;
    persist(lines, reservation);
    set({ reservation });
  },

  clearReservation() {
    const lines = get().lines;
    persist(lines, null);
    set({ reservation: null });
  },

  resetAfterPurchase() {
    persist([], null);
    set({ lines: [], reservation: null });
  },
}));

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.amount, 0);
}

export function formatMoney(amount: number, prefix = "$", suffix = "MXN"): string {
  const formatted = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return suffix ? `${prefix}${formatted} ${suffix}` : `${prefix}${formatted}`;
}
