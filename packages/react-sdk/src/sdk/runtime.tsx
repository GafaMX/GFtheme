import React, { type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseSdkConfig, type GafaSdkConfigInput, type GafaSdkConfig } from "./config";
import { createGafaClient } from "./client/gafaClient";
import type { CartLineType, CheckoutPayload, GafaClient, ReservationCheckoutPayload } from "./client/types";
import { createLegacyGafaFitAdapter } from "./client/legacyGafaFitAdapter";
import { createHttpGafaClient } from "./client/httpGafaClient";
import { createCaptchaProvider } from "./captcha/CaptchaProvider";
import { subscribeToAuthChanges, configureTokenStorage } from "./client/tokenStorage";
import { ThemeProvider } from "./theme/theme";
import { AuthWidget, type AuthWidgetProps } from "./widgets/AuthWidget";
import { CalendarWidget, type CalendarWidgetProps } from "./widgets/CalendarWidget";
import { CatalogWidget, type CatalogWidgetProps } from "./widgets/CatalogWidget";
import { ProfileWidget, type ProfileWidgetProps } from "./widgets/ProfileWidget";
import { AccountModal, type AccountModalProps } from "./widgets/AccountModal";
import { CheckoutModal, type CheckoutModalProps } from "./widgets/CheckoutModal";
import { ReservationLauncher, type ReservationLauncherProps } from "./widgets/ReservationLauncher";
import { PurchaseButtonWidget, type PurchaseButtonWidgetProps } from "./widgets/PurchaseButtonWidget";
import { HeaderControls, type HeaderControlsProps } from "./widgets/HeaderControls";
import { bootstrapPurchaseButtons } from "./cart/purchaseButtons";
import { useCartStore } from "./cart/cartStore";
import { prefetchCheckoutCatalog } from "./cart/checkoutCatalog";
import { setGafaPayFrontUrl } from "./payments/gafaPay";
import { ImagesProvider } from "./images/ImagesProvider";
import { createSdkTracker, type SdkTracker } from "./analytics/tracker";
import { instrumentClient } from "./analytics/instrumentClient";
import "./theme/theme.css";
import "./widgets/widgets.css";

export type GafaSdk = {
  config: GafaSdkConfig;
  client: GafaClient;
  mountCalendar(target: string | Element, props?: CalendarWidgetProps): MountedWidget;
  mountAuth(target: string | Element, props?: AuthWidgetProps): MountedWidget;
  mountCatalog(target: string | Element, props?: CatalogWidgetProps): MountedWidget;
  mountProfile(target: string | Element, props?: ProfileWidgetProps): MountedWidget;
  mountPurchaseButton(target: Element, props?: PurchaseButtonWidgetProps): MountedWidget;
  /**
   * Iconos de header (Mi cuenta + carrito). Es lo que va en el
   * `[data-gf-theme="login-register"]` de los sitios viejos: el login entero
   * se abre en popup, no se pinta el formulario en la barra.
   */
  mountHeaderControls(target: string | Element, props?: HeaderControlsMountProps): MountedWidget;
  /** Abre la cuenta (login o perfil) en un popup sobre la pagina actual. */
  openAccount(props?: AccountModalOptions): { close(): void };
  /** Abre el checkout (carrito + pago) sobre la pagina actual. */
  openCheckout(props?: CheckoutOptions): { close(): void };
  /**
   * Abre la reserva de UNA clase por id, igual que un clic en el calendario:
   * login si hace falta, detalle con mapa y creditos, y checkout si no hay con
   * que pagarla.
   */
  openReservation(props: ReservationOptions): { close(): void };
  /**
   * Activa los botones de compra en HTML plano ([data-gf-buy] con
   * data-gf-combo-id / data-gf-membership-id / data-gf-product-id).
   */
  enablePurchaseButtons(root?: Document | Element): () => void;
  /** Eventos de uso hacia el SDK Hub. Nunca tira si el Hub está caído. */
  track: SdkTracker["track"];
  heartbeat(widgets: string[]): void;
  unmountAll(): void;
};

export type AccountModalOptions = Omit<AccountModalProps, "client" | "captcha" | "open" | "onClose">;
export type CheckoutOptions = Omit<CheckoutModalProps, "client" | "onClose">;
export type ReservationOptions = Omit<ReservationLauncherProps, "client" | "captcha" | "onClose"> & {
  onClose?: () => void;
};
export type HeaderControlsMountProps = Pick<HeaderControlsProps, "showCart"> & AccountModalOptions;

