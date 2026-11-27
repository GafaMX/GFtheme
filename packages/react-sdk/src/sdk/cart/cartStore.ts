import { create } from "zustand";
import type { CartLineType } from "../client/types";
import { clampPurchaseAmount, mergeCartRaw, purchaseAmountCap } from "./purchaseCap";

export { formatMoney } from "./money";

const STORAGE_KEY = "gafa-sdk:cart-v1";

export type CartLineRole = "enrollment";

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
  /** Línea de matrícula atada: no se quita ni se cambia la cantidad. */
  role?: CartLineRole;
  locked?: boolean;
  /** JSON original del item de gafa.fit: `/reservate` manda el combo
   *  entero en el cart, como el fancy v1. */
  raw?: Record<string, unknown>;
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
  seatObjectIds?: number[];
  seatLabel?: string;
  invitedData?: Record<string, { name: string; email: string }>;
};

type CartState = {
  lines: CartLine[];
  reservation: CartReservationContext | null;
  /** Elección explícita del checkout, independiente del montaje del proveedor. */
  membershipRecurrence: Record<string, boolean> | null;
  setMembershipRecurrence: (products: string[], selected: boolean) => void;
  addItem: (item: Omit<CartLine, "key" | "amount"> & { amount?: number }) => void;
  removeItem: (key: string) => void;
  setAmount: (key: string, amount: number) => void;
  clearItems: () => void;
  setReservation: (reservation: CartReservationContext | null) => void;
  clearReservation: () => void;
  replaceLines: (lines: CartLine[]) => void;
  /** Limpia carrito + reserva tras una compra exitosa. */
  resetAfterPurchase: () => void;
};

function lineKey(type: CartLineType, id: number, brandSlug: string): string {
  return `${brandSlug}:${type}:${id}`;
}

export function loadPersisted(): Pick<CartState, "lines" | "reservation"> {
  if (typeof localStorage === "undefined") return { lines: [], reservation: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lines: [], reservation: null };
    const parsed = JSON.parse(raw) as { lines?: CartLine[]; reservation?: CartReservationContext | null };
    const lines = Array.isArray(parsed.lines) ? parsed.lines.map(clampLineAmount) : [];
    return {
      lines,
      reservation: parsed.reservation ?? null,
    };
  } catch {
    return { lines: [], reservation: null };
  }
}

function clampLineAmount(line: CartLine): CartLine {
  const cap = purchaseAmountCap(line);
  const amount = Math.max(1, clampPurchaseAmount(line.amount, cap));
  return amount === line.amount ? line : { ...line, amount };
}

function persist(lines: CartLine[], reservation: CartReservationContext | null) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, reservation }));
  } catch {
    // quota / private mode: el carrito vive solo en memoria
  }
}

/** Quantity and unrelated cart lines do not reset an explicit renewal choice. */
export function membershipRecurrenceProducts(lines: CartLine[]): string[] {
  return lines.filter((line) => line.type === "membership").map((line) => line.key);
}

function recurrenceForLines(lines: CartLine[], choice: CartState["membershipRecurrence"]) {
  if (!choice) return null;
  const products = new Set(membershipRecurrenceProducts(lines));
  const remaining = Object.entries(choice).filter(([key]) => products.has(key));
  return remaining.length ? Object.fromEntries(remaining) : null;
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
  membershipRecurrence: null,
  setMembershipRecurrence: (products, selected) => set({ membershipRecurrence: {
    ...get().membershipRecurrence, ...Object.fromEntries(products.map((key) => [key, selected])),
  } }),

  addItem(item) {
    const key = lineKey(item.type, item.id, item.brandSlug);
    const requested = Math.max(1, item.amount ?? 1);
    const existing = get().lines.find((line) => line.key === key);
    const raw = mergeCartRaw(item.raw, existing?.raw);
    const cap = purchaseAmountCap({ raw });
    const lines = existing
      ? get().lines.map((line) =>
          line.key === key
            ? { ...line, amount: Math.max(1, clampPurchaseAmount(line.amount + requested, cap)), raw: raw ?? line.raw }
            : line,
        )
      : [...get().lines, { ...item, key, amount: Math.max(1, clampPurchaseAmount(requested, cap)), raw }];
    const reservation = get().reservation;
    persist(lines, reservation);
    set({ lines, membershipRecurrence: recurrenceForLines(lines, get().membershipRecurrence) });
  },

  removeItem(key) {
    const target = get().lines.find((line) => line.key === key);
    if (target?.locked) return;
    const lines = get().lines.filter((line) => line.key !== key);
    const reservation = get().reservation;
    persist(lines, reservation);
    set({ lines, membershipRecurrence: recurrenceForLines(lines, get().membershipRecurrence) });
  },

  setAmount(key, amount) {
    const current = get().lines.find((line) => line.key === key);
    if (current?.locked) return;
    const cap = purchaseAmountCap(current);
    const next = clampPurchaseAmount(amount, cap);
    const lines =
      next === 0
        ? get().lines.filter((line) => line.key !== key)
        : get().lines.map((line) => (line.key === key ? { ...line, amount: next } : line));
    const reservation = get().reservation;
    persist(lines, reservation);
    set({ lines, membershipRecurrence: recurrenceForLines(lines, get().membershipRecurrence) });
  },

  clearItems() {
    const reservation = get().reservation;
    persist([], reservation);
    set({ lines: [], membershipRecurrence: null });
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

  replaceLines(next) {
    const reservation = get().reservation;
    persist(next, reservation);
    set({ lines: next, membershipRecurrence: recurrenceForLines(next, get().membershipRecurrence) });
  },

  resetAfterPurchase() {
    persist([], null);
    set({ lines: [], reservation: null, membershipRecurrence: null });
  },
}));

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.amount, 0);
}
