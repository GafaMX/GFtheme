import { describe, expect, it } from "vitest";
import { NEXT_STUDIO_FIXTURES } from "./buqNextFixtures";
import {
  CART_LINE_TO_VENTA_TIPO,
  VENTA_TIPO_TO_CART_LINE,
  cartLineToLineaSolicitudVenta,
  classStartsAt,
  indexBuqNextIds,
  lineaSolicitudVentaToCartRef,
  ofertaToCatalogItem,
} from "./buqNextMap";

const ids = indexBuqNextIds(NEXT_STUDIO_FIXTURES);

describe("CartLine ↔ lineaSolicitudVenta", () => {
  it("mapea combo/membership/product al tipo de Ventas", () => {
    expect(CART_LINE_TO_VENTA_TIPO.combo).toBe("paquete");
    expect(CART_LINE_TO_VENTA_TIPO.membership).toBe("membresia");
    expect(CART_LINE_TO_VENTA_TIPO.product).toBe("producto");
    expect(VENTA_TIPO_TO_CART_LINE.paquete).toBe("combo");
  });

  it("id numérico del SDK ↔ uuid de la oferta", () => {
    const paquete = NEXT_STUDIO_FIXTURES.ofertas.find((item) => item.tipo === "paquete");
    const membresia = NEXT_STUDIO_FIXTURES.ofertas.find((item) => item.tipo === "membresia");
    const producto = NEXT_STUDIO_FIXTURES.ofertas.find((item) => item.tipo === "producto");
    if (!paquete || !membresia || !producto) throw new Error("fixtures incompletos");

    expect(cartLineToLineaSolicitudVenta({ id: paquete.numericId, type: "combo", amount: 2 }, ids)).toEqual({
      tipo: "paquete",
      ofertaId: paquete.id,
      cantidad: 2,
    });
    expect(cartLineToLineaSolicitudVenta({ id: membresia.numericId, type: "membership" }, ids)).toEqual({
      tipo: "membresia",
      ofertaId: membresia.id,
      cantidad: 1,
    });
    expect(cartLineToLineaSolicitudVenta({ id: producto.numericId, type: "product", amount: 3 }, ids)).toEqual({
      tipo: "producto",
      ofertaId: producto.id,
      cantidad: 3,
    });
  });

  it("es reversible", () => {
    const oferta = NEXT_STUDIO_FIXTURES.ofertas[1];
    const linea = cartLineToLineaSolicitudVenta({ id: oferta.numericId, type: "combo", amount: 2 }, ids);
    expect(lineaSolicitudVentaToCartRef(linea, ids)).toEqual({
      id: oferta.numericId,
      type: "combo",
      amount: 2,
    });
  });

  it("tira si el id no existe en el catálogo Next", () => {
    expect(() => cartLineToLineaSolicitudVenta({ id: 1, type: "combo" }, ids)).toThrow(/No hay oferta Buq Next/);
    expect(() =>
      lineaSolicitudVentaToCartRef({ tipo: "paquete", ofertaId: "no-existe", cantidad: 1 }, ids),
    ).toThrow(/No hay id numérico/);
  });

  it("deja el uuid original en CatalogItem.raw", () => {
    const item = ofertaToCatalogItem(NEXT_STUDIO_FIXTURES.ofertas[0]);
    expect(item.raw?.id).toBe("oferta-paquete-5-0001");
    expect(item.id).toBe(9701);
  });
});

describe("classStartsAt", () => {
  it("07:00 de pared en CDMX no se corre a UTC", () => {
    const iso = classStartsAt(0, "07:00", new Date("2026-10-06T18:00:00.000Z"), "America/Mexico_City");
    const hour = new Date(iso).toLocaleTimeString("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
    expect(hour.replace(/^24/, "00")).toMatch(/07:00/);
  });
});
