import { ConciergePartnerConfig as ConciergePartnerConfigSchema, type ConciergePartnerConfig } from "./contracts";

export type LiveConciergeConfigInput = {
  id: string;
  displayName: string;
  companyId: number;
  locale?: string;
  timezone?: string;
  theme: {
    mode: "light" | "dark";
    accent: string;
    foreground: string;
  };
  whatsapp?: string;
};

/** Config live reusable: textos/marca de la compañía, catálogo vacío hidratado desde BUQ. */
export function createLiveConciergeConfig(input: LiveConciergeConfigInput): ConciergePartnerConfig {
  return ConciergePartnerConfigSchema.parse({
    id: input.id,
    displayName: input.displayName,
    locale: input.locale ?? "es-MX",
    timezone: input.timezone ?? "America/Mexico_City",
    buq: {
      companyId: input.companyId,
      brands: [{ slug: input.id, name: input.displayName, locationIds: ["pending"] }],
    },
    studios: [],
    catalog: { version: "live", products: [], live: true },
    routes: {
      web: { home: "/", calendar: "/", packages: "/paquetes" },
      webview: { home: "/", calendar: "/", packages: "/paquetes" },
    },
    contact: { whatsapp: input.whatsapp ?? "5215500000000" },
    copy: {
      assistantName: "Concierge",
      greeting: `¡Hola! Soy el concierge de ${input.displayName}. Puedo ayudarte a reservar, comprar o resolver tus dudas.`,
      title: `${input.displayName} Concierge`,
      subtitle: "Tu asistente personal",
      fallback: "Puedo ayudarte con horarios, paquetes, sedes y reservas.",
      scope: `Solo puedo ayudar con ${input.displayName}.`,
    },
    capabilities: {
      schedule: true,
      packages: true,
      memberships: true,
      account: true,
      directReservation: true,
      whatsapp: true,
    },
    theme: {
      mode: input.theme.mode,
      accent: input.theme.accent,
      foreground: input.theme.foreground,
      icon: "sparkles",
    },
    fallbacks: { calendar: true, packages: true, account: true, whatsapp: true },
    security: { allowedOrigins: [] },
    experience: {
      locationSwitcher: true,
      openingActions: [
        { label: "Reservar", action: { kind: "reservar" } },
        { label: "Comprar paquetes", action: { kind: "comprar" } },
        { label: "Mi cuenta", action: { kind: "cuenta" } },
        { label: "Horarios de hoy", action: { kind: "horarios_hoy" } },
      ],
      groups: [
        { id: "paquetes", label: "Paquetes", match: { types: ["combo"] } },
        { id: "membresias", label: "Membresías", match: { types: ["membership"] } },
      ],
      copy: {
        packagesIntro: "Elige sede y categoría para ver el catálogo:",
        todayIntro: "Horarios de hoy",
        emptyCatalog: "No hay paquetes para esta combinación.",
        allLocations: "Todas las sedes",
      },
    },
  });
}
