import type { GafaSdk } from "../runtime";
import { bootstrapableWidgets, mountRegisteredWidget } from "../widgets/registry";

export { readFilterFlag } from "./legacyFilterFlag";

export type LegacyBootstrapResult = {
  mounted: number;
  widgets: string[];
};

const CONCIERGE_NODE = '[data-gf-theme="concierge"], [data-gafa-v2="concierge"]';
/** Una página concreta se excluye con `<body data-gf-concierge="off">`. */
const CONCIERGE_OFF = '[data-gf-concierge="off"]';

function conciergeIsOn(runtime: GafaSdk): boolean {
  const value = runtime.config.concierge;
  return value != null && value !== false;
}

/**
 * La barra flota sobre la página: no ocupa un lugar en el layout, así que no
 * hace falta que el sitio reserve un hueco. Si la config la enciende (Hub u
 * options) y nadie puso el nodo, se cuelga sola del body — instalar el script
 * y prenderla en el Hub alcanza.
 */
function autoMountConcierge(runtime: GafaSdk, doc: Document): boolean {
  if (!conciergeIsOn(runtime)) return false;
  if (!doc.body || doc.querySelector(CONCIERGE_NODE) || doc.querySelector(CONCIERGE_OFF)) return false;
  const host = doc.createElement("div");
  host.setAttribute("data-gf-theme", "concierge");
  host.setAttribute("data-gf-concierge-auto", "true");
  doc.body.appendChild(host);
  return mountRegisteredWidget(runtime, "concierge", host);
}

export function bootstrapLegacyWidgets(runtime: GafaSdk, root: ParentNode = document): LegacyBootstrapResult {
  const widgets: string[] = [];

  // Los [data-gf-theme="purchase-button"] y [data-gf-buy] escuchan por
  // delegacion: una sola vez, aunque el socio vuelva a llamar bootstrap.
  runtime.enablePurchaseButtons(root instanceof Element ? root : undefined);

  bootstrapableWidgets().forEach((widget) => {
    root.querySelectorAll<HTMLElement>(`[data-gf-theme="${widget.shortcode}"]`).forEach((element) => {
      if (mountRegisteredWidget(runtime, widget.shortcode, element)) {
        widgets.push(widget.shortcode);
      }
    });
  });

  // Solo al arrancar la página completa: un bootstrap de un fragmento no debe
  // colgar una segunda barra.
  if (root instanceof Document && autoMountConcierge(runtime, root)) {
    widgets.push("concierge");
  }

  // El mail de "restablecer contraseña" llega con ?token=&email= a la home,
  // que en los sitios viejos solo tiene el boton de cuenta en el header.
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("token") && params.get("email")) {
      runtime.openAccount();
    }
  }

  return { mounted: widgets.length, widgets };
}
