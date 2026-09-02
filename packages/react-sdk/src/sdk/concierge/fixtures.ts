import {
  CONCIERGE_PARTNER_SCHEMA_VERSION,
  type ConciergePartnerConfig,
} from "./types";

export const fitspinConciergeFixture: ConciergePartnerConfig = {
  schemaVersion: CONCIERGE_PARTNER_SCHEMA_VERSION,
  partnerId: "fitspin",
  tenantId: "tenant_fitspin_example",
  companyId: 1001,
  environment: "staging",
  brandSlugs: ["fitspin-studio"],
  timezone: "America/Mexico_City",
  locale: "es-MX",
  allowedOrigins: ["https://fitspin.example"],
  capabilities: {
    schedules: true,
    locations: true,
    combos: true,
    memberships: true,
    profile: true,
    directReservation: true,
    whatsapp: true,
    calendar: true,
    purchase: true,
  },
  theme: {
    name: "Fitspin",
    greeting: "Hola, soy tu concierge Fitspin",
    colors: {
      primary: "#111111",
      primaryText: "#ffffff",
      accent: "#ff5a2f",
      background: "#fff8f3",
      surface: "#ffffff",
      text: "#171717",
      mutedText: "#6f625c",
      border: "#eadfd6",
    },
    typography: {
      fontFamily: "Inter, system-ui, sans-serif",
    },
    radius: {
      card: "18px",
      button: "999px",
      modal: "24px",
    },
    mode: "light",
  },
  routes: {
    calendar: "/reservas",
    packages: "/paquetes",
    account: "/cuenta",
  },
  channels: {
    whatsapp: {
      phone: "+525500000000",
      label: "WhatsApp Fitspin",
      messageTemplate: "Hola, quiero ayuda con mi reserva.",
    },
  },
  catalog: {
    locations: [
      {
        id: 3001,
        slug: "fitspin-roma",
        brandSlug: "fitspin-studio",
        name: "Fitspin Roma",
      },
    ],
    meetings: [
      {
        meetingId: 9001,
        brandSlug: "fitspin-studio",
        locationSlug: "fitspin-roma",
        startsAt: "2026-09-03T14:00:00-06:00",
        serviceName: "Ride 45",
      },
    ],
    items: [
      {
        kind: "combo",
        id: 7001,
        brandSlug: "fitspin-studio",
        locationSlug: "fitspin-roma",
        name: "Paquete 5 clases",
        priceLabel: "$1,000 MXN",
      },
      {
        kind: "membership",
        id: 7101,
        brandSlug: "fitspin-studio",
        locationSlug: "fitspin-roma",
        name: "Membresia mensual",
        priceLabel: "$1,900 MXN",
      },
    ],
  },
};

export const demoWellnessConciergeFixture: ConciergePartnerConfig = {
  schemaVersion: CONCIERGE_PARTNER_SCHEMA_VERSION,
  partnerId: "demo-wellness",
  tenantId: "tenant_demo_wellness",
  companyId: 2002,
  environment: "staging",
  brandSlugs: ["demo-wellness-club"],
  timezone: "America/Bogota",
  locale: "es-CO",
  allowedOrigins: ["https://demo-wellness.example"],
  capabilities: {
    schedules: true,
    locations: true,
    combos: true,
    memberships: false,
    profile: true,
    directReservation: false,
    whatsapp: false,
    calendar: true,
    purchase: true,
  },
  theme: {
    name: "Demo Wellness",
    greeting: "Hola, te ayudo a encontrar tu siguiente clase",
    colors: {
      primary: "#123c69",
      primaryText: "#ffffff",
      accent: "#3ddc97",
      background: "#eef7f2",
      surface: "#ffffff",
      text: "#10231c",
      mutedText: "#60756c",
      border: "#cfe2d8",
    },
    typography: {
      fontFamily: "system-ui, sans-serif",
    },
    radius: {
      card: "12px",
      button: "10px",
      modal: "18px",
    },
    mode: "light",
  },
  routes: {
    calendar: "/agenda",
    packages: "/planes",
    account: "/perfil",
  },
  catalog: {
    locations: [
      {
        id: 4001,
        slug: "norte",
        brandSlug: "demo-wellness-club",
        name: "Sede Norte",
      },
    ],
    meetings: [
      {
        meetingId: 9101,
        brandSlug: "demo-wellness-club",
        locationSlug: "norte",
        startsAt: "2026-09-03T09:00:00-05:00",
        serviceName: "Mobility",
      },
    ],
    items: [
      {
        kind: "combo",
        id: 8001,
        brandSlug: "demo-wellness-club",
        locationSlug: "norte",
        name: "Bono 4 sesiones",
        priceLabel: "$120,000 COP",
      },
      {
        kind: "product",
        id: 8201,
        brandSlug: "demo-wellness-club",
        locationSlug: "norte",
        name: "Botella deportiva",
        priceLabel: "$45,000 COP",
      },
    ],
  },
};

export const conciergePartnerFixtures = {
  fitspin: fitspinConciergeFixture,
  "demo-wellness": demoWellnessConciergeFixture,
} as const;
