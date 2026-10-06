import type { GafaSdkConfig } from "../config";
import type {
  Brand,
  CatalogItem,
  GafaClient,
  Location,
  Meeting,
  MeetingFilters,
  MeetingLookup,
  Service,
  StaffMember,
} from "./types";
import type { BuqNextCatalogoSede } from "./buqNextContract";
import { NEXT_STUDIO_FIXTURES } from "./buqNextFixtures";
import {
  classStartsAt,
  indexBuqNextIds,
  meetingInRange,
  ofertaToCatalogItem,
} from "./buqNextMap";
import { buqNextUnavailable } from "./buqNextUnavailable";

export type BuqNextClientOptions = {
  fixtures?: BuqNextCatalogoSede;
  now?: Date;
};

function staffName(coach: BuqNextCatalogoSede["coaches"][number]): string {
  return [coach.apodo || coach.nombre, coach.apellido].filter(Boolean).join(" ").trim();
}

/**
 * GafaClient sobre el contrato de Buq Next. F0' lee fixtures locales
 * (calendario por sede, catálogo, coaches, salones). Login, derechos,
 * reservar, comprar, store credit y puntos aún no existen: tiran
 * `BuqNextUnavailableError`.
 */
export function createBuqNextClient(
  _config?: Pick<GafaSdkConfig, "companyId" | "apiBaseUrl"> | GafaSdkConfig,
  options: BuqNextClientOptions = {},
): GafaClient {
  const fixtures = options.fixtures ?? NEXT_STUDIO_FIXTURES;
  const now = options.now;
  const ids = indexBuqNextIds(fixtures);

  const brand: Brand = {
    id: fixtures.marca.numericId,
    name: fixtures.marca.nombre,
    slug: fixtures.marca.slug,
    logoUrl: fixtures.marca.logoUrl,
    timeZone: fixtures.marca.zonaHoraria,
    currency: { prefix: "$", suffix: "MXN", code: "MXN" },
  };

  const location: Location = {
    id: fixtures.sede.numericId,
    name: fixtures.sede.nombre,
    slug: fixtures.sede.slug,
    brandSlug: brand.slug,
    brand,
    calendarDays: fixtures.sede.diasCalendario,
  };

  const services: Service[] = fixtures.servicios.map((servicio) => ({
    id: servicio.numericId,
    name: servicio.nombre,
    description: servicio.descripcion,
    durationMinutes: servicio.duracionMinutos,
  }));

  const staff: StaffMember[] = fixtures.coaches.map((coach) => ({
    id: coach.numericId,
    name: coach.nombre,
    lastname: coach.apellido,
    apodo: coach.apodo,
    bio: coach.bio,
    photoUrl: coach.fotoUrl,
  }));

  const serviceByUuid = new Map(fixtures.servicios.map((item) => [item.id, item]));
  const coachByUuid = new Map(fixtures.coaches.map((item) => [item.id, item]));
  const salonByUuid = new Map(fixtures.salones.map((item) => [item.id, item]));

  function meetings(): Meeting[] {
    return fixtures.clases.map((clase) => {
      const servicio = serviceByUuid.get(clase.servicioId);
      const coach = coachByUuid.get(clase.coachId);
      const salon = salonByUuid.get(clase.salonId);
      const available = Math.max(0, clase.cupo - clase.reservados);
      const service = servicio
        ? {
            id: servicio.numericId,
            name: servicio.nombre,
            description: servicio.descripcion,
            durationMinutes: servicio.duracionMinutos,
          }
        : undefined;
      const staffMember = coach
        ? {
            id: coach.numericId,
            name: coach.nombre,
            lastname: coach.apellido,
            apodo: coach.apodo,
            bio: coach.bio,
            photoUrl: coach.fotoUrl,
          }
        : undefined;
      return {
        id: clase.numericId,
        name: servicio?.nombre ?? "Clase",
        brandSlug: brand.slug,
        startsAt: classStartsAt(clase.diasDesdeHoy, clase.hora, now),
        timezone: clase.zonaHoraria,
        durationMinutes: servicio?.duracionMinutos,
        description: clase.nota,
        service,
        serviceId: service?.id,
        serviceName: service?.name,
        staff: staffMember,
        staffId: staffMember?.id,
        staffName: coach ? staffName(coach) : undefined,
        location,
        locationSlug: location.slug,
        available,
        capacity: salon?.capacidad ?? clase.cupo,
        hasSeatMap: salon?.tieneMapa,
        waitlistAvailable: clase.listaEspera,
        availability:
          available <= 0 ? (clase.listaEspera ? "waitlist" : "sold-out") : "available",
      } satisfies Meeting;
    });
  }

  function ofertasDe(tipo: BuqNextCatalogoSede["ofertas"][number]["tipo"]): CatalogItem[] {
    return fixtures.ofertas.filter((oferta) => oferta.tipo === tipo).map(ofertaToCatalogItem);
  }

  const client: GafaClient = {
    async listBrands() {
      return [brand];
    },

    async listLocations(brandSlug) {
      if (brandSlug && brandSlug !== brand.slug) return [];
      return [location];
    },

    async listServices(brandSlug) {
      if (brandSlug && brandSlug !== brand.slug) return [];
      return services;
    },

    async listStaff(brandSlug) {
      if (brandSlug && brandSlug !== brand.slug) return [];
      return staff;
    },

    async listMeetings(filters: MeetingFilters = {}) {
      if (filters.locationId != null && Number(filters.locationId) !== location.id) {
        return [];
      }
      const from = filters.from ?? filters.startDate;
      const to = filters.to ?? filters.endDate;
      return meetings().filter((meeting) => {
        if (!meetingInRange(meeting.startsAt, from, to)) return false;
        if (filters.serviceId != null && Number(meeting.serviceId) !== Number(filters.serviceId)) {
          return false;
        }
        if (filters.staffId != null && Number(meeting.staffId) !== Number(filters.staffId)) {
          return false;
        }
        if (filters.roomId != null) {
          const clase = fixtures.clases.find((item) => item.numericId === meeting.id);
          const salonId = clase ? ids.numericByUuid.get(clase.salonId) : undefined;
          if (salonId == null || salonId !== Number(filters.roomId)) return false;
        }
        return true;
      });
    },

    async getMeeting(payload: MeetingLookup) {
      const meetingId = Number(payload.meetingId);
      if (!Number.isFinite(meetingId)) return null;
      if (payload.brandSlug && payload.brandSlug !== brand.slug) return null;
      if (payload.locationSlug && payload.locationSlug !== location.slug) return null;
      if (payload.locationId != null && Number(payload.locationId) !== location.id) return null;
      return meetings().find((meeting) => meeting.id === meetingId) ?? null;
    },

    async listCombos(brandSlug) {
      if (brandSlug && brandSlug !== brand.slug) return [];
      return ofertasDe("paquete");
    },

    async listMemberships(brandSlug) {
      if (brandSlug && brandSlug !== brand.slug) return [];
      return ofertasDe("membresia");
    },

    async listProducts(brandSlug) {
      if (brandSlug && brandSlug !== brand.slug) return [];
      return ofertasDe("producto");
    },

    getProfile: async () => buqNextUnavailable("getProfile"),
    listRegistrationFields: async () => buqNextUnavailable("listRegistrationFields"),
    listUserCredits: async () => buqNextUnavailable("listUserCredits"),
    listUserMemberships: async () => buqNextUnavailable("listUserMemberships"),
    listUserReservations: async () => buqNextUnavailable("listUserReservations"),
    listUserPurchases: async () => buqNextUnavailable("listUserPurchases"),
    cancelReservation: async () => buqNextUnavailable("cancelReservation"),
    cancelWaitlist: async () => buqNextUnavailable("cancelWaitlist"),
    getUserActivityTotals: async () => buqNextUnavailable("getUserActivityTotals"),
    updateProfile: async () => buqNextUnavailable("updateProfile"),
    getReservationContext: async () => buqNextUnavailable("getReservationContext"),
    createReservation: async () => buqNextUnavailable("createReservation"),
    getCheckoutConfig: async () => buqNextUnavailable("getCheckoutConfig"),
    checkDiscountCode: async () => buqNextUnavailable("checkDiscountCode"),
    checkGiftCode: async () => buqNextUnavailable("checkGiftCode"),
    generateGiftCode: async () => buqNextUnavailable("generateGiftCode"),
    reservatePurchase: async () => buqNextUnavailable("reservatePurchase"),
    previewPurchase: async () => buqNextUnavailable("previewPurchase"),
    initialPurchase: async () => buqNextUnavailable("initialPurchase"),
    pollInitialPurchaseStatus: async () => buqNextUnavailable("pollInitialPurchaseStatus"),
    login: async () => buqNextUnavailable("login"),
    logout() {
      // Sin sesión nativa aún: no-op para que "Cerrar sesión" no tumbe el widget.
    },
    register: async () => buqNextUnavailable("register"),
    requestPasswordReset: async () => buqNextUnavailable("requestPasswordReset"),
    resetPassword: async () => buqNextUnavailable("resetPassword"),
    openCheckout: async () => buqNextUnavailable("openCheckout"),
    openReservationCheckout: async () => buqNextUnavailable("openReservationCheckout"),
  };

  return client;
}
