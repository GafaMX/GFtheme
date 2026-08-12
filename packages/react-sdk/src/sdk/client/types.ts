export type Brand = {
  id: number;
  name: string;
  slug: string;
  /** Link a terminos y condiciones (admin de la marca). */
  termsConditionsLink?: string | null;
  gafapayBrandId?: number | null;
  gafapayClientId?: string | null;
};

export type Location = {
  id: number;
  name: string;
  slug: string;
  brandSlug?: string;
  brand?: Brand;
  /** Cuantos dias hacia adelante publica horarios esta sede (calendar_days). */
  calendarDays?: number;
};

export type Service = {
  id: number;
  name: string;
  description?: string;
  durationMinutes?: number;
};

export type StaffMember = {
  id: number;
  name: string;
  lastname?: string;
  bio?: string;
  photoUrl?: string;
};

export type Meeting = {
  id: number;
  name: string;
  brandSlug?: string;
  startsAt: string;
  /** Zona horaria de la sede. La API la manda por reunion. */
  timezone?: string;
  start?: string;
  start_date?: string;
  startTime?: string;
  timeLabel?: string;
  endsAt?: string;
  durationMinutes?: number;
  description?: string;
  service?: Service;
  serviceId?: string | number;
  serviceName?: string;
  staff?: StaffMember;
  staffId?: string | number;
  staffName?: string;
  location?: Location;
  locationSlug?: string;
  available?: number;
  capacity?: number;
  isReserved?: boolean;
  passed?: boolean;
  availability?:
    | "available"
    | "waitlist"
    | "sold-out"
    | {
    capacity?: number;
    reserved?: number;
    waitlist?: number;
      };
};

export type GafaMeeting = Meeting;

export type CatalogItem = {
  id: number;
  name: string;
  description?: string;
  price?: number;
  /** Precio final tras descuento de catalogo (si aplica). */
  priceFinal?: number;
  priceLabel?: string;
  compareAtPriceLabel?: string;
  currency?: string;
  ctaLabel?: string;
  type?: "combo" | "membership" | "product" | "service" | "staff";
  expirationDays?: number;
  hasDiscount?: boolean;
  credits?: number;
  /** Membresia / paquete suscribible (pago recurrente). */
  subscribable?: boolean;
};

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  externalNumber?: string | null;
  internalNumber?: string | null;
  postalCode?: string | null;
  municipality?: string | null;
  city?: string | null;
  creditsLabel?: string;
  photoUrl?: string;
  /** Credito en tienda (wallet), formateado como lo manda el API. */
  storeCreditTotal?: string;
  memberSince?: string;
  /**
   * Valores guardados de los campos especiales de la marca, indexados por
   * grupo y campo. Vacio si el API no los devuelve en `/me`.
   */
  customFields?: CustomFieldValues;
};

export type UserCredit = {
  id: number;
  name: string;
  total: number;
  expiresAt?: string;
};

export type UserMembership = {
  id: number;
  name: string;
  startedAt?: string;
  expiresAt?: string;
};

export type UserReservation = {
  id: number;
  serviceName: string;
  startsAt: string;
  locationName?: string;
  staffName?: string;
  brandSlug: string;
  isWaitlist: boolean;
  isOverbooking: boolean;
  /**
   * Id del TIPO de credito con el que se pago (null = se pago con membresia).
   * Sirve para resolver contra los creditos del usuario el nombre del paquete,
   * que es lo unico que el socio reconoce.
   */
  creditId?: number | null;
  /**
   * Nombre del TIPO de credito tal cual lo manda el API (`credit.name`, ej.
   * "CDMXnew"). Es una etiqueta de gestion interna del estudio: NO mostrarla al
   * socio. Ver docs/creditos-vs-paquetes.md.
   */
  creditTypeName?: string | null;
  waitlistPosition?: string;
  /** Lugar/spot en el mapa (ej. "14"). */
  seatLabel?: string;
  /** Hash para generar el QR de acceso a la clase. */
  qrHash?: string;
  cancelled?: boolean;
  canCancel?: boolean;
};

export type UserPurchase = {
  id: number;
  name: string;
  total: number;
  currencyPrefix?: string;
  createdAt?: string;
  locationName?: string;
  status?: string;
  paymentType?: string;
};

/** KPIs de actividad del usuario (`GET /api/me/totals`). */
export type UserActivityTotals = {
  reservedCount: number;
  attendedCount: number;
  noShowCount: number;
  cancelledCount: number;
  attendedMinutes: number;
  favoriteStaff: string[];
  favoriteSchedules: string[];
};

export type UpdateProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
  address?: string;
  externalNumber?: string;
  internalNumber?: string;
  postalCode?: string;
  municipality?: string;
  city?: string;
  password?: string;
  passwordConfirmation?: string;
  /** Campos especiales de la marca, indexados por grupo y campo. */
  customFields?: CustomFieldValues;
};

export type GafaUser = UserProfile;

