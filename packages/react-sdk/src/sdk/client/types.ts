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
  startsAt: string;
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

export type CheckoutPayload = {
  brandSlug: string;
  locationId?: string | number;
  userId?: string | number;
  targetSelector?: string;
  payload: Record<string, unknown>;
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
  login(credentials: AuthCredentials): Promise<{ access_token: string }>;
  openCheckout(payload: CheckoutPayload): Promise<void>;
};
