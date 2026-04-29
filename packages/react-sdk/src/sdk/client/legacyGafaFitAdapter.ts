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

type LegacyCallback<T> = (error: unknown, result: T) => void;

type LegacyGafaFitSdk = {
  setUrl?: (url: string) => void;
  setCompany?: (companyId: number) => void;
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
};

declare global {
  interface Window {
    GafaFitSDK?: LegacyGafaFitSdk;
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

      return callbackToPromise<Meeting[]>((cb) => {
        const locationId = Number(filters.locationId);
        sdk.GetMeetingsInLocation?.(locationId, startDate, endDate, cb);
      });
    },
    async getProfile() {
      if (!sdk.GetMe) return null;
      return callbackToPromise<UserProfile | null>((cb) => sdk.GetMe?.(cb));
    },
    async login() {
      throw new Error("Login is not implemented in the legacy adapter foundation yet.");
    },
    async openCheckout() {
      throw new Error("Checkout is not implemented in the legacy adapter foundation yet.");
    },
  };
}