export type MountedWidget = {
  root: Root;
  element: Element;
  unmount(): void;
};

export type RuntimeOptions = {
  client?: GafaClient;
  useMockClient?: boolean;
};

/** Un solo fancy a la vez: dos instancias del SDK (React StrictMode, cambio
 *  de tema) no deben apilar overlays oscuros. */
let activeCheckout: { close(): void } | null = null;
let activeAccount: { close(): void } | null = null;
let activeReservation: { close(): void } | null = null;
let purchaseButtonsStop: (() => void) | null = null;

function checkoutFromCart(): CheckoutOptions {
  const { lines } = useCartStore.getState();
  const first = lines[0];
  return {
    skipCatalog: lines.length > 0,
    brandSlug: first?.brandSlug,
    locationSlug: lines.find((line) => line.locationSlug)?.locationSlug,
  };
}

function silenceLegacyFancy() {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>('[data-gf-theme="fancy"]').forEach((node) => {
    node.classList.remove("active", "show");
  });
}

export function createGafaSdk(input: GafaSdkConfigInput, options: RuntimeOptions = {}): GafaSdk {
  const config = parseSdkConfig(input);
  configureTokenStorage(config.apiBaseUrl);
  setGafaPayFrontUrl(config.gafaPayFrontUrl);
  const tracker = createSdkTracker({
    hubUrl: config.hubUrl,
    companyId: config.companyId,
    brandId: config.brandId,
    enabled: config.analyticsEnabled,
  });
  const rawClient = options.client ?? createClient(config, options);
  const client = instrumentClient(rawClient, tracker);
  const captcha = createCaptchaProvider(config.captchaProvider, config.captchaPublicKey);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1
      }
    }
  });
  // Login/logout invalidan toda la cache: perfil, creditos y reservas cambian
  // con la sesion, y pueden haberse cacheado antes de autenticar.
  subscribeToAuthChanges(() => queryClient.invalidateQueries());
  const mounts = new Set<MountedWidget>();
  prefetchCheckoutCatalog(queryClient, client);
  const unsubCartWarm = useCartStore.subscribe(() => {
    prefetchCheckoutCatalog(queryClient, client);
  });

  function mount(target: string | Element, node: ReactNode): MountedWidget {
    const element = resolveTarget(target);
    const root = createRoot(element);
    const mounted: MountedWidget = {
      root,
      element,
      unmount() {
        root.unmount();
        mounts.delete(mounted);
      }
    };

    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <ImagesProvider images={config.images} apiBaseUrl={config.apiBaseUrl}>
            <ThemeProvider
              theme={config.theme}
              storageScope={`${config.companyId}:${config.publicClientId ?? "x"}`}
            >
              {node}
            </ThemeProvider>
          </ImagesProvider>
        </QueryClientProvider>
      </React.StrictMode>
    );

    mounts.add(mounted);
    return mounted;
  }

  const sdk: GafaSdk = {
    config,
    client,
    mountCalendar(target, props = {}) {
      tracker.track({ event: "widget.mounted", widget: "meetings-calendar" });
      tracker.track({ event: "calendar.viewed", widget: "meetings-calendar" });
      return mount(target, <CalendarWidget client={client} captcha={captcha} {...props} />);
    },
    mountAuth(target, props = {}) {
      tracker.track({ event: "widget.mounted", widget: "auth" });
      return mount(target, <AuthWidget client={client} captcha={captcha} {...props} />);
    },
    mountCatalog(target, props = {}) {
      tracker.track({ event: "widget.mounted", widget: "catalog" });
      return mount(target, <CatalogWidget client={client} {...props} />);
    },
    mountProfile(target, props = {}) {
      tracker.track({ event: "widget.mounted", widget: "profile" });
      const { onExplorePackages, ...rest } = props;
      return mount(
        target,
        <ProfileWidget
          client={client}
          hubUrl={config.hubUrl}
          companyId={config.companyId}
          onExplorePackages={
            onExplorePackages ??
            (() =>
              sdk.openCheckout({
                brandSlug: rest.brandSlug,
                skipCatalog: false,
              }))
          }
          {...rest}
        />,
      );
    },
    mountPurchaseButton(target, props = {}) {
      const { comboId, membershipId, productId, locationId, ...rest } = props;
      const preselect = comboId
        ? { type: "combo" as const, id: Number(comboId) }
        : membershipId
          ? { type: "membership" as const, id: Number(membershipId) }
          : productId
            ? { type: "product" as const, id: Number(productId) }
            : null;
      return mount(
        target,
        <PurchaseButtonWidget
          client={client}
          hostElement={target}
          comboId={comboId}
          membershipId={membershipId}
          productId={productId}
          locationId={locationId}
          {...rest}
          onOpenCheckout={() =>
            sdk.openCheckout({
              brandSlug: rest.brandSlug,
              locationId: locationId != null ? Number(locationId) : undefined,
              preselect,
              skipCatalog: Boolean(preselect),
            })
          }
        />,
      );
    },
    mountHeaderControls(target, props = {}) {
      let account: { close(): void } | null = null;
      let checkout: { close(): void } | null = null;
      const { showCart, ...accountProps } = props;

      return mount(
        target,
        <HeaderControls
          client={client}
          showCart={showCart}
          onOpenAccount={() => {
            account?.close();
            account = sdk.openAccount(accountProps);
          }}
          onOpenCart={() => {
            checkout?.close();
            checkout = sdk.openCheckout(checkoutFromCart());
          }}
        />,
      );
    },
    openAccount(props = {}) {
      const host = document.createElement("div");
      document.body.appendChild(host);

      const close = () => {
        if (activeAccount === handle) activeAccount = null;
        // El cierre viene de un handler de React: desmontar la raiz en el mismo
        // tick tira "synchronously unmount a root while React was rendering".
        queueMicrotask(() => {
          mounted.unmount();
          host.remove();
        });
      };

      activeAccount?.close();
      const handle = { close };
      activeAccount = handle;

      const { onExplorePackages, ...rest } = props;
      const mounted = mount(
        host,
        <AccountModal
          client={client}
          captcha={captcha}
          open
          onClose={close}
          hubUrl={config.hubUrl}
          companyId={config.companyId}
          onExplorePackages={
            onExplorePackages ??
            (() =>
              sdk.openCheckout({
                brandSlug: rest.brandSlug,
                skipCatalog: false,
              }))
          }
          {...rest}
        />,
      );

      return handle;
    },
    openCheckout(props = {}) {
      tracker.track({ event: "checkout.opened", widget: "checkout" });
      silenceLegacyFancy();
      prefetchCheckoutCatalog(queryClient, client, props.brandSlug);
      const host = document.createElement("div");
      document.body.appendChild(host);

      const close = () => {
        if (activeCheckout === handle) activeCheckout = null;
        // Igual que openAccount: desmontar en el mismo tick del handler de
        // React revienta con "synchronously unmount a root while rendering".
        queueMicrotask(() => {
          mounted.unmount();
          host.remove();
        });
      };

      activeCheckout?.close();
      const handle = { close };
      activeCheckout = handle;

      const mounted = mount(
        host,
        <CheckoutModal
          client={client}
          {...props}
          onClose={close}
          gafaPayFrontUrl={props.gafaPayFrontUrl ?? config.gafaPayFrontUrl}
          showMembershipOptions={props.showMembershipOptions ?? config.showMembershipOptions}
        />,
      );

      return handle;
    },
    openReservation({ onClose, ...props }) {
      tracker.track({
        event: "calendar.meeting_opened",
        widget: "calendar",
        props: { meeting_id: props.meetingId },
      });
      silenceLegacyFancy();
      const host = document.createElement("div");
      document.body.appendChild(host);

      const close = () => {
        if (activeReservation === handle) activeReservation = null;
        // Igual que openCheckout: desmontar en el mismo tick del handler de
        // React revienta con "synchronously unmount a root while rendering".
        queueMicrotask(() => {
          mounted.unmount();
          host.remove();
        });
        onClose?.();
      };

      activeReservation?.close();
      const handle = { close };
      activeReservation = handle;

      const mounted = mount(
        host,
        <ReservationLauncher client={client} captcha={captcha} {...props} onClose={close} />,
      );

      return handle;
    },
    enablePurchaseButtons(root) {
      purchaseButtonsStop?.();

      const stop = bootstrapPurchaseButtons({
        root,
        onPurchase: (intent) => {
          tracker.track({
            event: "purchase_button.clicked",
            widget: "purchase-button",
            props: { type: intent.type, id: intent.id },
          });
          sdk.openCheckout({
            brandSlug: intent.brandSlug,
            locationSlug: intent.locationSlug,
            locationId: intent.locationId,
            preselect: { type: intent.type, id: intent.id },
            skipCatalog: true,
          });
        },
        onReserve: (intent) => {
          sdk.openReservation({
            meetingId: intent.meetingId,
            brandSlug: intent.brandSlug,
            locationSlug: intent.locationSlug,
            locationId: intent.locationId,
          });
        },
        onOpenCart: () => sdk.openCheckout(checkoutFromCart()),
        onOpenAccount: () => {
          sdk.openAccount();
        },
      });

      purchaseButtonsStop = stop;
      return () => {
        stop();
        if (purchaseButtonsStop === stop) purchaseButtonsStop = null;
      };
    },
    track: tracker.track,
    heartbeat(widgets) {
      tracker.heartbeat(widgets);
    },
    unmountAll() {
      purchaseButtonsStop?.();
      purchaseButtonsStop = null;
      unsubCartWarm();
      activeCheckout = null;
      activeAccount = null;
      activeReservation = null;
      Array.from(mounts).forEach((mounted) => mounted.unmount());
      queryClient.clear();
      tracker.flush();
    }
  };

  // `client.openCheckout` / `client.openReservationCheckout` eran el unico
  // puente al fancy legacy y tiraban error sin el script viejo en la pagina.
  // Las integraciones que ya los llaman ahora abren los modales nativos.
  sdk.client = bridgeLegacyCheckout(client, sdk);

  return sdk;
}