export type GafaClientOptions = {
  apiBaseUrl: string;
  companyId: number;
  publicClientId?: string | number;
  clientSecret?: string;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  passwordConfirmation: string;
  firstName: string;
  lastName?: string;
  birthDate?: string;
  gender?: "male" | "female";
  captchaToken: string;
  /** Valores de los campos especiales, indexados por id de grupo y de campo. */
  customFields?: CustomFieldValues;
};

/**
 * Campos extra que cada marca configura desde gafa.fit (telefono, como nos
 * conociste, etc.). El registro no se puede completar sin los que son
 * obligatorios, asi que el SDK tiene que pintarlos aunque no los conozca de
 * antemano.
 */
export type CustomFieldGroup = {
  id: number;
  name: string;
  description?: string | null;
  fields: CustomField[];
};

export type CustomField = {
  id: number;
  name: string;
  type: string;
  required: boolean;
  helpText?: string | null;
  defaultValue?: string | null;
  options: Array<{ id: number; name: string }>;
};

export type CustomFieldValues = Record<string, Record<string, string>>;

export type PasswordResetRequestPayload = {
  email: string;
  returnUrl: string;
};

export type PasswordResetPayload = {
  email: string;
  password: string;
  passwordConfirmation: string;
  token: string;
};

export type CheckoutPayload = {
  brandSlug: string;
  locationId?: string | number;
  userId?: string | number;
  targetSelector?: string;
  payload: Record<string, unknown>;
};

export type ReservationCheckoutPayload = {
  meetingId: string | number;
  brandSlug: string;
  locationSlug: string;
  userId?: string | number;
  targetSelector?: string;
};

/** Metodo de pago activo en front (pivot.front === 1) para la marca/sede. */
export type FrontPaymentMethod = {
  id: number;
  name: string;
  slug: string;
  gafapayId?: number | null;
  order?: number;
};

export type CheckoutCurrency = {
  prefix: string;
  suffix: string;
  code: string;
};

/**
 * Config de checkout nativo sacada del create-form-template + brand:
 * metodos front, URLs de compra/descuento/gift, terminos y los productos
 * VALIDOS para la clase (combosSelection / membershipSelection).
 */
export type CheckoutConfig = {
  brandSlug: string;
  locationSlug: string;
  meetingId?: number;
  currency: CheckoutCurrency;
  paymentMethods: FrontPaymentMethod[];
  termsConditionsLink?: string | null;
  giftCardsEnabled: boolean;
  discountCodesEnabled: boolean;
  canRedeemStoreCredit: boolean;
  /** Solo lo que la clase acepta; en checkout sin clase, el catalogo completo. */
  combos: CatalogItem[];
  memberships: CatalogItem[];
  /** Datos que GafaPayFront necesita en generalData. */
  companiesId?: number;
  locationId?: number;
  userProfileId?: number;
  usersId?: number;
  urls: {
    initialPurchase: string;
    initialPurchaseStatus: string;
    checkDiscountCode?: string;
    checkGiftCode?: string;
    generateGiftCode?: string;
  };
};

export type DiscountCodeResult = {
  valid: boolean;
  code: string;
  label?: string;
  /** Monto a restar del total (si el API lo manda). */
  discountAmount?: number;
  raw?: unknown;
};

export type GiftCodeResult = {
  valid: boolean;
  code: string;
  label?: string;
  balance?: number;
  raw?: unknown;
};

export type CartLineType = "combo" | "membership" | "product";

export type InitialPurchasePayload = {
  brandSlug: string;
  locationSlug: string;
  userId: number;
  meetingId?: number;
  /** Lineas del carrito (combos / membresias / productos). */
  lines: Array<{ id: number; type: CartLineType; amount: number }>;
  paymentTypeId: number;
  paymentData?: Record<string, unknown>;
  discountCode?: string | null;
  giftCode?: string | null;
  checkoutToken?: string | null;
  selectedCredit?: string;
  seatObjectId?: number;
  subscribe?: boolean;
  setPayment?: boolean;
};

export type InitialPurchaseResult = {
  purchaseId?: number | null;
  checkoutToken?: string | null;
  raw?: unknown;
};

export type InitialPurchaseStatus = {
  /** 1 = ok, 0 = pending, -1 = error (contrato fancy). */
  code: number;
  message?: string;
  reservationId?: number;
  raw?: unknown;
};

export type MeetingFilters = {
  brandId?: string | number;
  locationId?: string | number;
  serviceId?: string | number;
  staffId?: string | number;
  roomId?: string | number;
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
};

/** Un objeto del mapa de salon (bici, tapete, coach, etc.). */
export type SeatMapObject = {
  /** maps_objects_id: es lo que se manda al reservar. */
  id: number;
  row: number;
  column: number;
  width: number;
  height: number;
  /** Numero visible del lugar ("1", "37"). Vacio para objetos decorativos. */
  label: string;
  /** "public" = reservable; "coach" y otros son decorativos. */
  type: string;
  isBlocked: boolean;
  isOccupied: boolean;
  /** Imagenes que la marca sube por tipo de spot: vacio / ocupado / elegido. */
  image?: string | null;
  imageDisabled?: string | null;
  imageSelected?: string | null;
};

