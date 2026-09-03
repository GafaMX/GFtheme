import { z } from "zod";

const id = z.string().trim().min(1).max(120);
const safeUrl = z.string().url().max(1000);

export const ConciergeCapabilities = z.object({
  schedule: z.boolean(),
  packages: z.boolean(),
  memberships: z.boolean(),
  account: z.boolean(),
  directReservation: z.boolean(),
  whatsapp: z.boolean(),
});

export const ConciergeTheme = z.object({
  mode: z.enum(["light", "dark"]),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  foreground: z.string().regex(/^#[0-9a-f]{6}$/i),
  icon: z.string().min(1).max(40),
});

export const ConciergeStudio = z.object({
  id,
  name: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  address: z.string().min(1).max(240),
  mapsUrl: safeUrl,
  locationId: id,
  brandSlug: id,
  slug: id,
});

export const ConciergeProduct = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("combo"),
    id,
    brandSlug: id,
    locationId: id,
    name: z.string().min(1).max(160),
    price: z.string().min(1).max(80),
    note: z.string().max(240),
  }),
  z.object({
    type: z.literal("membership"),
    id,
    brandSlug: id,
    locationId: id,
    name: z.string().min(1).max(160),
    price: z.string().min(1).max(80),
    note: z.string().max(240),
  }),
]);

export const ConciergePartnerConfig = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  displayName: z.string().min(1).max(120),
  locale: z.string().min(2).max(20),
  timezone: z.string().min(1).max(80),
  buq: z.object({
    companyId: z.number().int().positive(),
    brands: z
      .array(
        z.object({
          slug: id,
          name: z.string().min(1).max(120),
          locationIds: z.array(id).min(1),
        }),
      )
      .min(1),
  }),
  studios: z.array(ConciergeStudio).default([]),
  catalog: z.object({
    version: z.string().min(1).max(120),
    products: z.array(ConciergeProduct).default([]),
    /** Si es true, el SDK completa sedes/productos desde el cliente BUQ. */
    live: z.boolean().optional(),
  }),
  routes: z.object({
    web: z.object({ home: z.string(), calendar: z.string(), packages: z.string() }),
    webview: z.object({ home: z.string(), calendar: z.string(), packages: z.string() }),
  }),
  contact: z.object({
    whatsapp: z.string().regex(/^[0-9]{8,20}$/),
  }),
  copy: z.object({
    assistantName: z.string().min(1).max(80),
    greeting: z.string().min(1).max(400),
    title: z.string().min(1).max(120),
    subtitle: z.string().max(240),
    fallback: z.string().min(1).max(400),
    scope: z.string().min(1).max(400),
  }),
  capabilities: ConciergeCapabilities,
  theme: ConciergeTheme,
  fallbacks: z.object({
    calendar: z.boolean(),
    packages: z.boolean(),
    account: z.boolean(),
    whatsapp: z.boolean(),
  }),
  security: z.object({
    allowedOrigins: z.array(z.string().url()).max(20),
  }),
});

export const ConciergeHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

export const ConciergeScheduleContextSchema = z.object({
  locationId: id,
  locationName: z.string().max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classes: z
    .array(
      z.object({
        time: z.string().max(40),
        className: z.string().max(160),
        coach: z.string().max(160),
        availableSpots: z.number().int().min(0).nullable(),
        meetingId: z.number().int().positive().optional(),
        brandSlug: id.optional(),
        locationSlug: id.optional(),
      }),
    )
    .max(100),
});

export const ConciergeBody = z.object({
  partnerId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/).optional(),
  message: z.string().trim().min(1).max(2000),
  history: z.array(ConciergeHistoryItemSchema).max(20).default([]),
  scheduleContext: z.array(ConciergeScheduleContextSchema).max(4).optional(),
});

export const ConciergeBuyActionSchema = z.discriminatedUnion("productType", [
  z.object({
    kind: z.literal("buy_package"),
    productType: z.literal("combo"),
    productId: id,
    brandSlug: id,
    locationId: id,
  }),
  z.object({
    kind: z.literal("buy_package"),
    productType: z.literal("membership"),
    productId: id,
    brandSlug: id,
    locationId: id,
  }),
]);

export const ConciergeActionSchema = z.union([
  ConciergeBuyActionSchema,
  z.object({ kind: z.enum(["reservar", "comprar", "cuenta", "whatsapp"]) }),
  z.object({ kind: z.literal("say"), text: z.string().min(1).max(300) }),
]);

export const ConciergeChipSchema = z.object({
  label: z.string().min(1).max(100),
  action: ConciergeActionSchema,
});

export const ConciergeScheduleItemSchema = z.object({
  time: z.string().min(1).max(40),
  className: z.string().min(1).max(160),
  coach: z.string().max(160),
  availableSpots: z.number().int().min(0).nullable(),
  meetingId: z.number().int().positive().optional(),
  brandSlug: id.optional(),
  locationSlug: id.optional(),
});

export const ConciergeCardSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("packages"),
    items: z.array(
      z.object({
        name: z.string(),
        price: z.string(),
        note: z.string(),
        action: ConciergeBuyActionSchema,
      }),
    ),
  }),
  z.object({
    type: z.literal("studios"),
    items: z.array(ConciergeStudio.pick({ name: true, city: true, address: true, mapsUrl: true })),
  }),
  z.object({
    type: z.literal("schedule"),
    locationName: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    locationId: id,
    items: z.array(ConciergeScheduleItemSchema),
  }),
]);

export const ConciergeResponseSchema = z.object({
  version: z.literal("v1"),
  message: z.string().min(1).max(4000),
  chips: z.array(ConciergeChipSchema).max(8).optional(),
  card: ConciergeCardSchema.optional(),
});

export const ConciergeErrorSchema = z.object({
  error: z.string(),
  code: z.enum([
    "invalid_request",
    "partner_not_found",
    "rate_limited",
    "ai_unavailable",
    "upstream_unavailable",
    "internal_error",
  ]),
  requestId: z.string().optional(),
});

export type ConciergePartnerConfig = z.infer<typeof ConciergePartnerConfig>;
export type ConciergeStudio = z.infer<typeof ConciergeStudio>;
export type ConciergeProduct = z.infer<typeof ConciergeProduct>;
export type ConciergeBody = z.infer<typeof ConciergeBody>;
export type ConciergeResponseData = z.infer<typeof ConciergeResponseSchema>;
export type ConciergeCardData = z.infer<typeof ConciergeCardSchema>;
export type ConciergeActionData = z.infer<typeof ConciergeActionSchema>;
export type ConciergeScheduleItem = z.infer<typeof ConciergeScheduleItemSchema>;
export type ConciergeErrorData = z.infer<typeof ConciergeErrorSchema>;