/**
 * Adapta el contrato viejo del cliente (payload del fancy de gafa.fit) a los
 * modales nativos de v2. Se envuelve, no se muta: los widgets siguen usando el
 * cliente de datos tal cual.
 */
function bridgeLegacyCheckout(client: GafaClient, sdk: GafaSdk): GafaClient {
  return {
    ...client,
    async openCheckout(payload: CheckoutPayload) {
      const meetingId = readLegacyId(payload.payload, "meetings_id");

      if (meetingId != null) {
        sdk.openReservation({
          meetingId,
          brandSlug: payload.brandSlug,
          ...readLegacyLocation(payload.locationId),
        });
        return;
      }

      const preselect = readLegacyPreselect(payload.payload);
      sdk.openCheckout({
        brandSlug: payload.brandSlug,
        ...readLegacyLocation(payload.locationId),
        preselect,
        skipCatalog: Boolean(preselect),
      });
    },
    async openReservationCheckout(payload: ReservationCheckoutPayload) {
      sdk.openReservation({
        meetingId: payload.meetingId,
        brandSlug: payload.brandSlug,
        locationSlug: payload.locationSlug,
      });
    },
  };
}

const LEGACY_PRESELECT_KEYS: Array<[CartLineType, string]> = [
  ["combo", "combos_id"],
  ["membership", "memberships_id"],
  ["product", "products_id"],
];

