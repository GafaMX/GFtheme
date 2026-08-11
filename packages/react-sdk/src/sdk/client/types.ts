export type Brand = {
  id: number;
  name: string;
  slug: string;
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
  priceLabel?: string;
  currency?: string;
  ctaLabel?: string;
  type?: "combo" | "membership" | "product" | "service" | "staff";
};

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  creditsLabel?: string;
  photoUrl?: string;
  storeCreditTotal?: string;
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
  /** Nombre del credito usado, o null cuando la reserva se pago con membresia. */
  creditName?: string | null;
  waitlistPosition?: string;
};

export type UserPurchase = {
  id: number;
  name: string;
  total: number;
  currencyPrefix?: string;
  createdAt?: string;
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
  login(credentials: AuthCredentials): Promise<{ access_token: string }>;
  logout(): void;
  register(payload: RegisterPayload): Promise<{ url?: string }>;
  requestPasswordReset(payload: PasswordResetRequestPayload): Promise<void>;
  resetPassword(payload: PasswordResetPayload): Promise<void>;
  openCheckout(payload: CheckoutPayload): Promise<void>;
  openReservationCheckout(payload: ReservationCheckoutPayload): Promise<void>;
};
