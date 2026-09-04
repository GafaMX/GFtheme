import type { ConciergePartnerConfig, ConciergeProduct, ConciergeScheduleItem } from "./contracts";

export type ConciergeSdkBridge = {
  client: {
    listBrands?(): Promise<Array<{ slug: string; name: string }>>;
    listLocations(brand: string): Promise<unknown[]>;
    listMeetings(opts: { locationId: string; from: string; to: string }): Promise<Array<{
      id?: number;
      startsAt?: string;
      serviceName?: string;
      name?: string;
      staffName?: string;
      available?: number;
      locationSlug?: string;
      brandSlug?: string;
      location?: { slug?: string };
    }>>;
    getProfile(): Promise<{ firstName?: string } | null>;
    listCombos?(brand: string): Promise<Array<{ id: number; name: string; description?: string; price?: number; priceLabel?: string }>>;
    listMemberships?(brand: string): Promise<Array<{ id: number; name: string; description?: string; price?: number; priceLabel?: string }>>;
    openReservationCheckout?(opts: {
      meetingId: number;
      brandSlug: string;
      locationSlug: string;
    }): Promise<unknown>;
  };
  openAccount(): unknown;
  openCheckout?(options: {
    brandSlug?: string;
    locationId?: number;
    locationSlug?: string;
    preselect?: { type: "combo" | "membership" | "product"; id: number };
    skipCatalog?: boolean;
  }): { close(): void };
  openReservationCheckout?(opts: {
    meetingId: number;
    brandSlug: string;
    locationSlug: string;
  }): Promise<unknown>;
  enablePurchaseButtons?(root?: Document | Element): () => void;
};

export type AdapterOutcome = { opened: boolean; fallback: boolean };
export type AdapterScheduleResult =
  | { status: "ok"; items: ConciergeScheduleItem[] }
  | { status: "sdk_unavailable" | "upstream_error"; items: [] };

export interface ConciergeBrowserAdapter {
  getProfile(): Promise<{ firstName?: string } | null>;
  listLocations(brandSlug: string): Promise<unknown[]>;
  listMeetings(locationId: string, date: string): Promise<AdapterScheduleResult>;
  openAccount(): AdapterOutcome;
  buyProduct(product: ConciergeProduct): Promise<AdapterOutcome>;
  reserveMeeting(item: ConciergeScheduleItem): Promise<AdapterOutcome>;
  openCalendar(locationId?: string, date?: string): void;
  openPackages(): void;
  openWhatsapp(): void;
}

export function completeAdapterHandoff(
  outcome: AdapterOutcome,
  onOpened: () => void,
  onFallback: () => void,
): void {
  if (outcome.opened) onOpened();
  else onFallback();
}

export type ConciergeAdapterOptions = {
  config: ConciergePartnerConfig;
  sdk?: ConciergeSdkBridge | null;
  webview?: boolean;
  navigate: (path: string) => void;
  resolveHardPath?: (path: string) => string;
};

const MODAL_SELECTORS = [
  ".gafa-checkout-overlay",
  ".gafa-reservation-overlay",
  "#CreateReservationFancyTemplate--Block",
  ".fancybox__container",
  '[data-gf-theme="fancy"] .GFSDK-com-loading',
  '[data-gf-theme="fancy"].active',
  '[data-gf-theme="fancy"].show',
];

export function nextDayIso(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export async function waitForModal(timeoutMs = 2_500): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (typeof document !== "undefined" && MODAL_SELECTORS.some((selector) => document.querySelector(selector))) {
      return true;
    }
    await new Promise((resolve) => {
      if (typeof window !== "undefined") window.setTimeout(resolve, 100);
      else setTimeout(resolve, 100);
    });
  }
  return false;
}

function route(config: ConciergePartnerConfig, webview: boolean, key: "calendar" | "packages") {
  return (webview ? config.routes.webview : config.routes.web)[key];
}

function requestSdkReinit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("buq:sdk:reinit"));
}

export function ensureFancySibling(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector<HTMLElement>('[data-gf-theme="fancy"]');
  if (existing) return existing;
  const fancy = document.createElement("div");
  fancy.setAttribute("data-gf-theme", "fancy");
  fancy.setAttribute("hidden", "");
  document.body.appendChild(fancy);
  return fancy;
}