function readLegacyPreselect(payload: Record<string, unknown>): { type: CartLineType; id: number } | null {
  for (const [type, key] of LEGACY_PRESELECT_KEYS) {
    const id = readLegacyId(payload, key);
    if (id != null) return { type, id };
  }
  return null;
}

function readLegacyId(payload: Record<string, unknown> | undefined, key: string): number | null {
  const raw = payload?.[key];
  if (raw == null) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

/** El contrato viejo manda un solo campo que puede ser id numerico o slug. */
function readLegacyLocation(location?: string | number): { locationId?: number; locationSlug?: string } {
  if (location == null || location === "") return {};
  const id = Number(location);
  return Number.isFinite(id) ? { locationId: id } : { locationSlug: String(location) };
}

function createClient(config: GafaSdkConfig, options: RuntimeOptions): GafaClient {
  if (options.useMockClient) {
    return createGafaClient(config);
  }

  // El cliente HTTP nuevo cubre catalogo/calendario/login/registro/password en directo
  // contra la API de gafa.fit. Solo openCheckout/openReservationCheckout (el "fancy") siguen
  // sin reconstruir: si el script legacy window.GafaFitSDK esta presente, se usa como
  // fallback unicamente para esos dos.
  const legacy =
    typeof window !== "undefined" && window.GafaFitSDK
      ? createLegacyGafaFitAdapter(config, window.GafaFitSDK)
      : undefined;

  return createHttpGafaClient(config, legacy);
}

function resolveTarget(target: string | Element): Element {
  if (typeof target !== "string") {
    return target;
  }

  const element = document.querySelector(target);

  if (!element) {
    throw new Error(`Gafa SDK target not found: ${target}`);
  }

  return element;
}

