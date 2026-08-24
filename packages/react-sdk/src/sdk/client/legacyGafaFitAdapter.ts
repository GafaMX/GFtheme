import type {
  GafaClient,
  Brand,
  CatalogItem,
  Location,
  Meeting,
  Service,
  StaffMember,
  UserProfile,
} from "./types";
import type { GafaSdkConfig } from "../config";
import { readStoredToken } from "./tokenStorage";
import { readHasSeatMap } from "./seatMapHint";

type LegacyCallback<T> = (error: unknown, result: T) => void;

type LegacyGafaFitSdk = {
  setUrl?: (url: string) => void;
  setCompany?: (companyId: number) => void;
  setAutorization?: (token: string) => void;
  logout?: () => void;
  /** OJO: el isAuthentified PUBLICO es asincrono (recibe callback y devuelve
      undefined); no sirve como guard sincrono. La sesion se valida con nuestro
      propio token almacenado. */
  isAuthentified?: (cb: (isAuth: boolean) => void) => void;
  GetBrandList?: (options: Record<string, unknown>, cb: LegacyCallback<{ data: Brand[] }>) => void;
  GetBrandLocations?: (brandSlug: string, options: Record<string, unknown>, cb: LegacyCallback<{ data: Location[] }>) => void;
  GetBrandStaffList?: (brandSlug: string, options: Record<string, unknown>, cb: LegacyCallback<{ data: StaffMember[] }>) => void;
  GetBrandServiceList?: (brandSlug: string, options: Record<string, unknown>, cb: LegacyCallback<{ data: Service[] }>) => void;
  GetBrandCombolist?: (brandSlug: string, options: Record<string, unknown>, cb: LegacyCallback<{ data: CatalogItem[] }>) => void;
  GetBrandMembershipList?: (brandSlug: string, options: Record<string, unknown>, cb: LegacyCallback<{ data: CatalogItem[] }>) => void;
  GetMeetingsInLocation?: (
    locationId: number,
    startDate: string,
    endDate: string,
    cb: LegacyCallback<Meeting[]>,
  ) => void;
  GetMe?: (cb: LegacyCallback<UserProfile | null>) => void;
  GetCreateReservationForm?: (
    brandSlug: string,
    locationSlug: string | number | undefined,
    userId: string | number | undefined,
    targetSelector: string,
    payload: Record<string, unknown>,
    cb: LegacyCallback<unknown>,
  ) => void;
};

declare global {
  interface Window {
    GafaFitSDK?: LegacyGafaFitSdk;
  }
}

/**
 * GafaFitSDK.GetMe nunca invoca su callback cuando no hay sesion (se queda colgado en vez
 * de fallar) -- checar isAuthentified() (sincrono) antes de tocar GetMe/GetCreateReservationForm
 * evita ese hang y da un error reconocible para que AuthWidget lo intercepte mas adelante.
 */
export class NotAuthenticatedError extends Error {
  constructor() {
    super("Necesitas iniciar sesion para continuar.");
    this.name = "NotAuthenticatedError";
  }
}

function requireLegacySdk(): LegacyGafaFitSdk {
  if (!window.GafaFitSDK) {
    throw new Error("window.GafaFitSDK is required when using the legacy adapter.");
  }

  return window.GafaFitSDK;
}

