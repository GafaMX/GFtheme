import type {
  AuthCredentials,
  Brand,
  CatalogItem,
  CheckoutPayload,
  GafaClient,
  Location,
  Meeting,
  MeetingFilters,
  PasswordResetPayload,
  PasswordResetRequestPayload,
  RegisterPayload,
  ReservationCheckoutPayload,
  Service,
  StaffMember,
  UserProfile,
  UserReservation,
} from "./types";
import type { GafaSdkConfig } from "../config";
import { clearStoredToken, readStoredToken, writeStoredToken } from "./tokenStorage";

type PaginatedResponse<T> = { data: T[] } | T[];

type RawLocation = {
  id: number;
  name: string;
  slug: string;
};

type RawUserProfile = {
  id: number;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  credits_label?: string;
  picture_web?: string | null;
  store_credit_total?: string;
};

type RawUserCredit = {
  total: number;
  expiration_date?: string;
  credit: { id: number; name: string };
  purchase_item?: { item_name?: string | null } | null;
};

type RawUserMembership = {
  id: number;
  created_at?: string;
  expiration_date?: string;
  membership: { name: string };
};

type RawStaff = { name?: string; lastname?: string; job?: string | null };

type RawReservation = {
  id: number;
  meeting_start: string;
  is_overbooking?: number;
  credit?: { name?: string } | null;
  location?: { name?: string };
  staff?: RawStaff;
  substitute_staff?: RawStaff | null;
  meetings?: {
    service?: { name?: string };
    staff?: RawStaff;
    substitute_staff?: RawStaff | null;
  };
  object?: { position_number?: number; position_text?: string };
};

/** `reservation-future` no devuelve una lista plana: agrupa reservas y waitlist por bloque. */
type RawReservationGroup = {
  reservations?: RawReservation[];
  waitlists?: RawReservation[];
};

type RawPurchase = {
  id: number;
  total: number;
  created_at?: string;
  currency?: { prefijo?: string };
  items?: Array<{ item_name?: string }>;
};

type TokenResponse = {
  access_token: string;
  [key: string]: unknown;
};

type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

class GafaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "GafaApiError";
  }
}

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
  let token: string | null = readStoredToken();

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "GAFAFIT-COMPANY": String(config.companyId),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function parseErrorBody(response: Response): Promise<GafaApiError> {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const firstFieldError = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    const message = firstFieldError ?? body?.message ?? `gafa.fit API ${response.status}`;
    return new GafaApiError(message, response.status, body?.errors);
  }

  async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(`${baseUrl}/api${path}`);
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), { headers: authHeaders() });

    if (!response.ok) {
      throw await parseErrorBody(response);
    }

    return response.json();
  }

  async function apiPost<T>(path: string, body: Record<string, string | number | boolean | undefined>): Promise<T> {
    const form = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined) form.set(key, String(value));
    });

    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });

    if (!response.ok) {
      throw await parseErrorBody(response);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  function normalizeProfile(raw: RawUserProfile): UserProfile {
    return {
      id: raw.id,
      email: raw.email ?? raw.username ?? "",
      name: [raw.first_name, raw.last_name].filter(Boolean).join(" ") || raw.name || raw.email || "",
      creditsLabel: raw.credits_label,
      photoUrl: raw.picture_web ?? undefined,
      storeCreditTotal: raw.store_credit_total,
    };
  }

  function staffLabel(staff?: RawStaff | null): string | undefined {
    if (!staff) return undefined;
    if (staff.job) return staff.job;
    const name = [staff.name, staff.lastname].filter(Boolean).join(" ");
    return name || undefined;
  }

  function normalizeReservation(raw: RawReservation, brandSlug: string, isWaitlist: boolean): UserReservation {
    const staff = raw.meetings?.staff ?? raw.staff;
    const position = raw.object?.position_text ?? raw.object?.position_number;

    return {
      id: raw.id,
      serviceName: raw.meetings?.service?.name ?? "Reserva",
      startsAt: raw.meeting_start,
      locationName: raw.location?.name,
      staffName: staffLabel(staff),
      brandSlug,
      isWaitlist,
      isOverbooking: raw.is_overbooking === 1,
      // El legacy distingue membresia de credito por `credit === null`, no por un campo propio.
      creditName: raw.credit ? (raw.credit.name ?? null) : null,
      waitlistPosition: position !== undefined ? String(position) : undefined,
    };
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
      if (!token) return null;

      try {
        const raw = await apiGet<RawUserProfile>("/me");
        return normalizeProfile(raw);
      } catch (error) {
        if (error instanceof GafaApiError && error.status === 401) return null;
        throw error;
      }
    },

    async listUserCredits(brandSlug) {
      if (!token || !brandSlug) return [];
      const response = await apiGet<PaginatedResponse<RawUserCredit>>(`/me/brand/${brandSlug}/credits`);
      return unwrap(response).map((raw) => ({
        id: raw.credit.id,
        name: raw.purchase_item?.item_name || raw.credit.name,
        total: raw.total,
        expiresAt: raw.expiration_date,
      }));
    },

    async listUserMemberships(brandSlug) {
      if (!token || !brandSlug) return [];
      const response = await apiGet<PaginatedResponse<RawUserMembership>>(`/me/brand/${brandSlug}/memberships`);
      return unwrap(response).map((raw) => ({
        id: raw.id,
        name: raw.membership.name,
        startedAt: raw.created_at,
        expiresAt: raw.expiration_date,
      }));
    },

    async listUserReservations(brandSlug, when = "future") {
      if (!token || !brandSlug) return [];

      const path = when === "past" ? "reservation-past" : "reservation-future";
      const response = await apiGet<PaginatedResponse<RawReservationGroup>>(`/me/brand/${brandSlug}/${path}`, {
        reducePopulation: true,
      });

      return unwrap(response)
        .flatMap((group) => [
          ...(group.reservations ?? []).map((raw) => normalizeReservation(raw, brandSlug, false)),
          ...(group.waitlists ?? []).map((raw) => normalizeReservation(raw, brandSlug, true)),
        ])
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    },

    async listUserPurchases(brandSlug) {
      if (!token || !brandSlug) return [];
      const response = await apiGet<PaginatedResponse<RawPurchase>>(`/me/brand/${brandSlug}/purchases`);
      return unwrap(response).map((raw) => ({
        id: raw.id,
        name: raw.items?.[0]?.item_name ?? "Compra",
        total: raw.total,
        currencyPrefix: raw.currency?.prefijo,
        createdAt: raw.created_at,
      }));
    },

    async cancelReservation(brandSlug, reservationId) {
      await apiPost(`/api/me/brand/${brandSlug}/reservation-future/${reservationId}/cancel`, {});
    },

    async login(credentials: AuthCredentials) {
      if (!config.publicClientId || !config.clientSecret) {
        throw new Error("Falta publicClientId/clientSecret en la config del SDK para hacer login.");
      }

      const data = await apiPost<TokenResponse>("/oauth/token", {
        grant_type: "password",
        client_id: config.publicClientId,
        client_secret: config.clientSecret,
        username: credentials.email,
        password: credentials.password,
        scope: "*",
      });

      token = data.access_token;
      writeStoredToken(token);

      return { access_token: data.access_token };
    },

    logout() {
      token = null;
      clearStoredToken();
    },

    async register(payload: RegisterPayload) {
      return apiPost<{ url?: string }>(`/api/register`, {
        username: payload.email,
        password: payload.password,
        password_confirmation: payload.passwordConfirmation,
        first_name: payload.firstName,
        last_name: payload.lastName,
        birth_date: payload.birthDate,
        gender: payload.gender,
        "g-recaptcha-response": payload.captchaToken,
        captcha_secret_key: config.captchaSecretKey,
        remote_addr: "",
      });
    },

    async requestPasswordReset(payload: PasswordResetRequestPayload) {
      await apiPost(`/api/password/email`, {
        email: payload.email,
        return_url: payload.returnUrl,
      });
    },

    async resetPassword(payload: PasswordResetPayload) {
      await apiPost(`/api/password/reset`, {
        email: payload.email,
        password: payload.password,
        password_confirmation: payload.passwordConfirmation,
        token: payload.token,
      });
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
