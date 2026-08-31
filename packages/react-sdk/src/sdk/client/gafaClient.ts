import type { GafaClient, Meeting, UserProfile } from "./types";
import type { GafaSdkConfig } from "../config";
import { clearStoredToken, writeStoredToken } from "./tokenStorage";

export function createGafaClient(_options: GafaSdkConfig): GafaClient {
  return createMockGafaClient();
}

export function createMockGafaClient(): GafaClient {
  return {
    listBrands: async () => [
      {
        id: 1,
        name: "Demo Studio",
        slug: "demo-studio",
      },
    ],
    listLocations: async () => [
      {
        id: 1,
        name: "Roma Norte",
        slug: "roma-norte",
        brandSlug: "demo-studio",
      },
      {
        id: 2,
        name: "Condesa",
        slug: "condesa",
        brandSlug: "demo-studio",
      },
    ],
    listStaff: async () => [
      {
        id: 1,
        name: "Coach Demo",
        lastname: "Rivera",
        bio: "Entrenador principal",
        slug: "coach-demo",
      },
      {
        id: 2,
        name: "Coach Ana",
        lastname: "Lopez",
        slug: "coach-ana",
      },
    ],
    listServices: async () => [
      {
        id: 1,
        name: "Functional Training",
        durationMinutes: 50,
      },
      {
        id: 2,
        name: "Yoga Flow",
        durationMinutes: 45,
      },
    ],
    listCombos: async () => [
      {
        id: 1,
        name: "10 clases",
        description: "Paquete inicial para reservar en cualquier sede.",
        priceLabel: "$1,200 MXN",
        currency: "MXN",
      },
    ],
    listMemberships: async () => [
      {
        id: 2,
        name: "Mensual ilimitada",
        description: "Membresia para clientes recurrentes.",
        priceLabel: "$2,400 MXN",
        currency: "MXN",
      },
    ],
    listMeetings: async () => demoMeetings(),
    getMeeting: async ({ meetingId }) =>
      demoMeetings().find((meeting) => Number(meeting.id) === Number(meetingId)) ?? null,
    getProfile: async (): Promise<UserProfile | null> => ({
      id: 1,
      name: "Usuario Demo",
      email: "demo@gafa.fit",
      creditsLabel: "5 creditos disponibles",
    }),
    listRegistrationFields: async () => [
      {
        id: 1,
        name: "Informacion adicional",
        fields: [
          { id: 10, name: "Telefono", type: "number", required: true, options: [] },
          {
            id: 11,
            name: "Como nos conociste",
            type: "select",
            required: false,
            options: [
              { id: 1, name: "Redes sociales" },
              { id: 2, name: "Un amigo" },
            ],
          },
        ],
      },
    ],
    listUserCredits: async () => [
      { id: 101, creditTypeId: 1, name: "10 clases", total: 5, expiresAt: inDays(45) },
      { id: 102, creditTypeId: 1, name: "Clase suelta", total: 1, expiresAt: inDays(12) },
    ],
    listUserMemberships: async () => [
      { id: 2, name: "Mensual ilimitada", startedAt: inDays(-15), expiresAt: inDays(15) },
    ],
    listUserReservations: async () => [
      {
        id: 1,
        serviceName: "Functional Training",
        startsAt: inDays(1),
        locationName: "Roma Norte",
        staffName: "Coach Demo",
        brandSlug: "demo-studio",
        isWaitlist: false,
        isOverbooking: false,
        creditId: 1,
        creditTypeName: "CDMX",
        seatLabel: "12",
        qrHash: "demo-qr-hash-1",
        canCancel: true,
      },
      {
        id: 2,
        serviceName: "Yoga Flow",
        startsAt: inDays(3),
        locationName: "Condesa",
        staffName: "Coach Ana",
        brandSlug: "demo-studio",
        isWaitlist: true,
        isOverbooking: false,
        creditId: null,
        creditTypeName: null,
        waitlistPosition: "2",
        canCancel: true,
      },
    ],
    listUserPurchases: async () => [
      { id: 1, name: "10 clases", total: 1200, currencyPrefix: "$", createdAt: inDays(-20), status: "Completada" },
    ],
    cancelReservation: async () => undefined,
    cancelWaitlist: async () => undefined,
    getUserActivityTotals: async () => ({
      reservedCount: 12,
      attendedCount: 9,
      noShowCount: 1,
      cancelledCount: 2,
      attendedMinutes: 450,
      favoriteStaff: ["Coach Demo"],
      favoriteSchedules: ["06:00"],
    }),
    updateProfile: async (payload) => ({
      id: 1,
      name: [payload.firstName, payload.lastName].filter(Boolean).join(" ") || "Usuario Demo",
      email: payload.email || "demo@gafa.fit",
      firstName: payload.firstName,
      lastName: payload.lastName,
      storeCreditTotal: "0",
    }),
    // El cliente real guarda el token al loguearse; el mock tiene que hacer lo
    // mismo o la demo pide login de nuevo en cada flujo que consulta la sesion.
    login: async () => {
      writeStoredToken("demo-token");
      return { access_token: "demo-token" };
    },
    logout: () => clearStoredToken(),
    register: async () => ({ url: undefined }),
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
    openCheckout: async () => undefined,
    openReservationCheckout: async () => undefined,
    getCheckoutConfig: async () => ({
      brandSlug: "demo",
      locationSlug: "roma-norte",
      currency: { prefix: "$", suffix: "MXN", code: "MXN" },
      paymentMethods: [
        { id: 6, name: "Stripe", slug: "stripe", gafapayId: 4, order: 0 },
        { id: 3, name: "PayPal", slug: "paypal", gafapayId: 2, order: 1 },
      ],
      termsConditionsLink: "https://example.com/terminos",
      giftCardsEnabled: true,
      discountCodesEnabled: true,
      canRedeemStoreCredit: false,
      combos: [
        {
          id: 1,
          name: "1 clase",
          price: 330,
          priceFinal: 330,
          priceLabel: "$330",
          type: "combo",
          expirationDays: 30,
          description: "Aplica solo para clases en estudio.",
        },
        {
          id: 2,
          name: "5 clases",
          price: 1400,
          priceFinal: 1400,
          priceLabel: "$1,400",
          type: "combo",
          expirationDays: 60,
        },
      ],
      memberships: [
        {
          id: 3,
          name: "Mensual ilimitada",
          price: 2400,
          priceFinal: 2400,
          priceLabel: "$2,400",
          type: "membership",
          expirationDays: 30,
          subscribable: true,
        },
      ],
      products: [
        { id: 9, name: "Agua", price: 40, priceFinal: 40, priceLabel: "$40", type: "product" },
      ],
      companiesId: 1,
      locationId: 1,
      userProfileId: 1,
      usersId: 1,
      urls: {
        reservation: "/demo/reservate",
        initialPurchase: "/demo/initial-purchase",
        initialPurchaseStatus: "/demo/initial-purchase-status",
        checkDiscountCode: "/demo/check-discount",
        checkGiftCode: "/demo/check-gift",
        generateGiftCode: "/demo/generate-gift",
      },
    }),
    checkDiscountCode: async ({ code }) => ({ valid: code.length > 2, code, discountAmount: 50, label: "Promo demo" }),
    checkGiftCode: async ({ code }) => {
      const compact = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (compact.includes("TAKEN")) {
        return {
          valid: true,
          code: compact,
          balance: 200,
          label: "Gift demo",
          httpStatus: 200,
          raw: { id: 1, code: compact, balance: 200, name: "Gift demo" },
        };
      }
      return { valid: false, code: compact, httpStatus: 404, message: "Gift card not found" };
    },
    generateGiftCode: async () => "K7M2P9QX",
    reservatePurchase: async () => ({ purchaseId: 1 }),
    initialPurchase: async () => ({ purchaseId: 1, checkoutToken: "demo" }),
    pollInitialPurchaseStatus: async () => ({ code: 1, reservationId: 99 }),
    getReservationContext: async ({ meetingId, brandSlug, locationSlug }) => {
      const meeting = demoMeetings().find((item) => Number(item.id) === Number(meetingId));
      const waitlist = Boolean(meeting && (meeting.available ?? 1) <= 0);
      const seatMap = {
        id: 9,
        name: "Salón demo",
        rows: 4,
        columns: 6,
        capacity: waitlist ? 14 : 18,
        objects: [
          {
            id: 1,
            row: 1,
            column: 1,
            width: 1,
            height: 1,
            label: "1",
            type: "public",
            isBlocked: false,
            isOccupied: Boolean(waitlist),
          },
        ],
      };
      return {
        meetingId: Number(meetingId),
        brandSlug: brandSlug ?? meeting?.brandSlug ?? "demo-studio",
        locationSlug: locationSlug ?? meeting?.location?.slug ?? "roma-norte",
        userProfileId: 1,
        seatMap,
        paymentOptions: waitlist
          ? []
          : [{ id: "credits--1--2099-01-01", kind: "credit" as const, name: "10 clases", remaining: 5 }],
        waitlistAvailable: waitlist,
      };
    },
    createReservation: async ({ meetingId }) => {
      const meeting = demoMeetings().find((item) => Number(item.id) === Number(meetingId));
      return {
        reservationId: 99,
        isWaitlist: Boolean(meeting && (meeting.available ?? 1) <= 0),
      };
    },
  };
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function demoMeetings(): Meeting[] {
  const now = new Date();
  const first = new Date(now);
  first.setHours(8, 0, 0, 0);

  const second = new Date(now);
  second.setHours(18, 30, 0, 0);

  return [
    {
      id: 1,
      name: "Functional Training",
      brandSlug: "demo-studio",
      startsAt: first.toISOString(),
      durationMinutes: 50,
      staffName: "Coach Demo",
      serviceName: "Training",
      description:
        "Trae toalla y zapatos de indoor. Esta clase es de alta intensidad — si es tu primera vez, avísale al coach.",
      availability: "available",
      available: 8,
      capacity: 18,
      isReserved: false,
      hasSeatMap: true,
      location: {
        id: 1,
        name: "Roma Norte",
        slug: "roma-norte",
      },
    },
    {
      id: 2,
      name: "Mobility Flow",
      brandSlug: "demo-studio",
      startsAt: second.toISOString(),
      durationMinutes: 45,
      staffName: "Coach Ana",
      serviceName: "Wellness",
      availability: "waitlist",
      available: 0,
      capacity: 14,
      waitlistAvailable: true,
      isReserved: false,
      hasSeatMap: true,
      location: {
        id: 2,
        name: "Condesa",
        slug: "condesa",
      },
    },
  ];
}
