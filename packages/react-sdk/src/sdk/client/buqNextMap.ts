import type { CartLineType, CatalogItem } from "./types";
import type {
  BuqNextCatalogoSede,
  BuqNextOferta,
  BuqNextVentaTipo,
  LineaSolicitudVenta,
} from "./buqNextContract";

export const CART_LINE_TO_VENTA_TIPO: Record<CartLineType, BuqNextVentaTipo> = {
  combo: "paquete",
  membership: "membresia",
  product: "producto",
};

export const VENTA_TIPO_TO_CART_LINE: Record<BuqNextVentaTipo, CartLineType> = {
  paquete: "combo",
  membresia: "membership",
  producto: "product",
};

export type BuqNextIdIndex = {
  numericByUuid: Map<string, number>;
  uuidByNumeric: Map<number, string>;
};

export function indexBuqNextIds(catalogo: BuqNextCatalogoSede): BuqNextIdIndex {
  const numericByUuid = new Map<string, number>();
  const uuidByNumeric = new Map<number, string>();

  const add = (id: string, numericId: number) => {
    numericByUuid.set(id, numericId);
    uuidByNumeric.set(numericId, id);
  };

  add(catalogo.organizacion.id, catalogo.organizacion.numericId);
  add(catalogo.marca.id, catalogo.marca.numericId);
  add(catalogo.sede.id, catalogo.sede.numericId);
  catalogo.servicios.forEach((item) => add(item.id, item.numericId));
  catalogo.coaches.forEach((item) => add(item.id, item.numericId));
  catalogo.salones.forEach((item) => add(item.id, item.numericId));
  catalogo.clases.forEach((item) => add(item.id, item.numericId));
  catalogo.ofertas.forEach((item) => add(item.id, item.numericId));

  return { numericByUuid, uuidByNumeric };
}

export function pesosFromCentavos(centavos: number): number {
  return Math.round(centavos) / 100;
}

export function formatMxnFromCentavos(centavos: number): string {
  const pesos = pesosFromCentavos(centavos);
  const formatted = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: Number.isInteger(pesos) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pesos);
  return `$${formatted} MXN`;
}

export function ofertaToCatalogItem(oferta: BuqNextOferta): CatalogItem {
  const price = pesosFromCentavos(oferta.precioCentavos);
  return {
    id: oferta.numericId,
    name: oferta.nombre,
    description: oferta.descripcion,
    price,
    priceFinal: price,
    priceLabel: formatMxnFromCentavos(oferta.precioCentavos),
    currency: oferta.moneda,
    type: VENTA_TIPO_TO_CART_LINE[oferta.tipo],
    expirationDays: oferta.vigenciaDias,
    credits: oferta.creditos,
    subscribable: oferta.suscribible,
    raw: {
      ...oferta,
      backend: "buq-next",
    },
  };
}

export function cartLineToLineaSolicitudVenta(
  line: { id: number; type: CartLineType; amount?: number },
  ids: BuqNextIdIndex,
): LineaSolicitudVenta {
  const ofertaId = ids.uuidByNumeric.get(line.id);
  if (!ofertaId) {
    throw new Error(`No hay oferta Buq Next para el CartLine id=${line.id} (${line.type}).`);
  }
  return {
    tipo: CART_LINE_TO_VENTA_TIPO[line.type],
    ofertaId,
    cantidad: line.amount && line.amount > 0 ? line.amount : 1,
  };
}

export function lineaSolicitudVentaToCartRef(
  linea: LineaSolicitudVenta,
  ids: BuqNextIdIndex,
): { id: number; type: CartLineType; amount: number } {
  const id = ids.numericByUuid.get(linea.ofertaId);
  if (id == null) {
    throw new Error(`No hay id numérico SDK para la oferta ${linea.ofertaId}.`);
  }
  return {
    id,
    type: VENTA_TIPO_TO_CART_LINE[linea.tipo],
    amount: linea.cantidad > 0 ? linea.cantidad : 1,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Día de calendario del reloj local (el mismo que usa el widget con `toIsoDate`). */
function calendarDateLocal(now: Date, daysFromToday: number): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Offset de `timeZone` en `instant` (ms a sumar a UTC para obtener la hora de pared). */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const hour = read("hour") % 24;
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), hour, read("minute"), read("second"));
  return asUtc - instant.getTime();
}

/**
 * Instante ISO de una hora de pared en la zona de la sede. Así el calendario
 * pinta 07:00 en CDMX aunque el preview corra en UTC.
 */
export function classStartsAt(
  diasDesdeHoy: number,
  hora: string,
  now = new Date(),
  timeZone = "America/Mexico_City",
): string {
  const [hours, minutes] = hora.split(":").map(Number);
  const day = calendarDateLocal(now, diasDesdeHoy);
  const wall = `${day}T${pad2(hours || 0)}:${pad2(minutes || 0)}:00`;
  const utcGuess = new Date(`${wall}Z`);
  const instant = new Date(utcGuess.getTime() - timeZoneOffsetMs(utcGuess, timeZone));
  return instant.toISOString();
}

export function isoDateOnly(value: string, timeZone?: string): string {
  if (!timeZone) return value.slice(0, 10);
  try {
    const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
    if (!Number.isNaN(date.getTime())) {
      const label = date.toLocaleDateString("en-CA", { timeZone });
      if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
    }
  } catch {
    // fallback
  }
  return value.slice(0, 10);
}

export function meetingInRange(startsAt: string, from?: string, to?: string, timeZone?: string): boolean {
  const day = isoDateOnly(startsAt, timeZone);
  if (from && day < isoDateOnly(from)) return false;
  if (to && day > isoDateOnly(to)) return false;
  return true;
}
