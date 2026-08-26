import type { GafaSdk } from "../runtime";
import { bootstrapableWidgets, mountRegisteredWidget } from "../widgets/registry";

export type LegacyBootstrapResult = {
  mounted: number;
  widgets: string[];
};

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