export type SeatMap = {
  id: number;
  name: string;
  rows: number;
  columns: number;
  capacity: number;
  objects: SeatMapObject[];
};

/**
 * Una forma de pagar la reserva que el usuario YA tiene: un paquete con
 * creditos o una membresia. `id` es el valor exacto que el backend espera en
 * `selected_credit` (formato del fancy legacy).
 */
export type ReservationPaymentOption = {
  id: string;
  kind: "credit" | "membership";
  /** Nombre del paquete comprado o de la membresia (lo que le importa al usuario). */
  name: string;
  /** Tipo de credito interno (ej. "CDMXnew"), informativo. */
  creditName?: string;
  /** Creditos restantes ANTES de esta reserva (solo kind=credit). */
  remaining?: number;
  expiresAt?: string;
};

/**
 * Todo lo necesario para reservar un meeting de forma nativa. Sale del
 * create-form-template del servidor (el mismo que alimenta al fancy legacy),
 * parseado a datos: mapa del salon con ocupados, creditos validos y perfil.
 */
export type ReservationContext = {
  meetingId: number;
  brandSlug: string;
  locationSlug: string;
  userProfileId: number;
  /** null cuando la clase no usa mapa (p.ej. Bunker). */
  seatMap: SeatMap | null;
  /** Paquetes con credito y membresias que aplican a ESTE meeting. */
  paymentOptions: ReservationPaymentOption[];
  /** true si el meeting esta lleno y el servidor ofrece lista de espera. */
  waitlistAvailable: boolean;
};

export type CreateReservationPayload = {
  brandSlug: string;
  locationSlug: string;
  meetingId: string | number;
  userProfileId: number;
  /** maps_objects_id del lugar elegido; omitir cuando no hay mapa. */
  seatObjectId?: number;
  /** Con que pagar cuando hay varias opciones (ReservationPaymentOption.id). */
  selectedCredit?: string;
};

export type CreateReservationResult = {
  reservationId: number;
  isWaitlist: boolean;
  seatLabel?: string;
};

export type GafaClient = {
  listBrands(): Promise<Brand[]>;
  listLocations(brandSlug?: string): Promise<Location[]>;
  listServices(brandSlug?: string): Promise<Service[]>;
  listStaff(brandSlug?: string): Promise<StaffMember[]>;
  listMeetings(filters?: MeetingFilters): Promise<Meeting[]>;
  listCombos(brandSlug: string): Promise<CatalogItem[]>;
  listMemberships(brandSlug: string): Promise<CatalogItem[]>;
  getProfile(): Promise<UserProfile | null>;
  listRegistrationFields(brandSlug: string): Promise<CustomFieldGroup[]>;
  listUserCredits(brandSlug: string): Promise<UserCredit[]>;
  listUserMemberships(brandSlug: string): Promise<UserMembership[]>;
  listUserReservations(brandSlug: string, when?: "future" | "past"): Promise<UserReservation[]>;
  listUserPurchases(brandSlug: string): Promise<UserPurchase[]>;
  cancelReservation(brandSlug: string, reservationId: string | number): Promise<void>;
  cancelWaitlist?(brandSlug: string, waitlistId: string | number): Promise<void>;
  getUserActivityTotals?(): Promise<UserActivityTotals>;
  updateProfile?(payload: UpdateProfilePayload): Promise<UserProfile>;
  /** Datos para el flujo de reserva nativo (mapa de salon, creditos validos). */
  getReservationContext?(payload: ReservationCheckoutPayload): Promise<ReservationContext>;
  /** Crea la reserva directamente (usa credito valido; asigna lugar si se manda). */
  createReservation?(payload: CreateReservationPayload): Promise<CreateReservationResult>;
  /** Config de checkout nativo (metodos front, terminos, URLs descuento/gift). */
  getCheckoutConfig?(payload: {
    brandSlug: string;
    locationSlug: string;
    meetingId?: string | number;
  }): Promise<CheckoutConfig>;
  checkDiscountCode?(payload: {
    brandSlug: string;
    locationSlug: string;
    code: string;
    meetingId?: string | number;
    lines: Array<{ id: number; type: CartLineType }>;
  }): Promise<DiscountCodeResult>;
  checkGiftCode?(payload: {
    brandSlug: string;
    locationSlug: string;
    code: string;
  }): Promise<GiftCodeResult>;
  initialPurchase?(payload: InitialPurchasePayload): Promise<InitialPurchaseResult>;
  pollInitialPurchaseStatus?(payload: {
    brandSlug: string;
    locationSlug: string;
    checkoutToken: string;
    pendingPurchaseId: number;
  }): Promise<InitialPurchaseStatus>;
  login(credentials: AuthCredentials): Promise<{ access_token: string }>;
  logout(): void;
  register(payload: RegisterPayload): Promise<{ url?: string }>;
  requestPasswordReset(payload: PasswordResetRequestPayload): Promise<void>;
  resetPassword(payload: PasswordResetPayload): Promise<void>;
  openCheckout(payload: CheckoutPayload): Promise<void>;
  openReservationCheckout(payload: ReservationCheckoutPayload): Promise<void>;
};
