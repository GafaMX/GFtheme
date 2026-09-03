import {
  ConciergePartnerConfig as ConciergePartnerConfigSchema,
  type ConciergePartnerConfig,
  type ConciergeProduct,
  type ConciergeStudio,
} from "./contracts";

const fitspinStudios: ConciergeStudio[] = [
  {
    id: "lomas",
    name: "LOMAS",
    city: "CDMX",
    address: "Volcán 150, Lomas de Chapultepec",
    mapsUrl: "https://maps.google.com/?q=Volc%C3%A1n+150+Lomas+de+Chapultepec+CDMX",
    locationId: "122",
    brandSlug: "fitspin",
    slug: "lomas",
  },
  {
    id: "cancun",
    name: "CANCÚN",
    city: "Quintana Roo",
    address: "Marina Town Center, Puerto Cancún",
    mapsUrl: "https://maps.google.com/?q=Marina+Town+Center+Puerto+Canc%C3%BAn",
    locationId: "200",
    brandSlug: "fitspin-cancun",
    slug: "cancun",
  },
  {
    id: "helipuerto",
    name: "HELIPUERTO REFORMA",
    city: "CDMX",
    address: "Reforma 180, Juárez, Cuauhtémoc",
    mapsUrl: "https://maps.google.com/?q=Paseo+de+la+Reforma+180+Ju%C3%A1rez+CDMX",
    locationId: "135",
    brandSlug: "fitspin",
    slug: "helipuerto-reforma",
  },
];

const fitspinProducts: ConciergeProduct[] = [
  { type: "combo", id: "971", brandSlug: "fitspin", locationId: "122", name: "1 CLASE", price: "$330", note: "Expira en 30 días" },
  { type: "combo", id: "972", brandSlug: "fitspin", locationId: "122", name: "3 CLASES", price: "$950", note: "Expira en 45 días" },
  { type: "combo", id: "973", brandSlug: "fitspin", locationId: "122", name: "5 CLASES", price: "$1,500", note: "Expira en 60 días" },
  { type: "combo", id: "974", brandSlug: "fitspin", locationId: "122", name: "10 CLASES", price: "$2,900", note: "Expira en 120 días" },
  { type: "combo", id: "975", brandSlug: "fitspin", locationId: "122", name: "20 CLASES", price: "$5,400", note: "Expira en 180 días" },
  { type: "combo", id: "2878", brandSlug: "fitspin", locationId: "122", name: "CLASE PRUEBA SCULPT", price: "$275", note: "Expira en 30 días" },
  { type: "membership", id: "358", brandSlug: "fitspin", locationId: "122", name: "MEMBRESÍA CDMX", price: "$3,100", note: "Pago recurrente · clases ilimitadas" },
  { type: "membership", id: "670", brandSlug: "fitspin", locationId: "122", name: "MEMBRESÍA PM", price: "$1,699", note: "1 clase diaria PM · lunes a viernes" },
  { type: "combo", id: "1622", brandSlug: "fitspin-cancun", locationId: "200", name: "1 CLASE", price: "$300", note: "Expira en 30 días" },
  { type: "combo", id: "1623", brandSlug: "fitspin-cancun", locationId: "200", name: "3 CLASES", price: "$850", note: "Expira en 45 días" },
  { type: "combo", id: "1624", brandSlug: "fitspin-cancun", locationId: "200", name: "5 CLASES", price: "$1,350", note: "Expira en 60 días" },
  { type: "combo", id: "1625", brandSlug: "fitspin-cancun", locationId: "200", name: "10 CLASES", price: "$2,600", note: "Expira en 120 días" },
  { type: "combo", id: "1626", brandSlug: "fitspin-cancun", locationId: "200", name: "20 CLASES", price: "$4,900", note: "Expira en 180 días" },
  { type: "membership", id: "592", brandSlug: "fitspin-cancun", locationId: "200", name: "MEMBRESÍA CANCÚN", price: "$2,899", note: "Pago recurrente · clases ilimitadas" },
  { type: "membership", id: "690", brandSlug: "fitspin-cancun", locationId: "200", name: "MEMBRESÍA PM", price: "$1,499", note: "1 clase diaria PM · lunes a viernes" },
  { type: "membership", id: "1229", brandSlug: "fitspin-cancun", locationId: "200", name: "MEMBRESÍA AM", price: "$1,899", note: "1 clase diaria AM · lunes a viernes" },
  { type: "combo", id: "1688", brandSlug: "fitspin", locationId: "135", name: "1 CLASE", price: "$500", note: "Bici o fuerza · expira en 60 días" },
  { type: "combo", id: "1689", brandSlug: "fitspin", locationId: "135", name: "3 CLASES", price: "$1,500", note: "Bici o fuerza · expira en 60 días" },
  { type: "combo", id: "1690", brandSlug: "fitspin", locationId: "135", name: "5 CLASES", price: "$2,500", note: "Bici o fuerza · expira en 60 días" },
];

