import type {
  AuthCredentials,
  Brand,
  CatalogItem,
  CheckoutPayload,
  GafaClient,
  Location,
  Meeting,
  MeetingFilters,
  ReservationCheckoutPayload,
  Service,
  StaffMember,
  UserProfile,
} from "./types";
import type { GafaSdkConfig } from "../config";

type PaginatedResponse<T> = { data: T[] } | T[];

type RawLocation = {
  id: number;
  name: string;
  slug: string;
};

type RawMeeting = {
  id: number;
  start?: string;
  start_date?: string;
  end?: string;
  end_date?: string;
  type?: string;
  title?: string;
  available?: number;
  capacity?: number;
  is_reserved?: number | boolean;
  passed?: boolean;
  service?: { id: number; name: string };
  staff?: { id: number; name: string; lastname?: string; description?: string; job?: string; picture_web?: string | null };
  room?: { id: number; name: string };
  location?: { id: number; name: string };
};

/**
 * Cliente HTTP directo a la API publica de gafa.fit (routes/api.php), sin depender del
 * script legacy window.GafaFitSDK. Cubre solo lectura de catalogo (brand/location/staff/
 * service/meetings/combos/membership), que no requieren OAuth: basta el header
 * GAFAFIT-COMPANY. Login y checkout siguen sin implementarse aqui (ver `legacy` fallback).
 */
export function createHttpGafaClient(config: GafaSdkConfig, legacy?: GafaClient): GafaClient {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, "");
  // La API anida location/meetings bajo brand/{slug}; el widget solo conoce el locationId,
  // asi que recordamos la location completa (con su slug y brand) cuando se listan.
  const locationById = new Map<number, Location>();

  async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(`${baseUrl}/api${path}`);
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "GAFAFIT-COMPANY": String(config.companyId),
      },
    });

    if (!response.ok) {
      throw new Error(`gafa.fit API ${response.status} on ${url.pathname}`);
    }

    return response.json();
  }

  function unwrap<T>(response: PaginatedResponse<T>): T[] {
    return Array.isArray(response) ? response : response.data;
  }

  function normalizeMeeting(raw: RawMeeting, brandSlug: string, location?: Location): Meeting {
    return {
      id: raw.id,
      name: raw.service?.name ?? raw.type ?? "Clase",
      startsAt: raw.start ?? raw.start_date ?? "",
      endsAt: raw.end ?? raw.end_date,
      brandSlug,
      service: raw.service,
      serviceId: raw.service?.id,
      serviceName: raw.service?.name,
      staff: raw.staff
        ? {
            id: raw.staff.id,
            name: raw.staff.name,
            lastname: raw.staff.lastname,
            bio: raw.staff.description ?? raw.staff.job,
            photoUrl: raw.staff.picture_web ?? undefined,
          }
        : undefined,
      staffId: raw.staff?.id,
      staffName: raw.staff ? [raw.staff.name, raw.staff.lastname].filter(Boolean).join(" ") : undefined,
      location,
      locationSlug: location?.slug,
      available: raw.available,
      capacity: raw.capacity,
      isReserved: Boolean(raw.is_reserved),
      passed: raw.passed,
    };
  }

  const httpClient: GafaClient = {
    async listBrands() {
      const response = await apiGet<PaginatedResponse<Brand>>("/brand");
      return unwrap(response);
    },

    async listLocations(brandSlug) {
      if (!brandSlug) return [];
      const response = await apiGet<PaginatedResponse<RawLocation>>(`/brand/${brandSlug}/location`);
      const locations = unwrap(response).map((location) => ({ ...location, brandSlug }));
      locations.forEach((location) => locationById.set(location.id, location));
      return locations;
    },

    async listStaff(brandSlug) {
      if (!brandSlug) return [];
      const response = await apiGet<PaginatedResponse<StaffMember>>(`/brand/${brandSlug}/staff`);
      return unwrap(response);
    },

    async listServices(brandSlug) {
      if (!brandSlug) return [];
      const response = await apiGet<PaginatedResponse<Service>>(`/brand/${brandSlug}/service`);
      return unwrap(response);
    },

    async listCombos(brandSlug) {
      const response = await apiGet<PaginatedResponse<CatalogItem>>(`/brand/${brandSlug}/combos`, {
        only_actives: true,
      });
      return unwrap(response).map((item) => ({ ...item, type: "combo" as const }));
    },

    async listMemberships(brandSlug) {
      const response = await apiGet<PaginatedResponse<CatalogItem>>(`/brand/${brandSlug}/membership`, {
        only_actives: true,
      });
      return unwrap(response).map((item) => ({ ...item, type: "membership" as const }));
    },

    async listMeetings(filters: MeetingFilters = {}) {
      if (!filters.locationId) return [];

      const locationId = Number(filters.locationId);
      const location = locationById.get(locationId);
      const brandSlug = location?.brandSlug;

      if (!brandSlug) {
        throw new Error(
          `No se conoce la marca de la ubicacion ${locationId}. Llama listLocations(brandSlug) antes de listMeetings.`,
        );
      }

      const start = filters.from ?? filters.startDate ?? new Date().toISOString().slice(0, 10);
      const defaultEnd = new Date(start);
      defaultEnd.setDate(defaultEnd.getDate() + 14);
      const end = filters.to ?? filters.endDate ?? defaultEnd.toISOString().slice(0, 10);

      const raw = await apiGet<RawMeeting[]>(`/brand/${brandSlug}/location/${locationId}/meetings`, {
        start,
        end,
        only_actives: true,
        reducePopulation: true,
      });

      return raw
        .filter((meeting) => (filters.serviceId ? meeting.service?.id === Number(filters.serviceId) : true))
        .filter((meeting) => (filters.staffId ? meeting.staff?.id === Number(filters.staffId) : true))
        .map((meeting) => normalizeMeeting(meeting, brandSlug, location));
    },

    async getProfile(): Promise<UserProfile | null> {
      return legacy ? legacy.getProfile() : null;
    },

    async login(credentials: AuthCredentials) {
      if (!legacy) {
        throw new Error("Login aun no esta implementado en el cliente HTTP nuevo.");
      }
      return legacy.login(credentials);
    },

    async openCheckout(payload: CheckoutPayload) {
      if (!legacy) {
        throw new Error("Checkout aun no esta implementado en el cliente HTTP nuevo.");
      }
      return legacy.openCheckout(payload);
    },

    async openReservationCheckout(payload: ReservationCheckoutPayload) {
      if (!legacy) {
        throw new Error("El checkout de reserva aun no esta implementado en el cliente HTTP nuevo.");
      }
      return legacy.openReservationCheckout(payload);
    },
  };

  return httpClient;
}
