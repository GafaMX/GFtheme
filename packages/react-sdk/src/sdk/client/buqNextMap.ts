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

export function classStartsAt(diasDesdeHoy: number, hora: string, now = new Date()): string {
  const [hours, minutes] = hora.split(":").map(Number);
  const date = new Date(now);
  date.setDate(date.getDate() + diasDesdeHoy);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
}

export function isoDateOnly(value: string): string {
  return value.slice(0, 10);
}

export function meetingInRange(startsAt: string, from?: string, to?: string): boolean {
  const day = isoDateOnly(startsAt);
  if (from && day < isoDateOnly(from)) return false;
  if (to && day > isoDateOnly(to)) return false;
  return true;
}