/** Fixture de referencia. No es un registry de producción ni la config por defecto del SDK. */
export const FITSPIN_CONCIERGE_CONFIG: ConciergePartnerConfig = {
  id: "fitspin",
  displayName: "FITSPIN",
  locale: "es-MX",
  timezone: "America/Mexico_City",
  buq: {
    companyId: 80,
    brands: [
      { slug: "fitspin", name: "FITSPIN", locationIds: ["122", "135"] },
      { slug: "fitspin-cancun", name: "FITSPIN CANCÚN", locationIds: ["200"] },
    ],
  },
  studios: fitspinStudios,
  catalog: { version: "fitspin-2026-08", products: fitspinProducts },
  routes: {
    web: { home: "/fitspin", calendar: "/fitspin/reservar", packages: "/fitspin#paquetes" },
    webview: { home: "/fitspin/app", calendar: "/fitspin/app/reservar", packages: "/fitspin/app/comprar" },
  },
  contact: { whatsapp: "5215500000000" },
  copy: {
    assistantName: "Concierge",
    greeting: "¡Hola! 👋 Soy el concierge de FITSPIN. Puedo ayudarte a reservar, comprar clases o resolver tus dudas. ¿Qué necesitas hoy?",
    title: "FITSPIN Concierge",
    subtitle: "Tu asistente personal (beta)",
    fallback: "Puedo ayudarte con clases, paquetes, sedes y reservas.",
    scope: "Solo puedo ayudar con clases, reservas, paquetes, sedes y preguntas de FITSPIN.",
  },
  capabilities: {
    schedule: true,
    packages: true,
    memberships: true,
    account: true,
    directReservation: true,
    whatsapp: true,
  },
  theme: { mode: "light", accent: "#FFD420", foreground: "#0f0f0f", icon: "sparkles" },
  fallbacks: { calendar: true, packages: true, account: true, whatsapp: true },
  security: {
    allowedOrigins: [
      "https://fitspin.mx",
      "https://www.fitspin.mx",
      "https://fitspin.mybuq.app",
    ],
  },
};

/** Fixture deliberadamente distinto: el motor no debe depender de nombres Fitspin. */
export const DEMO_CONCIERGE_CONFIG: ConciergePartnerConfig = {
  id: "demo-studio",
  displayName: "Demo Studio",
  locale: "en-US",
  timezone: "America/New_York",
  buq: { companyId: 999, brands: [{ slug: "demo", name: "Demo", locationIds: ["1"] }] },
  studios: [{
    id: "downtown",
    name: "Downtown",
    city: "New York",
    address: "1 Demo Street",
    mapsUrl: "https://maps.google.com/?q=1+Demo+Street+New+York",
    locationId: "1",
    brandSlug: "demo",
    slug: "downtown",
  }],
  catalog: {
    version: "demo-1",
    products: [{ type: "combo", id: "demo-combo", brandSlug: "demo", locationId: "1", name: "Drop-in", price: "$20", note: "Valid for 30 days" }],
  },
  routes: {
    web: { home: "/demo-studio", calendar: "/demo-studio/calendar", packages: "/demo-studio/packages" },
    webview: { home: "/demo-studio/app", calendar: "/demo-studio/app/calendar", packages: "/demo-studio/app/packages" },
  },
  contact: { whatsapp: "15555555555" },
  copy: {
    assistantName: "Studio guide",
    greeting: "Welcome to Demo Studio.",
    title: "Studio guide",
    subtitle: "Schedules and passes.",
    fallback: "I can help with schedules, passes, locations, and bookings.",
    scope: "I can only help with this studio's schedules, passes, locations, and bookings.",
  },
  capabilities: {
    schedule: true,
    packages: true,
    memberships: false,
    account: true,
    directReservation: false,
    whatsapp: true,
  },
  theme: { mode: "dark", accent: "#8BE9FD", foreground: "#111827", icon: "calendar" },
  fallbacks: { calendar: true, packages: true, account: true, whatsapp: true },
  security: { allowedOrigins: ["https://demo.example.com"] },
};

export const conciergePartnerFixtures = {
  fitspin: FITSPIN_CONCIERGE_CONFIG,
  "demo-studio": DEMO_CONCIERGE_CONFIG,
} as const;

export function getConciergeFixture(partnerId: string): ConciergePartnerConfig | undefined {
  return conciergePartnerFixtures[partnerId as keyof typeof conciergePartnerFixtures];
}

export function parseConciergePartnerConfig(input: unknown): ConciergePartnerConfig {
  return ConciergePartnerConfigSchema.parse(input);
}
