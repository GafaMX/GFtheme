import {
  ConciergeResponseSchema,
  type ConciergeBody,
  type ConciergePartnerConfig,
  type ConciergeResponseData,
} from "./contracts";
import type { ConciergeBrowserAdapter } from "./adapter";
import { whatsappAvailable } from "./experience";
import { conciergeProducts } from "./products";

export type ConciergeAskOptions = {
  signal?: AbortSignal;
};

export type ConciergeAskFn = (
  partnerId: string,
  body: ConciergeBody,
  options?: ConciergeAskOptions,
) => Promise<unknown>;

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return new URL(path.replace(/^\//, ""), normalizedBase).toString();
}

export function createHttpConciergeAsk(
  apiBaseUrl: string,
  path = "concierge/v1",
): ConciergeAskFn {
  return async (partnerId, body, options) => {
    const response = await fetch(joinUrl(apiBaseUrl, `${path}/${encodeURIComponent(partnerId)}`), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...body, partnerId }),
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error(`concierge_http_${response.status}`);
    }
    return response.json();
  };
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function createLocalConciergeAsk(options: {
  config: ConciergePartnerConfig;
  adapter: ConciergeBrowserAdapter;
}): ConciergeAskFn {
  const { config, adapter } = options;

  return async (partnerId, body) => {
    if (partnerId !== config.id) {
      throw new Error("partner_not_found");
    }

    const message = normalize(body.message);
    const requestedStudio = config.studios.find((studio) => {
      const labels = [studio.id, studio.name, studio.city].map(normalize);
      return labels.some((label) => label.length > 2 && message.includes(label));
    });

    if (/precio|paquete|membres|comprar|costo|pass|package|price/.test(message) && config.capabilities.packages) {
      const items = conciergeProducts(config)
        .filter((product) => !requestedStudio || product.locationId === requestedStudio.locationId)
        .map((product) => ({
          name: product.name,
          price: product.price,
          note: product.note,
          action: {
            kind: "buy_package" as const,
            productType: product.type,
            productId: product.id,
            brandSlug: product.brandSlug,
            locationId: product.locationId,
          },
        }));
      return ConciergeResponseSchema.parse({
        version: "v1",
        message: items.length ? "Estos son los paquetes disponibles:" : config.copy.fallback,
        card: items.length ? { type: "packages", items } : undefined,
        chips: items.length || !config.fallbacks.packages
          ? undefined
          : [{ label: "Ver paquetes", action: { kind: "comprar" } }],
      } satisfies ConciergeResponseData);
    }

    if (/sede|ubicacion|direccion|estudio|studio|location|address/.test(message)) {
      return ConciergeResponseSchema.parse({
        version: "v1",
        message: "Estas son nuestras sedes:",
        card: {
          type: "studios",
          items: config.studios.map(({ name, city, address, mapsUrl }) => ({
            name,
            city,
            address,
            mapsUrl,
          })),
        },
      } satisfies ConciergeResponseData);
    }

    if (/horario|clase|agenda|calendario|reserv|schedule|class|book/.test(message) && config.capabilities.schedule) {
      const studio = requestedStudio ?? config.studios[0];
      const date = todayInTimeZone(config.timezone);
      const result = await adapter.listMeetings(studio.locationId, date);
      if (result.status === "ok" && result.items.length) {
        return ConciergeResponseSchema.parse({
          version: "v1",
          message: `Horarios de ${studio.name} para ${date}:`,
          card: {
            type: "schedule",
            locationName: studio.name,
            date,
            locationId: studio.locationId,
            items: result.items,
          },
        } satisfies ConciergeResponseData);
      }
      return ConciergeResponseSchema.parse({
        version: "v1",
        message: config.copy.fallback,
        chips: config.fallbacks.calendar
          ? [{ label: "Abrir calendario", action: { kind: "reservar" } }]
          : undefined,
      } satisfies ConciergeResponseData);
    }

    return ConciergeResponseSchema.parse({
      version: "v1",
      message: config.copy.fallback,
      chips: [
        ...(config.fallbacks.calendar ? [{ label: "Abrir calendario", action: { kind: "reservar" as const } }] : []),
        ...(config.fallbacks.packages ? [{ label: "Ver paquetes", action: { kind: "comprar" as const } }] : []),
        ...(config.fallbacks.whatsapp && whatsappAvailable(config) ? [{ label: "WhatsApp", action: { kind: "whatsapp" as const } }] : []),
      ],
    } satisfies ConciergeResponseData);
  };
}

export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
