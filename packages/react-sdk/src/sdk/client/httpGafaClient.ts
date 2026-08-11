import type {
  AuthCredentials,
  Brand,
  CatalogItem,
  CheckoutPayload,
  CreateReservationPayload,
  CreateReservationResult,
  GafaClient,
  Location,
  Meeting,
  MeetingFilters,
  PasswordResetPayload,
  PasswordResetRequestPayload,
  RegisterPayload,
  ReservationCheckoutPayload,
  ReservationContext,
  ReservationPaymentOption,
  SeatMap,
  SeatMapObject,
  Service,
  StaffMember,
  UserCredit,
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
  calendar_days?: number;
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

type RawCustomFieldGroup = {
  id: number;
  name: string;
  description?: string | null;
  active_fields?: Array<{
    id: number;
    name: string;
    type: string;
    validation?: string | null;
    help_text?: string | null;
    default_value?: string | null;
    catalog_field_options?: Array<{ id: number; name: string }>;
  }>;
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
  timezone?: string;
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
      timezone: raw.timezone,
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
      // Igual que el theme legacy: sin only_actives salen sedes de prueba e inactivas.
      const response = await apiGet<PaginatedResponse<RawLocation>>(`/brand/${brandSlug}/location`, {
        only_actives: true,
      });
      const locations = unwrap(response).map((location) => ({
        id: location.id,
        name: location.name,
        slug: location.slug,
        calendarDays: location.calendar_days,
        brandSlug,
      }));
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

    async listRegistrationFields(brandSlug) {
      if (!brandSlug) return [];

      // El "1" es el catalogo de textos especiales; el legacy lo tiene igual de
      // hardcodeado (GafaThemeSDK.renderLoginRegister).
      const raw = await apiGet<RawCustomFieldGroup[]>(`/special-text/form/1/${brandSlug}`, {
        section: "register",
      });

      return (Array.isArray(raw) ? raw : []).map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        fields: (group.active_fields ?? []).map((field) => ({
          id: field.id,
          name: field.name,
          type: field.type,
          required: Boolean(field.validation && field.validation.includes("required")),
          helpText: field.help_text,
          defaultValue: field.default_value,
          options: (field.catalog_field_options ?? []).map((option) => ({ id: option.id, name: option.name })),
        })),
      }));
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

    /**
     * El backend no expone el mapa de salon como JSON: vive dentro del HTML del
     * create-form-template (el mismo que alimenta al fancy legacy). Aqui se pide
     * ese HTML y se parsean sus bloques ocultos (meeting con mapa+ocupados,
     * creditos validos, perfil) para poder pintar un flujo 100% nativo.
     */
    async getReservationContext(payload: ReservationCheckoutPayload): Promise<ReservationContext> {
      if (!token) throw new Error("Necesitas iniciar sesion para reservar.");

      const me = await apiGet<{ id: number }>("/me");
      const userProfileId = me.id;

      const url = new URL(
        `${baseUrl}/api/brand/${payload.brandSlug}/location/${payload.locationSlug}/reservation/create-form-template`,
      );
      url.searchParams.set("meetings_id", String(payload.meetingId));
      url.searchParams.set("users_id", String(userProfileId));

      const response = await fetch(url.toString(), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(`No se pudo cargar la informacion de la reserva (${response.status}).`);
      }
      const htmlText = await response.text();

      const doc = new DOMParser().parseFromString(htmlText, "text/html");
      const readBlock = (name: string): string | null =>
        doc.querySelector(`.CreateReservationFancy--${name}`)?.textContent?.trim() || null;

      const errorList = doc.querySelector("#CreateReservationFancyTemplate--errors ul");
      const meetingRaw = readBlock("meeting");
      if (!meetingRaw) {
        const serverError = errorList?.textContent?.trim();
        throw new Error(serverError || "El servidor no devolvio la informacion de la reserva.");
      }

      const meetingData = JSON.parse(meetingRaw) as {
        id: number;
        map?: {
          id: number;
          name: string;
          rows: number;
          columns: number;
          capacity: number;
          objects?: Array<{
            id: number;
            position_row: number;
            position_column: number;
            width: number;
            height: number;
            position_text?: string | null;
            is_blocked?: boolean;
            positions?: {
              type?: string;
              image?: string | null;
              image_disabled?: string | null;
              image_selected?: string | null;
            };
          }>;
        } | null;
        reservation?: Array<{ maps_objects_id: number }>;
        is_valid_for_waitlist?: boolean;
      };

      const occupied = new Set((meetingData.reservation ?? []).map((r) => r.maps_objects_id));

      let seatMap: SeatMap | null = null;
      if (meetingData.map && Array.isArray(meetingData.map.objects) && meetingData.map.objects.length > 0) {
        const objects: SeatMapObject[] = meetingData.map.objects.map((obj) => ({
          id: obj.id,
          row: obj.position_row,
          column: obj.position_column,
          width: obj.width || 1,
          height: obj.height || 1,
          label: obj.position_text ?? "",
          type: obj.positions?.type ?? "public",
          isBlocked: Boolean(obj.is_blocked),
          isOccupied: occupied.has(obj.id),
          image: obj.positions?.image ?? null,
          imageDisabled: obj.positions?.image_disabled ?? null,
          imageSelected: obj.positions?.image_selected ?? null,
        }));
        seatMap = {
          id: meetingData.map.id,
          name: meetingData.map.name,
          rows: meetingData.map.rows,
          columns: meetingData.map.columns,
          capacity: meetingData.map.capacity,
          objects,
        };
      }

      // Paquetes con credito + membresias que aplican a este meeting. El id de
      // cada opcion replica el formato que el fancy manda en selected_credit:
      // credits--{id}--{exp} / memberships--{id}--{exp}.
      const paymentOptions: ReservationPaymentOption[] = [];

      const creditsRaw = readBlock("user_ValidCredits");
      if (creditsRaw) {
        try {
          const parsed = JSON.parse(creditsRaw) as Array<{
            credits_id: number;
            total: number;
            expiration_date?: string;
            credit?: { id: number; name: string };
            purchase_item?: { item_name?: string | null; buyed?: { name?: string | null } | null } | null;
          }>;
          for (const c of Array.isArray(parsed) ? parsed : []) {
            if (typeof c.total === "number" && c.total <= 0) continue;
            const expiration = (c.expiration_date ?? "").slice(0, 10);
            // Lo que el usuario compro (paquete) por delante; el tipo de credito
            // interno solo como respaldo.
            const packageName =
              c.purchase_item?.buyed?.name || c.purchase_item?.item_name || c.credit?.name || "Paquete";
            paymentOptions.push({
              id: `credits--${c.credits_id}--${expiration}`,
              kind: "credit",
              name: packageName,
              creditName: c.credit?.name,
              remaining: c.total,
              expiresAt: c.expiration_date,
            });
          }
        } catch {
          // sin opciones de credito
        }
      }

      const membershipsRaw = readBlock("user_ValidMembership");
      if (membershipsRaw) {
        try {
          const parsed = JSON.parse(membershipsRaw) as Array<{
            id: number;
            expiration_date?: string;
            membership?: { name?: string };
          }>;
          for (const m of Array.isArray(parsed) ? parsed : []) {
            const expiration = (m.expiration_date ?? "").slice(0, 10);
            paymentOptions.push({
              id: `memberships--${m.id}--${expiration}`,
              kind: "membership",
              name: m.membership?.name ?? "Membresía",
              expiresAt: m.expiration_date,
            });
          }
        } catch {
          // sin membresias
        }
      }

      // Igual que el fancy: lo que expira antes, primero.
      paymentOptions.sort((a, b) => (a.expiresAt ?? "").localeCompare(b.expiresAt ?? ""));

      return {
        meetingId: meetingData.id,
        brandSlug: payload.brandSlug,
        locationSlug: payload.locationSlug,
        userProfileId,
        seatMap,
        paymentOptions,
        waitlistAvailable: Boolean(meetingData.is_valid_for_waitlist),
      };
    },

    /**
     * POST reservate: el mismo endpoint que usa el fancy, con el payload minimo
     * verificado contra produccion. El servidor elige el credito valido solo.
     */
    async createReservation(payload: CreateReservationPayload): Promise<CreateReservationResult> {
      const body: Record<string, string | number | boolean | undefined> = {
        users_id: payload.userProfileId,
        meetings_id: payload.meetingId,
        subscribe: false,
        set_payment: false,
        test: false,
      };
      if (payload.seatObjectId != null) {
        body["map_objectsSelected[0][id]"] = payload.seatObjectId;
      }
      if (payload.selectedCredit) {
        body.selected_credit = payload.selectedCredit;
      }

      const result = await apiPost<{
        reservation?: Array<{ id: number; is_waitlist?: boolean; meeting_position?: number }>;
      }>(`/api/brand/${payload.brandSlug}/location/${payload.locationSlug}/reservation/reservate`, body);

      const first = result.reservation?.[0];
      if (!first) {
        throw new Error("El servidor no confirmo la reserva.");
      }

      return {
        reservationId: first.id,
        isWaitlist: Boolean(first.is_waitlist),
        seatLabel: first.meeting_position != null ? String(first.meeting_position) : undefined,
      };
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
      // gafa.fit espera los campos especiales anidados por grupo y por campo, con
      // un indice de repeticion en medio (siempre 0 mientras no se usen grupos
      // repetibles). Se manda en notacion de corchetes porque el cuerpo es
      // form-urlencoded, no JSON.
      const customFields: Record<string, string> = {};
      Object.entries(payload.customFields ?? {}).forEach(([groupId, fields]) => {
        Object.entries(fields).forEach(([fieldId, value]) => {
          customFields[`custom_fields[${groupId}][0][${fieldId}][0]`] = value;
        });
      });

      // gafa.fit trata /api/register como un OAuth2 password-grant: exige
      // grant_type + client_id + client_secret + scope en el cuerpo (no solo en
      // headers) y el token de reCAPTCHA en AMBOS nombres. Sin esto responde 500.
      return apiPost<{ url?: string }>(`/api/register`, {
        ...customFields,
        grant_type: "password",
        client_id: config.publicClientId,
        client_secret: config.clientSecret,
        scope: "*",
        username: payload.email,
        password: payload.password,
        password_confirmation: payload.passwordConfirmation,
        first_name: payload.firstName,
        last_name: payload.lastName,
        birth_date: payload.birthDate,
        gender: payload.gender,
        tokenmovil: config.tokenMovil ?? "",
        g_recaptcha_response: payload.captchaToken,
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