function callbackToPromise<T>(invoke: (cb: LegacyCallback<T>) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    invoke((error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

export function createLegacyGafaFitAdapter(config: GafaSdkConfig, legacySdk?: unknown): GafaClient {
  const sdk = (legacySdk as LegacyGafaFitSdk | undefined) ?? requireLegacySdk();

  sdk.setUrl?.(config.apiBaseUrl);
  sdk.setCompany?.(config.companyId);

  return {
    async listBrands() {
      const result = await callbackToPromise<{ data: Brand[] }>((cb) => sdk.GetBrandList?.({}, cb));
      return result.data;
    },
    async listLocations(brandSlug?: string) {
      if (!brandSlug) return [];
      const result = await callbackToPromise<{ data: Location[] }>((cb) =>
        sdk.GetBrandLocations?.(brandSlug, { per_page: 1000 }, cb),
      );
      return result.data;
    },
    async listStaff(brandSlug?: string) {
      if (!brandSlug) return [];
      const result = await callbackToPromise<{ data: StaffMember[] }>((cb) =>
        sdk.GetBrandStaffList?.(brandSlug, { per_page: 1000 }, cb),
      );
      return result.data;
    },
    async listServices(brandSlug?: string) {
      if (!brandSlug) return [];
      const result = await callbackToPromise<{ data: Service[] }>((cb) =>
        sdk.GetBrandServiceList?.(brandSlug, { per_page: 1000 }, cb),
      );
      return result.data;
    },
    async listCombos(brandSlug: string) {
      const result = await callbackToPromise<{ data: CatalogItem[] }>((cb) =>
        sdk.GetBrandCombolist?.(brandSlug, { per_page: 10000, only_actives: true, propagate: true }, cb),
      );
      return result.data.map((item) => ({ ...item, type: "combo" as const }));
    },
    async listMemberships(brandSlug: string) {
      const result = await callbackToPromise<{ data: CatalogItem[] }>((cb) =>
        sdk.GetBrandMembershipList?.(brandSlug, { per_page: 10000, only_actives: true, propagate: true }, cb),
      );
      return result.data.map((item) => ({ ...item, type: "membership" as const }));
    },
    async listMeetings(filters = {}) {
      if (!filters.locationId || !sdk.GetMeetingsInLocation) return [];
      const startDate = filters.from ?? new Date().toISOString().slice(0, 10);
      const end = new Date(startDate);
      end.setDate(end.getDate() + 14);
      const endDate = filters.to ?? end.toISOString().slice(0, 10);

      const meetings = await callbackToPromise<Meeting[]>((cb) => {
        const locationId = Number(filters.locationId);
        sdk.GetMeetingsInLocation?.(locationId, startDate, endDate, cb);
      });

      return meetings.map(normalizeLegacyMeeting);
    },
    async getProfile() {
      if (!sdk.GetMe) return null;
      return callbackToPromise<UserProfile | null>((cb) => sdk.GetMe?.(cb));
    },
    // Los datos de perfil los resuelve httpGafaClient directo contra la API; este adaptador
    // solo sigue vivo como fallback de openCheckout/openReservationCheckout.
    async listRegistrationFields() {
      throw new Error("listRegistrationFields no esta implementado en el adaptador legacy.");
    },
    async listUserCredits() {
      throw new Error("listUserCredits no esta implementado en el adaptador legacy.");
    },
    async listUserMemberships() {
      throw new Error("listUserMemberships no esta implementado en el adaptador legacy.");
    },
    async listUserReservations() {
      throw new Error("listUserReservations no esta implementado en el adaptador legacy.");
    },
    async listUserPurchases() {
      throw new Error("listUserPurchases no esta implementado en el adaptador legacy.");
    },
    async cancelReservation() {
      throw new Error("cancelReservation no esta implementado en el adaptador legacy.");
    },
    async cancelWaitlist() {
      throw new Error("cancelWaitlist no esta implementado en el adaptador legacy.");
    },
    async getUserActivityTotals() {
      throw new Error("getUserActivityTotals no esta implementado en el adaptador legacy.");
    },
    async updateProfile() {
      throw new Error("updateProfile no esta implementado en el adaptador legacy.");
    },
    async login() {
      throw new Error("Login is not implemented in the legacy adapter foundation yet.");
    },
    logout() {
      // El cliente HTTP (httpGafaClient) es el que maneja login/logout de verdad; este
      // adaptador solo queda como fallback de openCheckout/openReservationCheckout.
    },
    async register() {
      throw new Error("Register is not implemented in the legacy adapter foundation yet.");
    },
    async requestPasswordReset() {
      throw new Error("requestPasswordReset is not implemented in the legacy adapter foundation yet.");
    },
    async resetPassword() {
      throw new Error("resetPassword is not implemented in the legacy adapter foundation yet.");
    },
    async openCheckout(payload) {
      if (!sdk.GetCreateReservationForm) {
        throw new Error("GafaFitSDK.GetCreateReservationForm is not available.");
      }

      ensureSessionToken(sdk);

      await callbackToPromise<unknown>((cb) => {
        sdk.GetCreateReservationForm?.(
          payload.brandSlug,
          payload.locationId,
          payload.userId,
          payload.targetSelector ?? '[data-gf-theme="fancy"]',
          payload.payload,
          cb,
        );
      });
    },
    async openReservationCheckout(payload) {
      if (!sdk.GetCreateReservationForm) {
        throw new Error("GafaFitSDK.GetCreateReservationForm is not available.");
      }

      ensureSessionToken(sdk);

      const userId = payload.userId ?? (await getLegacyUserId(sdk));

      await callbackToPromise<unknown>((cb) => {
        sdk.GetCreateReservationForm?.(
          payload.brandSlug,
          payload.locationSlug,
          userId,
          payload.targetSelector ?? '[data-gf-theme="fancy"]',
          {
            meetings_id: payload.meetingId,
          },
          cb,
        );
      });
    },
  };
}

/**
 * Valida la sesion con NUESTRO token (el legacy no expone un check sincrono
 * fiable) y de paso lo inyecta al cache interno del SDK legacy por si este
 * cargo antes del login.
 */
function ensureSessionToken(sdk: LegacyGafaFitSdk): void {
  const token = readStoredToken();
  if (!token) {
    throw new NotAuthenticatedError();
  }
  try {
    sdk.setAutorization?.(token);
  } catch {
    // Si el legacy no puede sincronizar, que lo intente con su propio estado.
  }
}

async function getLegacyUserId(sdk: LegacyGafaFitSdk): Promise<string | number | undefined> {
  if (!sdk.GetMe) {
    return undefined;
  }

  const user = await callbackToPromise<UserProfile | null>((cb) => sdk.GetMe?.(cb));
  return user?.id;
}

function normalizeLegacyMeeting(meeting: Meeting): Meeting {
  const startsAt = meeting.startsAt ?? meeting.start ?? meeting.start_date;

  return {
    ...meeting,
    startsAt,
    serviceName: meeting.serviceName ?? meeting.service?.name,
    staffName:
      meeting.staffName ??
      [meeting.staff?.name, meeting.staff?.lastname].filter(Boolean).join(" ") ??
      undefined,
    hasSeatMap: meeting.hasSeatMap ?? readHasSeatMap(meeting),
  };
}
