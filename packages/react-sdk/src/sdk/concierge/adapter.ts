import type { Meeting, ReservationPaymentOption } from "../client/types";
import { isSoldOut } from "../client/meetingAvailability";
import type { ConciergePartnerConfig, ConciergeProduct, ConciergeScheduleItem } from "./contracts";
import { whatsappNumber } from "./experience";
import { planReservationCase, type ConciergeReservationCredit, type ReservationCase } from "./reservationCase";
import type { ReservationSuccessOverlayProps } from "../widgets/ReservationSuccessOverlay";

export type ReservationSuccessOptions = Omit<ReservationSuccessOverlayProps, "onClose"> & {
  onClose?: () => void;
};

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
      hasSeatMap?: boolean;
      locationSlug?: string;
      brandSlug?: string;
      location?: { slug?: string };
    }>>;
    getMeeting?(payload: {
      meetingId: string | number;
      brandSlug?: string;
      locationSlug?: string;
    }): Promise<Meeting | null>;
    getProfile(): Promise<{ firstName?: string } | null>;
    getReservationContext?(payload: {
      meetingId: string | number;
      brandSlug: string;
      locationSlug: string;
    }): Promise<{
      meetingId: number;
      brandSlug: string;
      locationSlug: string;
      userProfileId: number;
      seatMap: unknown;
      paymentOptions: ReservationPaymentOption[];
      waitlistAvailable: boolean;
    }>;
    createReservation?(payload: {
      brandSlug: string;
      locationSlug: string;
      meetingId: string | number;
      userProfileId: number;
      selectedCredit?: string;
    }): Promise<{ reservationId: number; isWaitlist: boolean }>;
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
  openReservationSuccess?(props: ReservationSuccessOptions): { close(): void };
  enablePurchaseButtons?(root?: Document | Element): () => void;
};

export type AdapterOutcome = { opened: boolean; fallback: boolean };
export type ConfirmReservationOutcome = AdapterOutcome & {
  error?: string;
  isWaitlist?: boolean;
};
export type InspectMeetingResult =
  | { status: "ok"; plan: ReservationCase; item: ConciergeScheduleItem }
  | { status: "unavailable" };
export type AdapterScheduleResult =
  | { status: "ok"; items: ConciergeScheduleItem[] }
  | { status: "sdk_unavailable" | "upstream_error"; items: [] };