export function createConciergeBrowserAdapter(options: ConciergeAdapterOptions): ConciergeBrowserAdapter {
  const { config, sdk, navigate, resolveHardPath = (path) => path } = options;
  const webview = Boolean(options.webview);

  return {
    async getProfile() {
      if (!sdk) return null;
      try {
        return await sdk.client.getProfile();
      } catch {
        return null;
      }
    },
    async listLocations(brandSlug) {
      if (!sdk) return [];
      try {
        return await sdk.client.listLocations(brandSlug);
      } catch {
        return [];
      }
    },
    async listMeetings(locationId, date) {
      if (!sdk || !config.capabilities.schedule) return { status: "sdk_unavailable", items: [] };
      const studio = config.studios.find((candidate) => candidate.locationId === locationId);
      if (!studio) return { status: "upstream_error", items: [] };
      try {
        const locations = await sdk.client.listLocations(studio.brandSlug);
        const resolved = (locations as Array<Record<string, unknown>>).find(
          (location) => String(location.id) === locationId,
        );
        const meetings = await sdk.client.listMeetings({
          locationId,
          from: date,
          to: nextDayIso(date),
        });
        return {
          status: "ok",
          items: meetings.flatMap((meeting) => {
            const time = meeting.startsAt?.match(/T(\d{2}:\d{2})/)?.[1];
            if (!time) return [];
            return [{
              time,
              className: meeting.serviceName ?? meeting.name ?? "Clase",
              coach: meeting.staffName ?? "",
              availableSpots: typeof meeting.available === "number" ? Math.max(0, meeting.available) : null,
              meetingId: meeting.id,
              brandSlug: meeting.brandSlug ?? studio.brandSlug,
              locationSlug:
                meeting.locationSlug ??
                meeting.location?.slug ??
                (typeof resolved?.slug === "string" ? resolved.slug : studio.slug),
            }];
          }),
        };
      } catch {
        return { status: "upstream_error", items: [] };
      }
    },
    openAccount() {
      if (!sdk || !config.capabilities.account) return { opened: false, fallback: true };
      try {
        sdk.openAccount();
        return { opened: true, fallback: false };
      } catch {
        return { opened: false, fallback: true };
      }
    },
    async buyProduct(product) {
      if (
        !sdk ||
        !config.capabilities.packages ||
        (product.type === "membership" && !config.capabilities.memberships)
      ) {
        return { opened: false, fallback: true };
      }

      const numericId = Number(product.id);
      if (typeof sdk.openCheckout === "function" && Number.isFinite(numericId)) {
        try {
          const locationId = Number(product.locationId);
          sdk.openCheckout({
            brandSlug: product.brandSlug,
            locationId: Number.isFinite(locationId) ? locationId : undefined,
            preselect: { type: product.type, id: numericId },
            skipCatalog: true,
          });
          const opened = await waitForModal();
          return { opened, fallback: !opened };
        } catch {
          return { opened: false, fallback: true };
        }
      }

      if (typeof document === "undefined") return { opened: false, fallback: true };

      const button = document.createElement("button");
      button.type = "button";
      button.hidden = true;
      button.tabIndex = -1;
      button.setAttribute("data-gf-buy", "");
      button.setAttribute(product.type === "combo" ? "data-gf-combo-id" : "data-gf-membership-id", product.id);
      button.setAttribute("data-gf-brand", product.brandSlug);
      button.setAttribute("data-gf-location-id", product.locationId);
      document.body.appendChild(button);
      try {
        requestSdkReinit();
        sdk.enablePurchaseButtons?.(document.body);
        await new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            return;
          }
          resolve();
        });
        button.click();
        const opened = await waitForModal();
        return { opened, fallback: !opened };
      } catch {
        return { opened: false, fallback: true };
      } finally {
        const remove = () => button.remove();
        if (typeof window !== "undefined") window.setTimeout(remove, 5_000);
        else remove();
      }
    },
    async reserveMeeting(item) {
      if (
        !sdk ||
        !config.capabilities.directReservation ||
        !config.capabilities.schedule ||
        !item.meetingId ||
        !item.brandSlug ||
        !item.locationSlug
      ) {
        return { opened: false, fallback: true };
      }
      try {
        const opener = sdk.openReservationCheckout ?? sdk.client.openReservationCheckout;
        if (!opener) return { opened: false, fallback: true };
        await opener({
          meetingId: item.meetingId,
          brandSlug: item.brandSlug,
          locationSlug: item.locationSlug,
        });
        const opened = await waitForModal();
        return { opened, fallback: !opened };
      } catch {
        return { opened: false, fallback: true };
      }
    },
    openCalendar(locationId, date) {
      if (!config.capabilities.schedule || !config.fallbacks.calendar) return;
      if (typeof window === "undefined") {
        navigate(route(config, webview, "calendar"));
        return;
      }
      const url = new URL(route(config, webview, "calendar"), window.location.origin);
      if (locationId) url.searchParams.set("location", locationId);
      if (date) url.searchParams.set("date", date);
      window.location.assign(resolveHardPath(`${url.pathname}${url.search}${url.hash}`));
    },
    openPackages() {
      if (!config.capabilities.packages || !config.fallbacks.packages) return;
      navigate(route(config, webview, "packages"));
    },
    openWhatsapp() {
      const url = `https://wa.me/${config.contact.whatsapp}`;
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      navigate(url);
    },
  };
}
