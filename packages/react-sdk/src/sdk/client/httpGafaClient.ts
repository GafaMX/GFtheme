import type {
  AuthCredentials,
  Brand,
  CartLineType,
  CatalogItem,
  CheckoutConfig,
  CheckoutPayload,
  CreateReservationPayload,
  CustomFieldValues,
  CreateReservationResult,
  FrontPaymentMethod,
  GafaClient,
  GiftCodeResult,
  InitialPurchasePayload,
  InitialPurchaseResult,
  InitialPurchaseStatus,
  Location,
  Meeting,
  MeetingFilters,
  MeetingLookup,
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
  UserMembership,
  UserProfile,
  UserPurchase,
  UserReservation,
  UserActivityTotals,
  UpdateProfilePayload,
} from "./types";
import type { GafaSdkConfig } from "../config";
import { buildCheckDiscountUrl, parseDiscountCheckResponse } from "../cart/discountCode";
import { partitionGafaFitCart } from "../cart/gafaFitCart";
import { toFormBody } from "./formBody";
import {
  clearStoredToken,
  readStoredToken,
  subscribeToAuthChanges,
  writeStoredToken,
} from "./tokenStorage";

type PaginatedResponse<T> = { data: T[] } | T[];

type RawLocation = {
  id: number;
  name: string;
  slug: string;
  calendar_days?: number;
};

type RawBrand = {
  id: number;
  name: string;
  slug: string;
  /** Fitspin vende Cancún (UTC-5) desde una marca con horario propio. */
  time_zone?: string | null;
  terms_conditions_link?: string | null;
  gafapay_brand_id?: number | null;
  gafapay_client_id?: string | number | null;
  gafapay_client_secret?: string | null;
};

type RawCatalogItem = {
  id: number;
  name: string;
  description?: string | null;
  short_description?: string | null;
  price?: number | string | null;
  price_final?: number | string | null;
  has_discount?: boolean;
  expiration_days?: number | null;
  credits?: number | null;
  subscribable?: boolean | number | null;
  hide_in_front?: boolean | number | null;
  currency?: string;
};

type RawUserProfile = {
  id: number;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  birth_date?: string | null;
  gender?: string | null;
  phone?: string | null;
  cel_phone?: string | null;
  address?: string | null;
  external_number?: string | null;
  internal_number?: string | null;
  postal_code?: string | null;
  municipality?: string | null;
  city?: string | null;
  credits_label?: string;
  picture_web?: string | null;
  picture?: string | null;
  store_credit_total?: string | number | null;
  created_at?: string;
  /**
   * Valores de campos especiales. gafa.fit no los documenta ni los devuelve de
   * forma estable en `/me` (a hoy no llegan): se leen defensivamente en las dos
   * formas plausibles y, si no vienen, los campos se pintan vacios.
   */
  custom_fields?: unknown;
  catalog_values?: unknown;
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
  timezone?: string | null;
  hash_qr?: string | null;
  cancelled?: boolean;
  canBeCancelled?: boolean;
  canBeCancelledWithoutCredit?: boolean;
  is_overbooking?: number;
  meeting_position?: number | string | null;
  credit?: { id?: number; name?: string } | null;
  location?: { name?: string } | string | null;
  brand?: { slug?: string } | string | null;
  staff?: RawStaff;
  substitute_staff?: RawStaff | null;
  service?: { name?: string } | null;
  meetings?: {
    service?: { name?: string };
    staff?: RawStaff;
    substitute_staff?: RawStaff | null;
  };
  object?: { position_number?: number; position_text?: string };
};

/** `reservation-future` a veces viene como un solo grupo `{reservations,waitlists}`
 *  y a veces como array de grupos / paginado. */
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
  location?: { name?: string } | string | null;
  status?: string | { name?: string } | null;
  payment_type?: string | null;
  paymentType?: string | null;
};