export interface ConciergeBrowserAdapter {
  getProfile(): Promise<{ firstName?: string } | null>;
  listLocations(brandSlug: string): Promise<unknown[]>;
  listMeetings(locationId: string, date: string): Promise<AdapterScheduleResult>;
  inspectMeeting(item: ConciergeScheduleItem): Promise<InspectMeetingResult>;
  confirmReservation(item: ConciergeScheduleItem, selectedCredit?: string): Promise<ConfirmReservationOutcome>;
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

function toCredits(options: ReservationPaymentOption[]): ConciergeReservationCredit[] {
  return options.map((option) => ({
    id: option.id,
    kind: option.kind,
    name: option.name,
    remaining: option.remaining,
  }));
}

function canInspectMeeting(
  config: ConciergePartnerConfig,
  item: ConciergeScheduleItem,
  sdk: ConciergeSdkBridge | null | undefined,
): boolean {
  return Boolean(
    sdk &&
    config.capabilities.directReservation &&
    config.capabilities.schedule &&
    item.meetingId &&
    item.brandSlug &&
    item.locationSlug,
  );
}

export function createConciergeBrowserAdapter(options: ConciergeAdapterOptions): ConciergeBrowserAdapter {
  const { config, sdk, navigate, resolveHardPath = (path) => path } = options;
  const webview = Boolean(options.webview);

  async function openReservationPopup(item: ConciergeScheduleItem): Promise<AdapterOutcome> {
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
  }

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
              ...(typeof meeting.hasSeatMap === "boolean" ? { hasSeatMap: meeting.hasSeatMap } : {}),
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
    async inspectMeeting(item) {
      if (!canInspectMeeting(config, item, sdk) || !sdk) {
        return { status: "unavailable" };
      }

      let signedIn: boolean | "unknown" = false;
      try {
        signedIn = Boolean(await sdk.client.getProfile());
      } catch {
        signedIn = "unknown";
      }
      if (signedIn === "unknown") {
        return {
          status: "ok",
          item,
          plan: planReservationCase({
            signedIn: true,
            hasMap: item.hasSeatMap === true,
            soldOut: item.availableSpots === 0,
            waitlistAvailable: false,
            paymentOptions: [],
            contextReady: false,
          }),
        };
      }
      if (!signedIn) {
        return {
          status: "ok",
          item,
          plan: planReservationCase({
            signedIn: false,
            hasMap: item.hasSeatMap === true,
            soldOut: item.availableSpots === 0,
            waitlistAvailable: false,
            paymentOptions: [],
            contextReady: false,
          }),
        };
      }

      const meetingId = item.meetingId!;
      const brandSlug = item.brandSlug!;
      const locationSlug = item.locationSlug!;
      const [meetingResult, contextResult] = await Promise.allSettled([
        sdk.client.getMeeting
          ? sdk.client.getMeeting({ meetingId, brandSlug, locationSlug })
          : Promise.resolve(null),
        sdk.client.getReservationContext
          ? sdk.client.getReservationContext({ meetingId, brandSlug, locationSlug })
          : Promise.resolve(null),
      ]);
      const meeting = meetingResult.status === "fulfilled" ? meetingResult.value : null;
      const context = contextResult.status === "fulfilled" ? contextResult.value : null;
      const hasMap =
        item.hasSeatMap === true ||
        meeting?.hasSeatMap === true ||
        Boolean(context?.seatMap);
      const soldOut = meeting
        ? isSoldOut({
            ...meeting,
            available: meeting.available ?? item.availableSpots ?? undefined,
          })
        : item.availableSpots === 0;

      return {
        status: "ok",
        item,
        plan: planReservationCase({
          signedIn: true,
          hasMap,
          soldOut,
          waitlistAvailable: Boolean(context?.waitlistAvailable),
          paymentOptions: context ? toCredits(context.paymentOptions) : [],
          contextReady: Boolean(context),
        }),
      };
    },
    async confirmReservation(item, selectedCredit) {
      if (!canInspectMeeting(config, item, sdk) || !sdk) {
        return { opened: false, fallback: true, error: "No pude confirmar esa reserva." };
      }
      const getContext = sdk.client.getReservationContext;
      const create = sdk.client.createReservation;
      if (!getContext || !create || !item.meetingId || !item.brandSlug || !item.locationSlug) {
        return openReservationPopup(item);
      }
      try {
        const context = await getContext({
          meetingId: item.meetingId,
          brandSlug: item.brandSlug,
          locationSlug: item.locationSlug,
        });
        const credit = selectedCredit
          ? context.paymentOptions.find((option) => option.id === selectedCredit)
          : context.paymentOptions.length === 1
            ? context.paymentOptions[0]
            : undefined;
        const result = await create({
          brandSlug: context.brandSlug,
          locationSlug: context.locationSlug,
          meetingId: context.meetingId,
          userProfileId: context.userProfileId,
          selectedCredit:
            selectedCredit ??
            (context.paymentOptions.length > 1 ? credit?.id : undefined),
        });
        sdk.openReservationSuccess?.({
          className: item.className,
          when: item.time,
          coach: item.coach,
          isWaitlist: result.isWaitlist,
          creditName: credit?.name,
          creditKind: credit?.kind,
          remainingBefore: credit?.remaining,
        });
        const opened = await waitForModal();
        return { opened: true, fallback: !opened, isWaitlist: result.isWaitlist };
      } catch (error) {
        return {
          opened: false,
          fallback: true,
          error: error instanceof Error ? error.message : "No pudimos completar la reserva.",
        };
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
      return openReservationPopup(item);
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
      const number = whatsappNumber(config);
      if (!number) return;
      const url = `https://wa.me/${number}`;
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      navigate(url);
    },
  };
}