type RawUserTotals = {
  reservations_without_cancelled_count?: number;
  attended_count?: number;
  no_show_count?: number;
  cancelled_count?: number;
  attended_minutes?: number;
  favorite_staff?: Array<string | { name?: string; job?: string }>;
  favorite_schedules?: Array<string | { name?: string; label?: string }>;
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

type TokenResponse = {
  access_token: string;
  [key: string]: unknown;
};

type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

/**
 * Cuerpo de `BuySystemStep.sendForm` / `sendInitialPurchaseForm` del fancy v1.
 * Stripe cobra y otorga créditos en `reservate` (`paymentByCard` / `paymentByToken`);
 * `initial-purchase` es solo Recurrente.
 */
function buildPurchaseFormBody(payload: InitialPurchasePayload): Record<string, unknown> {
  const partitioned = partitionGafaFitCart(payload.lines);
  const body: Record<string, unknown> = {
    _token: payload.csrfToken ?? "",
    users_id: payload.userId,
    meetings_id: payload.meetingId ?? "",
    meeting_data: "",
    payment_types_id: payload.paymentTypeId,
    discountCode: payload.discountCode ?? "",
    giftCode: payload.giftCode ?? "",
    selected_credit: payload.selectedCredit ?? "",
    invited_data: "",
    signature: "",
    subscriptionId: payload.subscriptionId ?? "",
    subscribe: payload.subscribe ? "true" : "false",
    set_payment: payload.setPayment ? "true" : "false",
    test: "false",
    combos_id: partitioned.combosId,
    combos_amounts: partitioned.combosAmounts,
    memberships_id: partitioned.membershipsId,
    memberships_amounts: partitioned.membershipsAmounts,
    products_id: partitioned.productsId,
    products_amounts: partitioned.productsAmounts,
    cart: partitioned.cart,
    combo: partitioned.combo,
    membership: partitioned.membership,
    product: partitioned.product,
    pending_purchase_id: "",
  };

  if (payload.checkoutToken) {
    body.checkout_token = payload.checkoutToken;
  }
  if (payload.seatObjectId != null) {
    body.map_objectsSelected = [{ id: payload.seatObjectId }];
  }
  if (payload.paymentData != null) {
    body.payment_data = payload.paymentData;
  }
  return body;
}

function readNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parsePurchaseResult(data: Record<string, unknown> | null | undefined): InitialPurchaseResult {
  const purchase = data?.purchase;
  const purchaseId =
    readNumericId(data?.purchase_id) ??
    readNumericId(purchase) ??
    (purchase && typeof purchase === "object" ? readNumericId((purchase as { id?: unknown }).id) : null);

  const reservation = data?.reservation;
  const first = Array.isArray(reservation) ? reservation[0] : reservation;
  const reservationId =
    first && typeof first === "object" ? readNumericId((first as { id?: unknown }).id) : readNumericId(first);

  return {
    purchaseId,
    checkoutToken: typeof data?.checkout_token === "string" ? data.checkout_token : null,
    reservationId: reservationId ?? undefined,
    raw: data,
  };
}

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

/** El API responde en ingles (o en español muy largo); al usuario se le
    muestran mensajes cortos en español que caben en una linea en movil. */
const API_MESSAGE_TRANSLATIONS: Record<string, string> = {
  "The user credentials were incorrect.": "Correo o contraseña incorrectos.",
  "Estas credenciales no coinciden con nuestros registros.": "Correo o contraseña incorrectos.",
  "El email no concuerda con nuestros registros.": "Este correo no está registrado.",
  "El password no concuerda con nuestros registros.": "La contraseña es incorrecta.",
  "The given data was invalid.": "Revisa los datos ingresados.",
  "The email has already been taken.": "Ese correo ya está registrado.",
  "The email must be a valid email address.": "Escribe un correo válido.",
  "The password confirmation does not match.": "Las contraseñas no coinciden.",
  "Too Many Attempts.": "Demasiados intentos, espera un poco.",
  "Unauthenticated.": "Tu sesión expiró, entra de nuevo.",
  "Server Error": "Error del servidor, inténtalo de nuevo.",
};

function translateApiMessage(message: string): string {
  return API_MESSAGE_TRANSLATIONS[message.trim()] ?? message;
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
  // Las reservas se pintan en la hora de la SEDE, no en la del navegador: una
  // clase de Cancún (UTC-5) vista desde CDMX salía una hora antes.
  const brandTimeZoneBySlug = new Map<string, string>();
  // Cache en memoria para no desencriptar en cada request, pero SIEMPRE se
  // resincroniza con localStorage: el login puede ocurrir en otra instancia del
  // cliente (otro mount / otro widget root) y dejar esta copia vieja en null.
  // Si eso pasa, getProfile() devolvia null, el calendario borraba el token
  // recien escrito y el siguiente clic pedia login otra vez con "Mi cuenta" en verde.
  let token: string | null = readStoredToken();

  function syncTokenFromStorage(): string | null {
    token = readStoredToken();
    return token;
  }

  if (typeof window !== "undefined") {
    subscribeToAuthChanges(() => {
      syncTokenFromStorage();
    });
  }

  function authHeaders(): Record<string, string> {
    syncTokenFromStorage();
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
    return new GafaApiError(translateApiMessage(message), response.status, body?.errors);
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
    const store =
      raw.store_credit_total == null || raw.store_credit_total === ""
        ? undefined
        : String(raw.store_credit_total);

    return {
      id: raw.id,
      email: raw.email ?? raw.username ?? "",
      firstName: raw.first_name,
      lastName: raw.last_name,
      name: [raw.first_name, raw.last_name].filter(Boolean).join(" ") || raw.name || raw.email || "",
      birthDate: raw.birth_date,
      gender: raw.gender,
      phone: raw.phone ?? raw.cel_phone,
      address: raw.address,
      externalNumber: raw.external_number,
      internalNumber: raw.internal_number,
      postalCode: raw.postal_code,
      municipality: raw.municipality,
      city: raw.city,
      creditsLabel: raw.credits_label,
      photoUrl: raw.picture_web ?? raw.picture ?? undefined,
      storeCreditTotal: store,
      memberSince: raw.created_at,
      customFields: readCustomFieldValues(raw),
    };
  }

  /**
   * Los valores de campos especiales pueden llegar como mapa anidado
   * (`{grupo: {campo: valor}}`) o como lista de filas de la tabla de catalogos.
   * Cualquier otra forma se ignora en silencio: es preferible pintar el campo
   * vacio que inventar un valor.
   */
  function readCustomFieldValues(raw: RawUserProfile): CustomFieldValues | undefined {
    const source = raw.custom_fields ?? raw.catalog_values;
    if (!source || typeof source !== "object") return undefined;

    const values: CustomFieldValues = {};

    const put = (groupId: unknown, fieldId: unknown, value: unknown) => {
      if (groupId == null || fieldId == null || value == null) return;
      const group = String(groupId);
      values[group] = { ...(values[group] ?? {}), [String(fieldId)]: String(value) };
    };

    if (Array.isArray(source)) {
      source.forEach((row) => {
        if (!row || typeof row !== "object") return;
        const entry = row as Record<string, unknown>;
        put(
          entry.catalogs_groups_id ?? entry.group_id ?? entry.groups_id,
          entry.catalogs_fields_id ?? entry.fields_id ?? entry.field_id,
          entry.value ?? entry.text ?? entry.name,
        );
      });
    } else {
      Object.entries(source as Record<string, unknown>).forEach(([groupId, fields]) => {
        if (!fields || typeof fields !== "object") return;
        Object.entries(fields as Record<string, unknown>).forEach(([fieldId, value]: [string, unknown]) => {
          // `custom_fields[grupo][0][campo][0]` en la ida; en la vuelta puede
          // traer el mismo anidado con indices intermedios.
          if (value && typeof value === "object" && !Array.isArray(value)) {
            Object.entries(value as Record<string, unknown>).forEach(([innerId, innerValue]) =>
              put(groupId, innerId, unwrapFirst(innerValue)),
            );
            return;
          }
          put(groupId, fieldId, unwrapFirst(value));
        });
      });
    }

    return Object.keys(values).length ? values : undefined;
  }

  function unwrapFirst(value: unknown): unknown {
    return Array.isArray(value) ? value[0] : value;
  }

  function encodeCustomFields(customFields?: CustomFieldValues): Record<string, string> {
    const encoded: Record<string, string> = {};
    Object.entries(customFields ?? {}).forEach(([groupId, fields]) => {
      Object.entries(fields).forEach(([fieldId, value]) => {
        encoded[`custom_fields[${groupId}][0][${fieldId}][0]`] = value;
      });
    });
    return encoded;
  }

  function staffLabel(staff?: RawStaff | null): string | undefined {
    if (!staff) return undefined;
    if (staff.job) return staff.job;
    const name = [staff.name, staff.lastname].filter(Boolean).join(" ");
    return name || undefined;
  }

  function locationLabel(location?: { name?: string } | string | null): string | undefined {
    if (!location) return undefined;
    return typeof location === "string" ? location : location.name;
  }

  function brandSlugFrom(raw: RawReservation, fallback: string): string {
    if (typeof raw.brand === "string" && raw.brand) return raw.brand;
    if (raw.brand && typeof raw.brand === "object" && raw.brand.slug) return raw.brand.slug;
    return fallback;
  }

  function normalizeReservation(raw: RawReservation, brandSlug: string, isWaitlist: boolean): UserReservation {
    const staff = raw.meetings?.staff ?? raw.staff;
    const seat =
      raw.object?.position_text ??
      raw.object?.position_number ??
      raw.meeting_position ??
      undefined;

    const brandSlugResolved = brandSlugFrom(raw, brandSlug);

    return {
      id: raw.id,
      serviceName: raw.meetings?.service?.name ?? raw.service?.name ?? "Reserva",
      startsAt: raw.meeting_start,
      timezone: raw.timezone ?? brandTimeZoneBySlug.get(brandSlugResolved),
      locationName: locationLabel(raw.location),
      staffName: staffLabel(staff),
      brandSlug: brandSlugResolved,
      isWaitlist,
      isOverbooking: raw.is_overbooking === 1,
      // El legacy distingue membresia de credito por `credit === null`, no por un campo propio.
      // `credit.name` es el TIPO de credito (interno del estudio), no el paquete
      // que compro el socio: se guarda para poder resolver el paquete por id.
      creditId: raw.credit?.id ?? null,
      creditTypeName: raw.credit ? (raw.credit.name ?? null) : null,
      waitlistPosition: isWaitlist && seat !== undefined && seat !== null ? String(seat) : undefined,
      seatLabel: !isWaitlist && seat !== undefined && seat !== null ? String(seat) : undefined,
      qrHash: raw.hash_qr ?? undefined,
      cancelled: Boolean(raw.cancelled),
      canCancel: Boolean(raw.canBeCancelled || raw.canBeCancelledWithoutCredit),
    };
  }

  function unwrap<T>(response: PaginatedResponse<T>): T[] {
    return Array.isArray(response) ? response : response.data;
  }

  /** reservation-future/past: objeto unico, array de grupos, o paginado. */
  function unwrapReservationGroups(response: unknown): RawReservationGroup[] {
    if (Array.isArray(response)) return response as RawReservationGroup[];
    if (response && typeof response === "object") {
      const obj = response as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data as RawReservationGroup[];
      if ("reservations" in obj || "waitlists" in obj) return [obj as RawReservationGroup];
    }
    return [];
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

  function normalizeBrand(raw: RawBrand): Brand {
    if (raw.time_zone) brandTimeZoneBySlug.set(raw.slug, raw.time_zone);
    return {
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      timeZone: raw.time_zone ?? undefined,
      termsConditionsLink: raw.terms_conditions_link ?? null,
      gafapayBrandId: raw.gafapay_brand_id ?? null,
      gafapayClientId: raw.gafapay_client_id != null ? String(raw.gafapay_client_id) : null,
      gafapayClientSecret: raw.gafapay_client_secret ?? null,
    };
  }

  function moneyNumber(value: number | string | null | undefined): number | undefined {
    if (value == null || value === "") return undefined;
    const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }

  function formatCatalogPrice(amount: number | undefined, currency = "MXN"): string | undefined {
    if (amount == null) return undefined;
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  }

  function normalizeCatalogItem(
    raw: RawCatalogItem,
    type: "combo" | "membership" | "product",
  ): CatalogItem | null {
    // hide_in_front: productos solo para uso interno / backoffice.
    if (raw.hide_in_front) return null;
    const price = moneyNumber(raw.price);
    const priceFinal = moneyNumber(raw.price_final) ?? price;
    const currency = raw.currency ?? "MXN";
    return {
      id: raw.id,
      name: raw.name,
      description: raw.short_description || raw.description || undefined,
      price,
      priceFinal,
      priceLabel: formatCatalogPrice(priceFinal, currency),
      compareAtPriceLabel:
        raw.has_discount && price != null && priceFinal != null && price > priceFinal
          ? formatCatalogPrice(price, currency)
          : undefined,
      currency,
      type,
      expirationDays: raw.expiration_days ?? undefined,
      hasDiscount: Boolean(raw.has_discount),
      credits: raw.credits ?? undefined,
      subscribable: Boolean(raw.subscribable),
      ctaLabel: "Agregar",
      // El JSON íntegro: v1 manda el combo entero en el cart de
      // `/reservate` y gafa.fit puede leer claves que no normalizamos.
      raw: { ...(raw as Record<string, unknown>) },
    };
  }

  function readFancyBlock(doc: Document, name: string): string | null {
    return doc.querySelector(`.CreateReservationFancy--${name}`)?.textContent?.trim() || null;
  }

  function parseJsonBlock<T>(raw: string | null): T | null {
    if (!raw) return null;
    const candidates = [raw, raw.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'")];
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // siguiente candidato
      }
    }
    return null;
  }

  async function apiGetUrl<T>(absoluteOrPath: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = absoluteOrPath.startsWith("http")
      ? new URL(absoluteOrPath)
      : new URL(`${baseUrl}/api${absoluteOrPath}`);
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
    const response = await fetch(url.toString(), { headers: authHeaders() });
    if (!response.ok) throw await parseErrorBody(response);
    return response.json();
  }

  async function apiPostFormUrl<T>(absoluteOrPath: string, body: Record<string, unknown>): Promise<T> {
    const url = absoluteOrPath.startsWith("http") ? absoluteOrPath : `${baseUrl}${absoluteOrPath}`;
    const form = toFormBody(body);
    const response = await fetch(url, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!response.ok) throw await parseErrorBody(response);
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  const httpClient: GafaClient = {
    async listBrands() {
      const response = await apiGet<PaginatedResponse<RawBrand>>("/brand");
      return unwrap(response).map(normalizeBrand);
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
      const response = await apiGet<PaginatedResponse<RawCatalogItem>>(`/brand/${brandSlug}/combos`, {
        only_actives: true,
      });
      return unwrap(response)
        .map((item) => normalizeCatalogItem(item, "combo"))
        .filter((item): item is CatalogItem => Boolean(item));
    },

    async listMemberships(brandSlug) {
      const response = await apiGet<PaginatedResponse<RawCatalogItem>>(`/brand/${brandSlug}/membership`, {
        only_actives: true,
      });
      return unwrap(response)
        .map((item) => normalizeCatalogItem(item, "membership"))
        .filter((item): item is CatalogItem => Boolean(item));
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

    /**
     * La API no expone una clase suelta por id: solo el listado por sede. Se
     * recorren las sedes candidatas dentro de su ventana publicada
     * (`calendar_days`) hasta encontrarla, que es donde el calendario podria
     * mostrarla de todos modos.
     */
    async getMeeting(payload: MeetingLookup): Promise<Meeting | null> {
      const meetingId = Number(payload.meetingId);
      if (!Number.isFinite(meetingId)) return null;

      const brandSlugs = payload.brandSlug
        ? [payload.brandSlug]
        : (await httpClient.listBrands()).map((brand) => brand.slug);

      for (const brandSlug of brandSlugs) {
        const locations = await httpClient.listLocations(brandSlug);
        const candidates = payload.locationSlug
          ? locations.filter((location) => location.slug === payload.locationSlug)
          : payload.locationId != null
            ? locations.filter((location) => location.id === Number(payload.locationId))
            : locations;

        for (const location of candidates) {
          const from = new Date();
          const to = new Date(from);
          to.setDate(to.getDate() + (location.calendarDays ?? 14));

          const meetings = await httpClient.listMeetings({
            locationId: location.id,
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
          });

          const found = meetings.find((meeting) => Number(meeting.id) === meetingId);
          if (found) return found;
        }
      }

      return null;
    },

    async getProfile(): Promise<UserProfile | null> {
      // Captura el Bearer con el que ESTE request va a hablarle a /me. Si mientras
      // tanto hay un login nuevo, un 401 viejo en vuelo NO debe borrar el token
      // recien guardado (era exactamente el bug de "mapa ok → siguiente clic
      // pide login otra vez").
      const usedToken = syncTokenFromStorage();
      if (!usedToken) return null;

      try {
        const raw = await apiGet<RawUserProfile>("/me");
        const profile = normalizeProfile(raw);

        // El wallet a veces no viene en /me; el legacy lo pide aparte.
        if (profile.storeCreditTotal == null) {
          try {
            const store = await apiGet<{ store_credit?: string | number } | string | number>("/me/store-credit");
            const value =
              typeof store === "object" && store && "store_credit" in store
                ? store.store_credit
                : store;
            if (value != null && value !== "") profile.storeCreditTotal = String(value);
          } catch {
            // sin wallet; no es critico
          }
        }

        return profile;
      } catch (error) {
        if (error instanceof GafaApiError && error.status === 401) {
          if (readStoredToken() === usedToken) {
            token = null;
            clearStoredToken();
          }
          return null;
        }
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
      const response = await apiGet<unknown>(`/me/brand/${brandSlug}/${path}`, {
        reducePopulation: true,
      });

      return unwrapReservationGroups(response)
        .flatMap((group) => [
          ...(group.reservations ?? []).map((raw) => normalizeReservation(raw, brandSlug, false)),
          ...(group.waitlists ?? []).map((raw) => normalizeReservation(raw, brandSlug, true)),
        ])
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    },

    async listUserPurchases(brandSlug) {
      if (!token || !brandSlug) return [];
      const response = await apiGet<PaginatedResponse<RawPurchase>>(`/me/brand/${brandSlug}/purchases`, {
        reducePopulation: true,
      });
      return unwrap(response).map((raw) => {
        const status =
          typeof raw.status === "string"
            ? raw.status
            : raw.status && typeof raw.status === "object"
              ? raw.status.name
              : undefined;
        return {
          id: raw.id,
          name: raw.items?.[0]?.item_name ?? "Compra",
          total: raw.total,
          currencyPrefix: raw.currency?.prefijo,
          createdAt: raw.created_at,
          locationName: locationLabel(raw.location),
          status,
          paymentType: raw.payment_type ?? raw.paymentType ?? undefined,
        };
      });
    },

    async cancelReservation(brandSlug, reservationId) {
      await apiPost(`/api/me/brand/${brandSlug}/reservation-future/${reservationId}/cancel`, {});
    },

    async cancelWaitlist(brandSlug, waitlistId) {
      await apiPost(`/api/me/brand/${brandSlug}/waitlist/remove/${waitlistId}`, {});
    },

    async getUserActivityTotals(): Promise<UserActivityTotals> {
      if (!token) {
        return {
          reservedCount: 0,
          attendedCount: 0,
          noShowCount: 0,
          cancelledCount: 0,
          attendedMinutes: 0,
          favoriteStaff: [],
          favoriteSchedules: [],
        };
      }

      const raw = await apiGet<RawUserTotals>("/me/totals", { only_totals: true });
      const staff = (raw.favorite_staff ?? []).map((item) =>
        typeof item === "string" ? item : item.job || item.name || "",
      );
      const schedules = (raw.favorite_schedules ?? []).map((item) =>
        typeof item === "string" ? item : item.label || item.name || "",
      );

      return {
        reservedCount: raw.reservations_without_cancelled_count ?? 0,
        attendedCount: raw.attended_count ?? 0,
        noShowCount: raw.no_show_count ?? 0,
        cancelledCount: raw.cancelled_count ?? 0,
        attendedMinutes: raw.attended_minutes ?? 0,
        favoriteStaff: staff.filter(Boolean),
        favoriteSchedules: schedules.filter(Boolean),
      };
    },

    async updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
      const body: Record<string, string> = {};
      if (payload.firstName != null) body.first_name = payload.firstName;
      if (payload.lastName != null) body.last_name = payload.lastName;
      if (payload.email != null) body.email = payload.email;
      if (payload.birthDate != null) body.birth_date = payload.birthDate;
      if (payload.gender != null) body.gender = payload.gender;
      if (payload.phone != null) body.phone = payload.phone;
      if (payload.address != null) body.address = payload.address;
      if (payload.externalNumber != null) body.external_number = payload.externalNumber;
      if (payload.internalNumber != null) body.internal_number = payload.internalNumber;
      if (payload.postalCode != null) body.postal_code = payload.postalCode;
      if (payload.municipality != null) body.municipality = payload.municipality;
      if (payload.city != null) body.city = payload.city;
      if (payload.password) {
        body.password = payload.password;
        body.password_confirmation = payload.passwordConfirmation ?? payload.password;
      }
      // Mismo encoding que el registro (`custom_fields[grupo][0][campo][0]`):
      // solo se mandan los que el socio toco, para no borrar lo que ya tenia.
      Object.assign(body, encodeCustomFields(payload.customFields));

      const raw = await apiPost<RawUserProfile>("/api/me", body);
      // Algunos backends no regresan el perfil completo en PutMe: reconsultamos.
      try {
        const fresh = await apiGet<RawUserProfile>("/me");
        return normalizeProfile({ ...raw, ...fresh });
      } catch {
        return normalizeProfile(raw);
      }
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
            purchase_items_id?: number;
            credit?: { id: number; name: string };
            purchase_item?: { item_name?: string | null; buyed?: { name?: string | null } | null } | null;
          }>;
          const entries = Array.isArray(parsed) ? parsed.filter((c) => typeof c.total !== "number" || c.total > 0) : [];

          // El template NO trae el nombre del paquete comprado, solo el tipo de
          // credito interno ("CDMXnew"). El nombre real ("5 Clases") vive en
          // /me/credits; se cruza por purchase_items_id.
          const packageNameByPurchaseItem = new Map<number, string>();
          if (entries.some((c) => !c.purchase_item?.item_name && c.purchase_items_id)) {
            try {
              const response = await apiGet<PaginatedResponse<RawUserCredit>>(
                `/me/brand/${payload.brandSlug}/credits`,
              );
              for (const raw of unwrap(response)) {
                const itemId = (raw as { purchase_items_id?: number }).purchase_items_id;
                const itemName = raw.purchase_item?.item_name;
                if (itemId && itemName) packageNameByPurchaseItem.set(itemId, itemName);
              }
            } catch {
              // sin nombres de paquete; se cae al nombre del credito
            }
          }

          for (const c of entries) {
            const expiration = (c.expiration_date ?? "").slice(0, 10);
            // Lo que el usuario compro (paquete) por delante; el tipo de credito
            // interno solo como respaldo.
            const packageName =
              c.purchase_item?.buyed?.name ||
              c.purchase_item?.item_name ||
              (c.purchase_items_id ? packageNameByPurchaseItem.get(c.purchase_items_id) : undefined) ||
              c.credit?.name ||
              "Paquete";
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
      const customFields = encodeCustomFields(payload.customFields);

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

    async getCheckoutConfig(payload) {
      const brands = await httpClient.listBrands();
      const brand = brands.find((item) => item.slug === payload.brandSlug);
      const profile = await httpClient.getProfile();
      if (!profile) throw new Error("Inicia sesión para continuar con la compra.");

      const url = new URL(
        `${baseUrl}/api/brand/${payload.brandSlug}/location/${payload.locationSlug}/reservation/create-form-template`,
      );
      url.searchParams.set("users_id", String(profile.id));
      if (payload.meetingId != null) url.searchParams.set("meetings_id", String(payload.meetingId));

      const response = await fetch(url.toString(), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(`No se pudo cargar la configuración de pago (${response.status}).`);
      }
      const markup = await response.text();
      const doc = new DOMParser().parseFromString(markup, "text/html");

      type RawPaymentType = {
        id: number;
        name: string;
        slug: string;
        gafapay_id?: number | null;
        order?: number;
        pivot?: { front?: number | boolean | null; back?: number | boolean | null };
      };
      type RawCurrency = { prefijo?: string; sufijo?: string; code3?: string };

      const paymentRaw = parseJsonBlock<RawPaymentType[]>(readFancyBlock(doc, "payment_types")) ?? [];
      const currencyRaw = parseJsonBlock<RawCurrency>(readFancyBlock(doc, "currency"));

      // combosSelection / membershipSelection: SOLO lo que aplica a esta clase
      // (o el catalogo de la sede si no hay meeting). Es la misma fuente que
      // usa el fancy v1, asi que la compra siempre corresponde a la reserva.
      const combosRaw = parseJsonBlock<RawCatalogItem[]>(readFancyBlock(doc, "combosSelection")) ?? [];
      const membershipsRaw =
        parseJsonBlock<RawCatalogItem[]>(readFancyBlock(doc, "membershipSelection")) ?? [];
      const validCombos = combosRaw
        .map((item) => normalizeCatalogItem(item, "combo"))
        .filter((item): item is CatalogItem => Boolean(item));
      const validMemberships = membershipsRaw
        .map((item) => normalizeCatalogItem(item, "membership"))
        .filter((item): item is CatalogItem => Boolean(item));
      const productsRaw = parseJsonBlock<RawCatalogItem[]>(readFancyBlock(doc, "productsSelection")) ?? [];
      const validProducts = productsRaw
        .map((item) => normalizeCatalogItem(item, "product"))
        .filter((item): item is CatalogItem => Boolean(item));

      const userBlock = parseJsonBlock<{ id?: number; users_id?: number; companies_id?: number }>(
        readFancyBlock(doc, "user"),
      );
      const locationBlock = parseJsonBlock<{ id?: number; companies_id?: number }>(
        readFancyBlock(doc, "location"),
      );
      const paymentMethods: FrontPaymentMethod[] = paymentRaw
        .filter((method) => method.pivot?.front === 1 || method.pivot?.front === true)
        .map((method) => ({
          id: method.id,
          name: method.name === "company.Paypal" ? "PayPal" : method.name,
          slug: method.slug,
          gafapayId: method.gafapay_id ?? null,
          order: method.order,
        }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const urlReservation = readFancyBlock(doc, "urlReservation");
      const urlInitialPurchase = readFancyBlock(doc, "urlInitialPurchase");
      const urlInitialPurchaseStatus = readFancyBlock(doc, "urlInitialPurchaseStatus");
      const csrfToken = readFancyBlock(doc, "csrf");
      const urlCheckDiscountCode = readFancyBlock(doc, "urlCheckDiscountCode");
      const urlCheckGiftCode = readFancyBlock(doc, "urlCheckGiftCode");
      const urlGenerateGiftCode = readFancyBlock(doc, "urlGenerateCode");
      const canRedeem = readFancyBlock(doc, "canRedeemStoreCredit");

      if (!urlReservation) {
        throw new Error("No encontramos la configuración de pago para esta sede.");
      }

      const config: CheckoutConfig = {
        brandSlug: payload.brandSlug,
        locationSlug: payload.locationSlug,
        meetingId: payload.meetingId != null ? Number(payload.meetingId) : undefined,
        currency: {
          prefix: currencyRaw?.prefijo ?? "$",
          suffix: currencyRaw?.sufijo ?? currencyRaw?.code3 ?? "MXN",
          code: currencyRaw?.code3 ?? "MXN",
        },
        paymentMethods,
        termsConditionsLink: brand?.termsConditionsLink ?? null,
        gafapayClientId: brand?.gafapayClientId ?? null,
        gafapayClientSecret: brand?.gafapayClientSecret ?? null,
        giftCardsEnabled: Boolean(urlCheckGiftCode),
        discountCodesEnabled: Boolean(urlCheckDiscountCode),
        canRedeemStoreCredit: canRedeem === "1" || canRedeem === "true",
        combos: validCombos,
        memberships: validMemberships,
        products: validProducts,
        companiesId: locationBlock?.companies_id ?? userBlock?.companies_id,
        locationId: locationBlock?.id,
        userProfileId: userBlock?.id ?? profile.id,
        usersId: userBlock?.users_id,
        csrfToken: csrfToken ?? undefined,
        urls: {
          reservation: urlReservation,
          initialPurchase: urlInitialPurchase ?? "",
          initialPurchaseStatus: urlInitialPurchaseStatus ?? "",
          checkDiscountCode: urlCheckDiscountCode ?? undefined,
          checkGiftCode: urlCheckGiftCode ?? undefined,
          generateGiftCode: urlGenerateGiftCode ?? undefined,
        },
      };
      return config;
    },

    async checkDiscountCode(payload) {
      const url = buildCheckDiscountUrl({
        apiBaseUrl: baseUrl,
        brandSlug: payload.brandSlug,
        locationSlug: payload.locationSlug,
        code: payload.code,
        userProfileId: payload.userProfileId,
        urlTemplate: payload.urlTemplate,
        lines: payload.lines,
      });
      const response = await fetch(url.toString(), { headers: authHeaders() });
      const data: unknown = await response.json().catch(() => null);
      return parseDiscountCheckResponse(payload.code, response.ok, data);
    },

    async checkGiftCode(payload) {
      const url = `${baseUrl}/api/brand/${payload.brandSlug}/location/${payload.locationSlug}/reservation/check-gift-code/${encodeURIComponent(payload.code)}`;
      const response = await fetch(url, { headers: authHeaders() });
      if (!response.ok) {
        return { valid: false, code: payload.code } satisfies GiftCodeResult;
      }
      const data = (await response.json()) as Record<string, unknown>;
      return {
        valid: true,
        code: payload.code,
        label: typeof data.name === "string" ? data.name : undefined,
        balance: typeof data.balance === "number" ? data.balance : typeof data.amount === "number" ? data.amount : undefined,
        raw: data,
      } satisfies GiftCodeResult;
    },

    /**
     * Stripe/PayPal: paridad con `BuySystemStep.sendForm` del fancy v1.
     * POST a `/reservation/reservate` → Stripe::paymentByCard o paymentByToken.
     * `initial-purchase` (abajo) es SOLO Recurrente y cae en unpaidPurchase,
     * que en producción truena: `$subscribe` null.
     */
    async reservatePurchase(payload: InitialPurchasePayload) {
      const url = `${baseUrl}/api/brand/${payload.brandSlug}/location/${payload.locationSlug}/reservation/reservate`;
      const data = await apiPostFormUrl<Record<string, unknown>>(url, buildPurchaseFormBody(payload));
      const result = parsePurchaseResult(data);
      if (result.purchaseId == null && result.reservationId == null) {
        throw new Error("El servidor no confirmó la compra.");
      }
      return result;
    },

    async initialPurchase(payload: InitialPurchasePayload) {
      const url = `${baseUrl}/api/brand/${payload.brandSlug}/location/${payload.locationSlug}/reservation/initial-purchase`;
      const data = await apiPostFormUrl<Record<string, unknown>>(url, buildPurchaseFormBody(payload));
      return parsePurchaseResult(data);
    },

    async pollInitialPurchaseStatus(payload) {
      const url = `${baseUrl}/api/brand/${payload.brandSlug}/location/${payload.locationSlug}/reservation/initial-purchase-status`;
      // El endpoint contesta 200 siempre; el detalle del fallo viaja en `error`
      // ("Hubo un error en la creación del pago"), no en `message`.
      const data = await apiGetUrl<{
        code?: number;
        message?: string;
        error?: string;
        reservation_id?: number;
      }>(url, {
        checkout_token: payload.checkoutToken,
        pending_purchase_id: payload.pendingPurchaseId,
        _: Date.now(),
      });
      return {
        code: typeof data.code === "number" ? data.code : 0,
        message: data.message ?? data.error,
        reservationId: data.reservation_id,
        raw: data,
      } satisfies InitialPurchaseStatus;
    },

    /**
     * Puente al fancy legacy. El checkout nativo NO vive aqui (este cliente no
     * pinta UI): `createGafaSdk` reemplaza estos dos metodos para que abran los
     * modales de v2. Solo se llega a este cuerpo usando el cliente suelto.
     */
    async openCheckout(payload: CheckoutPayload) {
      if (!legacy) {
        throw new Error(
          "Este cliente no abre UI. Usa GafaThemeSDK.openCheckout({ brandSlug, preselect }) del runtime del SDK.",
        );
      }
      return legacy.openCheckout(payload);
    },

    async openReservationCheckout(payload: ReservationCheckoutPayload) {
      if (!legacy) {
        throw new Error(
          "Este cliente no abre UI. Usa GafaThemeSDK.openReservation({ meetingId, brandSlug, locationSlug }) del runtime del SDK.",
        );
      }
      return legacy.openReservationCheckout(payload);
    },
  };

  return httpClient;
}
