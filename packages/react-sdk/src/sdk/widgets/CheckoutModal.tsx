import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CartLineType,
  CatalogItem,
  CheckoutConfig,
  DiscountCodeResult,
  GafaClient,
  InitialPurchasePayload,
  Meeting,
} from "../client/types";
import {
  cartSubtotal,
  formatMoney,
  useCartStore,
  type CartLine,
  type CartReservationContext,
} from "../cart/cartStore";
import { AuthWidget, type AuthStage } from "./AuthWidget";
import { ConfirmDialog } from "./ConfirmDialog";
import type { CaptchaProvider } from "../captcha/CaptchaProvider";
import { isSoldOut, offersWaitlist } from "../client/meetingAvailability";
import {
  loadGafaPay,
  mountGafaPayWidget,
  triggerGafaPayConfirm,
  waitForWidgetContent,
  ensureLegacyPaypalCheckout,
  type GafaPayIsland,
  type GafaPayLineItem,
  type GafaPaySuccess,
  type GafaPayWidgetProps,
} from "../payments/gafaPay";
import { findPurchasableItem, sameCatalogId } from "../cart/findPurchasable";
import {
  CHECKOUT_CATALOG_STALE_MS,
  checkoutCatalogQueryKey,
  fetchCheckoutCatalog,
} from "../cart/checkoutCatalog";
import { resolveDiscountAmount } from "../cart/discountCode";
import {
  GIFT_CODE_CHECK_DEBOUNCE_MS,
  formatGiftCodeDisplay,
  generateShortGiftCode,
  giftCodeAvailability,
  isPlausibleGiftCode,
  normalizeGiftCode,
  preferShortGeneratedCode,
} from "../cart/giftCard";
import { gafaFitProductType } from "../cart/gafaFitCart";
import { resolveMoneyCurrency } from "../cart/money";
import {
  checkoutTokenFromHostedData,
  HostedCheckoutClosedError,
  pollRecurrenteUntilDone,
  watchNextPopup,
} from "../cart/recurrenteCheckout";
import {
  cartHasMembership,
  readShowMembershipOptions,
  syncGafaPayMembershipToggles,
} from "../cart/membershipPayOptions";
import { CloseIcon } from "./sdkIcons";

/** GafaPay ya cobró; reintentar "Pagar" haría un segundo cargo. */
export const CHARGED_BUT_NOT_RECORDED =
  "Tu tarjeta ya fue cobrada, pero Buq no registró la compra. No vuelvas a pagar. Pulsa «Registrar compra» para reintentar el registro sin otro cargo.";

function stagingPayWarning(): string | null {
  if (typeof window === "undefined") return null;
  const env = new URLSearchParams(window.location.search).get("buq-env");
  if (env === "staging" || env === "dev" || env === "development") {
    return "Estás en staging: GafaPay puede cobrar en el Stripe de producción. No uses una tarjeta real.";
  }
  return null;
}

export type CheckoutModalProps = {
  client: GafaClient;
  captcha?: CaptchaProvider;
  /** Sin marca/sede (compra suelta desde un boton HTML) se resuelve la primera. */
  brandSlug?: string;
  locationSlug?: string;
  /** ID numerico de sede (data-gf-location-id); se traduce a slug. */
  locationId?: number;
  locationName?: string;
  /** Si viene del calendario: pre-carga contexto de reserva. */
  meeting?: Meeting | null;
  seatObjectId?: number;
  seatLabel?: string;
  /** Producto que dispara la compra (boton HTML): se agrega solo al abrir. */
  preselect?: { type: CartLineType; id: number } | null;
  /**
   * Compra directa (COMPRAR en la pagina de paquetes): salta el catalogo
   * y abre en pagar. El socio puede volver atras para agregar mas.
   * Default: true cuando hay `preselect`.
   */
  skipCatalog?: boolean;
  gafaPayFrontUrl?: string;
  /** Default oculto. El embed también lo enciende con SHOW_MEMBERSHIP_OPTIONS. */
  showMembershipOptions?: boolean;
  onClose: () => void;
  onCompleted?: (result: { purchaseId?: number | null; reservationId?: number }) => void;
};

type CheckoutStep = "shop" | "auth" | "pay" | "thanks";
type CatalogTab = "packages" | "memberships" | "products";

/**
 * El titulo del paso de cuenta lo pone SOLO el hero del checkout (el AuthWidget
 * va sin header), asi que aqui tiene que decir cual de sus formularios se ve.
 */
const AUTH_COPY: Record<AuthStage, { title: string; description: string }> = {
  login: {
    title: "Inicia sesión para pagar",
    description: "Tu carrito te espera; solo necesitamos tu cuenta para cobrar.",
  },
  register: {
    title: "Crea tu cuenta para pagar",
    description: "Tu carrito te espera; creamos tu cuenta y seguimos con el cobro.",
  },
  "password-recovery": {
    title: "Recupera tu contraseña",
    description: "Te enviamos un correo para entrar y terminar tu compra.",
  },
  "password-reset": {
    title: "Elige tu nueva contraseña",
    description: "La guardamos, entras a tu cuenta y terminas tu compra.",
  },
};

/**
 * Checkout nativo v2 (reemplaza al Fancy legacy). Cuando nace de una clase,
 * el catalogo trae SOLO los paquetes/membresias que esa clase acepta
 * (combosSelection/membershipSelection del create-form-template).
 */
export function CheckoutModal({
  client,
  captcha,
  brandSlug: brandSlugProp,
  locationSlug: locationSlugProp,
  locationId,
  locationName,
  meeting,
  seatObjectId,
  seatLabel,
  preselect,
  skipCatalog,
  gafaPayFrontUrl,
  showMembershipOptions: showMembershipOptionsProp,
  onClose,
  onCompleted,
}: CheckoutModalProps) {
  const showMembershipOptions = readShowMembershipOptions(undefined, showMembershipOptionsProp);
  const lines = useCartStore((s) => s.lines);
  const reservation = useCartStore((s) => s.reservation);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const setAmount = useCartStore((s) => s.setAmount);
  const setReservation = useCartStore((s) => s.setReservation);
  const clearReservation = useCartStore((s) => s.clearReservation);
  const resetAfterPurchase = useCartStore((s) => s.resetAfterPurchase);
  // Si el socio quita la clase, no la re-anclamos mientras el modal siga
  // abierto con la misma reunion (el prop `meeting` no se borra solo).
  const droppedMeetingIdRef = useRef<number | null>(null);

  const persistedCart = useCartStore.getState();
  const wantsDirectPay =
    skipCatalog !== false &&
    (Boolean(preselect) || skipCatalog === true || (!meeting && persistedCart.lines.length > 0));
  const stayOnPayRef = useRef(wantsDirectPay);
  const [step, setStep] = useState<CheckoutStep>(wantsDirectPay ? "pay" : "shop");
  // Solo aplica en movil (en desktop el carrito siempre esta desplegado).
  const [cartOpen, setCartOpen] = useState(wantsDirectPay);
  const [lockedBrandSlug, setLockedBrandSlug] = useState<string | undefined>(
    brandSlugProp ?? persistedCart.lines[0]?.brandSlug,
  );
  const [preselectStatus, setPreselectStatus] = useState<"idle" | "loading" | "ready" | "miss">(
    preselect ? "loading" : "idle",
  );
  const [tab, setTab] = useState<CatalogTab>("packages");
  const [authStage, setAuthStage] = useState<AuthStage>("login");
  const [query, setQuery] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsPromptOpen, setTermsPromptOpen] = useState(false);
  const [termsAttention, setTermsAttention] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCodeResult | null>(null);
  const [discountStatus, setDiscountStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [discountError, setDiscountError] = useState<string>();
  const [convertGift, setConvertGift] = useState(false);
  const [giftCode, setGiftCode] = useState("");
  const [giftStatus, setGiftStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [giftHint, setGiftHint] = useState<string>();
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [payError, setPayError] = useState<string>();
  // El formulario del proveedor vive fuera de React. Sin el listo, "Pagar"
  // no cobra; si solo faltan los términos, el botón sí responde.
  const [paymentReady, setPaymentReady] = useState(false);
  const [paying, setPaying] = useState(false);
  /** Membresía: como v1, guardar tarjeta + renovar van ON y ocultos. */
  const [saveCard, setSaveCard] = useState(true);
  const [autoRenew, setAutoRenew] = useState(true);
  const [membershipOptsOpen, setMembershipOptsOpen] = useState(false);
  /** Stripe ya cobró; el botón deja de hablar con GafaPay y solo registra en Buq. */
  const [registerOnly, setRegisterOnly] = useState(false);
  const chargedRef = useRef(false);
  const pendingRegisterRef = useRef<{
    paymentData: unknown;
    recurring: boolean;
    subscriptionId: string | number | null;
  } | null>(null);
  const hostedPendingRef = useRef<{
    checkoutToken: string;
    purchaseId: number;
    payload: InitialPurchasePayload;
  } | null>(null);
  const hostedAbortRef = useRef<AbortController | null>(null);
  const hostedSettledRef = useRef(false);
  const stopPopupWatchRef = useRef<(() => void) | null>(null);
  const giftCheckSeq = useRef(0);
  const giftTypingRef = useRef(false);
  const giftValidateRef = useRef<
    (code: string, seq: number, options?: { regenerateIfTaken?: boolean }) => Promise<void>
  >(async () => undefined);
  const [thanks, setThanks] = useState<{
    purchaseId?: number | null;
    reservationId?: number;
    /** undefined mientras gafa.fit confirma; false si se quedó sin resolver. */
    confirmed?: boolean;
    isWaitlist?: boolean;
    reservationSnapshot: CartReservationContext | null;
    linesSnapshot: CartLine[];
  } | null>(null);

  // Compra suelta (boton HTML): sin marca/sede explicitas se toma la primera
  // de la compañia, que es lo que un sitio de un solo estudio espera.
  const brandsQuery = useQuery({
    queryKey: ["checkout", "brands"],
    queryFn: () => client.listBrands(),
    staleTime: 300_000,
  });
  const brandSlug = lockedBrandSlug ?? brandSlugProp ?? lines[0]?.brandSlug ?? brandsQuery.data?.[0]?.slug;

  const locationsQuery = useQuery({
    queryKey: ["checkout", "locations", brandSlug],
    queryFn: () => client.listLocations(brandSlug),
    enabled: Boolean(brandSlug) && (!locationSlugProp || locationId != null),
    staleTime: 300_000,
  });
  const locationFromId =
    locationId != null
      ? locationsQuery.data?.find((location) => sameCatalogId(location.id, locationId))
      : undefined;
  const locationSlug =
    locationSlugProp ??
    locationFromId?.slug ??
    lines.find((line) => line.locationSlug)?.locationSlug ??
    locationsQuery.data?.[0]?.slug;
  const resolvedLocationName =
    locationName ?? locationFromId?.name ?? (locationSlugProp ? undefined : locationsQuery.data?.[0]?.name);

  function dropPendingClass() {
    if (meeting?.id != null) droppedMeetingIdRef.current = Number(meeting.id);
    clearReservation();
  }

  // Compra con clase anclada (chip / catalogo recortado). False si la quitaron
  // para pagar el paquete sin reservar todavia.
  const classAttached =
    Boolean(reservation) ||
    (meeting != null && droppedMeetingIdRef.current !== Number(meeting.id));
  const waitlistPurchase = Boolean(
    classAttached && meeting && (offersWaitlist(meeting) || isSoldOut(meeting)),
  );

  // Al abrir desde una clase: anclar el contexto de reserva al carrito.
  useEffect(() => {
    if (!meeting || !brandSlug || !locationSlug) return;
    const meetingId = Number(meeting.id);
    if (droppedMeetingIdRef.current === meetingId) return;
    setReservation({
      meetingId,
      meetingName: meeting.name,
      serviceName: meeting.service?.name ?? meeting.serviceName,
      startsAt: meeting.startsAt ?? meeting.start ?? meeting.startTime ?? "",
      timezone: meeting.timezone,
      brandSlug,
      locationSlug,
      locationName: locationName ?? meeting.location?.name,
      staffName: meeting.staffName,
      seatObjectId,
      seatLabel,
    });
  }, [meeting, brandSlug, locationSlug, locationName, seatObjectId, seatLabel, setReservation]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // El catalogo se puede ver SIN sesion: el login se pide al ir a pagar, no
  // al abrir. Comprar desde un boton de la pagina no deberia empezar con un
  // muro de login ni con un error de catalogo.
  const profileQuery = useQuery({
    queryKey: ["checkout", "profile"],
    queryFn: () => client.getProfile(),
    staleTime: 60_000,
  });
  const isSignedIn = Boolean(profileQuery.data);

  const configQuery = useQuery({
    queryKey: ["checkout", "config", brandSlug, locationSlug, classAttached ? meeting?.id : undefined],
    queryFn: async () => {
      try {
        return await client.getCheckoutConfig!({
          brandSlug: brandSlug!,
          locationSlug: locationSlug!,
          meetingId: classAttached ? meeting?.id : undefined,
        });
      } catch (error) {
        // Clase llena / waitlist: el create-form a veces no arma el fancy y
        // el catálogo queda vacío. Reintentamos la sede sin anclar la clase.
        if (classAttached && meeting?.id != null) {
          return client.getCheckoutConfig!({
            brandSlug: brandSlug!,
            locationSlug: locationSlug!,
          });
        }
        throw error;
      }
    },
    enabled: Boolean(client.getCheckoutConfig && brandSlug && locationSlug && isSignedIn),
    staleTime: 60_000,
    retry: 1,
  });

  const config = configQuery.data;
  const paymentMethods = config?.paymentMethods ?? [];
  const hasTerms = Boolean(config?.termsConditionsLink);

  // Compra suelta: el catalogo de la MARCA (listCombos), no el recorte de la
  // sede en create-form-template. Si no, un paquete de Lomas no aparece cuando
  // el checkout resolvio Cancun como primera sede.
  const catalogQuery = useQuery({
    queryKey: checkoutCatalogQueryKey(brandSlug),
    queryFn: () => fetchCheckoutCatalog(client, brandSlug!),
    enabled: Boolean(brandSlug) && (!classAttached || configQuery.isError),
    staleTime: CHECKOUT_CATALOG_STALE_MS,
  });

  const combos = classAttached
    ? ((config?.combos?.length ? config.combos : catalogQuery.data?.combos) ?? [])
    : (catalogQuery.data?.combos ?? config?.combos ?? []);
  const memberships = classAttached
    ? ((config?.memberships?.length ? config.memberships : catalogQuery.data?.memberships) ?? [])
    : (catalogQuery.data?.memberships ?? config?.memberships ?? []);
  const products = config?.products ?? [];
  const catalogCurrency = useMemo(() => {
    for (const item of [...combos, ...memberships, ...products]) {
      const resolved = resolveMoneyCurrency(item.raw?.currency ?? item.currency);
      if (resolved) return resolved;
    }
    return null;
  }, [combos, memberships, products]);
  const brandCurrency = brandsQuery.data?.find((brand) => brand.slug === brandSlug)?.currency;
  const currency =
    config?.currency ?? brandCurrency ?? catalogCurrency ?? { prefix: "$", suffix: "MXN", code: "MXN" };

  // Query deshabilitada (todavia no hay marca) reporta isLoading=false y el
  // catalogo vacio: eso pintaba "no hay paquetes" / "esta clase no tiene..."
  // antes de pedir nada. Skeleton hasta que haya fetch real (exito o error).
  const catalogBusy = classAttached
    ? (!configQuery.isFetched && !configQuery.isError && (profileQuery.isPending || Boolean(isSignedIn))) ||
      (configQuery.isError && !catalogQuery.isFetched && !catalogQuery.isError)
    : !catalogQuery.isFetched && !catalogQuery.isError;

  useEffect(() => {
    if (selectedMethodId != null) return;
    if (paymentMethods[0]) setSelectedMethodId(paymentMethods[0].id);
  }, [paymentMethods, selectedMethodId]);

  const selectedMethod = paymentMethods.find((method) => method.id === selectedMethodId) ?? null;

  const search = query.trim().toLowerCase();

  const catalogItems = useMemo(() => {
    if (search) return [];
    return tab === "packages" ? combos : tab === "memberships" ? memberships : products;
  }, [tab, combos, memberships, products, search]);

  /**
   * Buscar no depende de la pestaña activa: escribir "mem" desde Paquetes
   * tiene que encontrar la membresia igual. Los resultados salen agrupados
   * por tipo para no perder el contexto.
   */
  const searchGroups = useMemo(() => {
    if (!search) return null;
    const match = (items: CatalogItem[]) =>
      items.filter((item) => item.name.toLowerCase().includes(search));
    return [
      { key: "packages" as const, label: "Paquetes", items: match(combos) },
      { key: "memberships" as const, label: "Membresías", items: match(memberships) },
      { key: "products" as const, label: "Productos", items: match(products) },
    ].filter((group) => group.items.length > 0);
  }, [search, combos, memberships, products]);

  const searchTotal = searchGroups?.reduce((sum, group) => sum + group.items.length, 0) ?? 0;

  const relevantLines = classAttached
    ? lines.filter((line) => !brandSlug || line.brandSlug === brandSlug)
    : lines;
  const membershipPurchase = cartHasMembership(relevantLines);
  const subtotal = cartSubtotal(relevantLines);
  const discountAmount = resolveDiscountAmount(appliedDiscount, subtotal);
  const discountLabel = appliedDiscount?.label;
  const total = Math.max(0, subtotal - discountAmount);
  const envWarning = step === "pay" ? stagingPayWarning() : null;
  const cartCount = relevantLines.reduce((sum, line) => sum + line.amount, 0);

  const waitingOnTerms = hasTerms && !termsAccepted;
  const waitingOnGift = convertGift && giftStatus !== "ok";
  const canPay =
    relevantLines.length > 0 &&
    Boolean(selectedMethod) &&
    paymentReady &&
    !waitingOnTerms &&
    !waitingOnGift &&
    !paying;

  function resolvedGiftCode(): string | null {
    if (!convertGift || giftStatus !== "ok") return null;
    return normalizeGiftCode(giftCode) || null;
  }

  async function applyDiscount() {
    if (!client.checkDiscountCode || !discountCode.trim() || !brandSlug || !locationSlug) return;
    setDiscountStatus("checking");
    setDiscountError(undefined);
    setAppliedDiscount(null);
    try {
      const result = await client.checkDiscountCode({
        brandSlug,
        locationSlug,
        code: discountCode.trim(),
        userProfileId: config?.userProfileId ?? profileQuery.data?.id,
        urlTemplate: config?.urls.checkDiscountCode,
        lines: relevantLines.map((line) => ({ id: line.id, type: line.type })),
      });
      if (!result.valid) {
        setDiscountStatus("error");
        setDiscountError(result.message ?? "Código no válido");
        return;
      }
      setAppliedDiscount(result);
      setDiscountStatus("ok");
    } catch {
      setDiscountStatus("error");
      setDiscountError("Código no válido");
    }
  }

  giftValidateRef.current = async (code, seq, options) => {
    const compact = normalizeGiftCode(code);
    if (!isPlausibleGiftCode(compact)) {
      if (seq !== giftCheckSeq.current) return;
      setGiftStatus("error");
      setGiftHint(compact ? "código no válido" : "escribe un código");
      return;
    }
    if (!client.checkGiftCode || !brandSlug || !locationSlug) {
      if (seq !== giftCheckSeq.current) return;
      setGiftStatus("ok");
      setGiftHint("código válido");
      return;
    }
    setGiftStatus("checking");
    setGiftHint("revisando…");
    try {
      const check = async (candidate: string) =>
        client.checkGiftCode!({
          brandSlug,
          locationSlug,
          code: candidate,
          urlTemplate: config?.urls.checkGiftCode,
        });

      let availability = giftCodeAvailability(await check(compact));
      if (seq !== giftCheckSeq.current) return;

      if (availability.status === "taken" && options?.regenerateIfTaken) {
        for (let i = 0; i < 4; i += 1) {
          const next = generateShortGiftCode();
          setGiftCode(formatGiftCodeDisplay(next));
          availability = giftCodeAvailability(await check(next));
          if (seq !== giftCheckSeq.current) return;
          if (availability.status === "available") {
            setGiftStatus("ok");
            setGiftHint("código válido");
            return;
          }
        }
      }

      if (availability.status === "available") {
        setGiftStatus("ok");
        setGiftHint("código válido");
        return;
      }
      setGiftStatus("error");
      setGiftHint(availability.message);
    } catch {
      if (seq !== giftCheckSeq.current) return;
      setGiftStatus("error");
      setGiftHint("no pudimos validar el código");
    }
  };

  async function assignGeneratedGiftCode() {
    giftTypingRef.current = false;
    const seq = ++giftCheckSeq.current;
    setGiftStatus("checking");
    setGiftHint("generando…");
    let candidate = generateShortGiftCode();
    if (client.generateGiftCode && brandSlug && locationSlug) {
      try {
        const server = await client.generateGiftCode({
          brandSlug,
          locationSlug,
          urlTemplate: config?.urls.generateGiftCode,
        });
        if (seq !== giftCheckSeq.current) return;
        candidate = preferShortGeneratedCode(server);
      } catch {
        if (seq !== giftCheckSeq.current) return;
      }
    }
    setGiftCode(formatGiftCodeDisplay(candidate));
    await giftValidateRef.current(candidate, seq, { regenerateIfTaken: true });
  }

  function handleAdd(item: CatalogItem) {
    if (!brandSlug) return;
    const type: CartLineType =
      item.type === "membership" ? "membership" : item.type === "product" ? "product" : "combo";
    const price = item.priceFinal ?? item.price ?? 0;
    addItem({
      id: item.id,
      type,
      name: item.name,
      price,
      priceLabel: formatMoney(price, currency.prefix, ""),
      brandSlug,
      locationSlug,
      expirationLabel: item.expirationDays ? `Expira en ${item.expirationDays} días` : undefined,
      raw: item.raw,
    });
  }

  // Boton HTML de compra: el ID llega solo. Se busca en TODAS las marcas de
  // la compañia (no solo la primera sede) y se agrega UNA vez.
  const preselectDone = useRef(false);
  useEffect(() => {
    if (!preselect || preselectDone.current) return;
    let cancelled = false;
    setPreselectStatus("loading");
    void findPurchasableItem(client, preselect, brandSlugProp ?? lockedBrandSlug).then((match) => {
      if (cancelled) return;
      if (!match) {
        setPreselectStatus("miss");
        stayOnPayRef.current = false;
        setStep("shop");
        return;
      }
      preselectDone.current = true;
      setLockedBrandSlug(match.brandSlug);
      setTab(match.type === "membership" ? "memberships" : match.type === "product" ? "products" : "packages");
      const price = match.item.priceFinal ?? match.item.price ?? 0;
      addItem({
        id: match.item.id,
        type: match.type,
        name: match.item.name,
        price,
        priceLabel: formatMoney(price, currency.prefix, ""),
        brandSlug: match.brandSlug,
        locationSlug: locationSlugProp,
        expirationLabel: match.item.expirationDays ? `Expira en ${match.item.expirationDays} días` : undefined,
        raw: match.item.raw,
      });
      setPreselectStatus("ready");
    });
    return () => {
      cancelled = true;
    };
    // currency.prefix es estable por marca; addItem viene del store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect, client, brandSlugProp]);

  useEffect(() => {
    return () => {
      hostedAbortRef.current?.abort();
      stopPopupWatchRef.current?.();
    };
  }, []);

  // Compra directa: login si falta, si no el paso de pago. Si el socio vuelve
  // al catalogo a proposito, ya no lo empujamos otra vez a pagar.
  useEffect(() => {
    if (!stayOnPayRef.current) return;
    if (step === "shop" || step === "thanks") return;
    if (profileQuery.isLoading) return;
    const next: CheckoutStep = isSignedIn ? "pay" : "auth";
    if (step !== next) setStep(next);
  }, [isSignedIn, profileQuery.isLoading, step]);

  useEffect(() => {
    if (!convertGift || !giftTypingRef.current) return;
    const seq = ++giftCheckSeq.current;
    const handle = window.setTimeout(() => {
      void giftValidateRef.current(giftCode, seq);
    }, GIFT_CODE_CHECK_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [giftCode, convertGift]);

  /** Segunda mitad del pago: con payment_data ya tokenizado por GafaPay. */
  async function completePurchase(
    paymentData: unknown,
    recurring = false,
    subscriptionId: string | number | null = null,
  ) {
    const profile = profileQuery.data;
    const reservationSnapshot = reservation;
    const linesSnapshot = relevantLines;

    // Carritos guardados antes de que las líneas cargaran `raw` (localStorage)
    // no traen el JSON del API: se resuelve del catálogo de la sede al pagar.
    const rawFor = (line: CartLine): Record<string, unknown> | undefined => {
      if (line.raw) return line.raw;
      const pools =
        line.type === "membership"
          ? [memberships, config?.memberships ?? []]
          : line.type === "product"
            ? [products, config?.products ?? []]
            : [combos, config?.combos ?? []];
      for (const pool of pools) {
        const hit = pool.find((item) => sameCatalogId(item.id, line.id));
        if (hit?.raw) return hit.raw;
      }
      return undefined;
    };

    try {
      if (!profile || !client.reservatePurchase || !selectedMethod || !brandSlug || !locationSlug) {
        throw new Error("No pudimos completar la compra. Recarga e inténtalo de nuevo.");
      }

      // Fancy v1 (Stripe): GafaPay cobra → BuySystemStep POSTea a `/reservate`.
      // Eso dispara paymentByCard / paymentByToken. `initial-purchase` es Recurrente
      // y en producción cae en unpaidPurchase (TypeError $subscribe null).
      const purchase = await client.reservatePurchase({
        brandSlug,
        locationSlug,
        userId: config?.userProfileId ?? profile.id,
        meetingId: reservation?.meetingId,
        lines: linesSnapshot.map((line) => ({
          id: line.id,
          type: line.type,
          amount: line.amount,
          name: line.name,
          price: line.price,
          companiesId: config?.companiesId,
          raw: rawFor(line),
        })),
        paymentTypeId: selectedMethod.id,
        paymentData,
        subscriptionId,
        csrfToken: config?.csrfToken ?? null,
        discountCode: discountStatus === "ok" ? discountCode.trim() : null,
        giftCode: resolvedGiftCode(),
        subscribe: membershipPurchase ? autoRenew : recurring,
        setPayment: membershipPurchase ? saveCard : recurring,
        seatObjectId: reservation?.seatObjectId,
      });

      const purchaseId = purchase.purchaseId;
      const reservationId = purchase.reservationId;
      setThanks({
        purchaseId,
        reservationId,
        confirmed: true,
        isWaitlist: Boolean(purchase.isWaitlist) || waitlistPurchase,
        reservationSnapshot,
        linesSnapshot,
      });
      resetAfterPurchase();
      setStep("thanks");
      onCompleted?.({ purchaseId, reservationId });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "No pudimos completar el pago.";
      if (chargedRef.current) {
        setRegisterOnly(true);
        setPayError(
          detail && detail !== CHARGED_BUT_NOT_RECORDED
            ? `${CHARGED_BUT_NOT_RECORDED} (${detail})`
            : CHARGED_BUT_NOT_RECORDED,
        );
      } else {
        setPayError(detail);
      }
    } finally {
      setPaying(false);
    }
  }

  function purchaseLinesPayload() {
    const rawFor = (line: CartLine): Record<string, unknown> | undefined => {
      if (line.raw) return line.raw;
      const pools =
        line.type === "membership"
          ? [memberships, config?.memberships ?? []]
          : line.type === "product"
            ? [products, config?.products ?? []]
            : [combos, config?.combos ?? []];
      for (const pool of pools) {
        const hit = pool.find((item) => sameCatalogId(item.id, line.id));
        if (hit?.raw) return hit.raw;
      }
      return undefined;
    };
    return relevantLines.map((line) => ({
      id: line.id,
      type: line.type,
      amount: line.amount,
      name: line.name,
      price: line.price,
      companiesId: config?.companiesId,
      raw: rawFor(line),
    }));
  }

  function handleGafaPaySuccess(result: GafaPaySuccess) {
    // Paridad con el fancy v1: `ht.payment_data = e.message` y luego
    // BuySystemStep POSTea a `/reservate` (paymentByCard / paymentByToken).
    const recurring = Boolean(result.recurringPayment);
    const subscriptionId = result.subscriptionId ?? null;
    chargedRef.current = true;
    pendingRegisterRef.current = {
      paymentData: result.message,
      recurring,
      subscriptionId,
    };
    void completePurchase(result.message, recurring, subscriptionId);
  }

  async function finishHostedPurchase(result: {
    purchaseId?: number | null;
    reservationId?: number;
    isWaitlist?: boolean;
  }) {
    hostedPendingRef.current = null;
    setRegisterOnly(false);
    setThanks({
      purchaseId: result.purchaseId,
      reservationId: result.reservationId,
      confirmed: true,
      isWaitlist: Boolean(result.isWaitlist) || waitlistPurchase,
      reservationSnapshot: reservation,
      linesSnapshot: relevantLines,
    });
    resetAfterPurchase();
    setStep("thanks");
    onCompleted?.({ purchaseId: result.purchaseId, reservationId: result.reservationId });
  }

  async function handleHostedCheckout(data: unknown) {
    const profile = profileQuery.data;
    if (!profile || !selectedMethod || !brandSlug || !locationSlug) {
      setPaying(false);
      setPayError("No pudimos abrir el pago. Recarga e inténtalo de nuevo.");
      return;
    }
    const checkoutToken = checkoutTokenFromHostedData(data);
    if (!checkoutToken) {
      setPaying(false);
      setPayError("No pudimos iniciar el pago. Intenta de nuevo.");
      return;
    }

    const payload: InitialPurchasePayload = {
      brandSlug,
      locationSlug,
      userId: config?.userProfileId ?? profile.id,
      meetingId: reservation?.meetingId,
      lines: purchaseLinesPayload(),
      paymentTypeId: selectedMethod.id,
      paymentData: data,
      csrfToken: config?.csrfToken ?? null,
      discountCode: discountStatus === "ok" ? discountCode.trim() : null,
      giftCode: resolvedGiftCode(),
      checkoutToken,
      seatObjectId: reservation?.seatObjectId,
      subscribe: membershipPurchase ? autoRenew : false,
      setPayment: membershipPurchase ? saveCard : false,
    };

    setPayError(undefined);
    setPaying(true);
    hostedAbortRef.current?.abort();
    const abort = new AbortController();
    hostedAbortRef.current = abort;
    hostedSettledRef.current = false;
    try {
      if (!client.initialPurchase || !client.pollInitialPurchaseStatus) {
        throw new Error("Esta marca no tiene configurado el pago con tarjeta.");
      }
      const pending = await client.initialPurchase(payload);
      const purchaseId = pending.purchaseId;
      const token = pending.checkoutToken?.trim() || checkoutToken;
      if (purchaseId == null) {
        throw new Error("No se pudo crear la compra pendiente.");
      }
      hostedPendingRef.current = { checkoutToken: token, purchaseId, payload };
      const done = await pollRecurrenteUntilDone({
        client,
        brandSlug,
        locationSlug,
        checkoutToken: token,
        pendingPurchaseId: purchaseId,
        signal: abort.signal,
      });
      hostedSettledRef.current = true;
      stopPopupWatchRef.current?.();
      stopPopupWatchRef.current = null;
      await finishHostedPurchase({ purchaseId, reservationId: done.reservationId });
    } catch (err) {
      if (err instanceof HostedCheckoutClosedError) {
        setPaying(false);
        return;
      }
      const detail = err instanceof Error ? err.message : "No pudimos confirmar el pago.";
      if (hostedPendingRef.current?.purchaseId) {
        setRegisterOnly(true);
      }
      setPayError(detail);
    } finally {
      setPaying(false);
    }
  }

  function releaseHostedWait() {
    if (hostedSettledRef.current) return;
    hostedAbortRef.current?.abort();
    hostedAbortRef.current = null;
    stopPopupWatchRef.current?.();
    stopPopupWatchRef.current = null;
    setPaying(false);
  }

  function startHostedPopupWatch() {
    if (stopPopupWatchRef.current) return;
    hostedSettledRef.current = false;
    stopPopupWatchRef.current = watchNextPopup(() => {
      releaseHostedWait();
    });
  }

  async function proceedToPay() {
    if (registerOnly && hostedPendingRef.current?.purchaseId) {
      setPayError(undefined);
      setPaying(true);
      const pending = hostedPendingRef.current;
      hostedAbortRef.current?.abort();
      const abort = new AbortController();
      hostedAbortRef.current = abort;
      try {
        const status = await pollRecurrenteUntilDone({
          client,
          brandSlug: pending.payload.brandSlug,
          locationSlug: pending.payload.locationSlug,
          checkoutToken: pending.checkoutToken,
          pendingPurchaseId: pending.purchaseId,
          signal: abort.signal,
        });
        hostedSettledRef.current = true;
        await finishHostedPurchase({
          purchaseId: pending.purchaseId,
          reservationId: status.reservationId,
        });
      } catch (err) {
        if (err instanceof HostedCheckoutClosedError) {
          setPaying(false);
          return;
        }
        setPayError(err instanceof Error ? err.message : "El pago sigue pendiente.");
      } finally {
        setPaying(false);
      }
      return;
    }
    if (registerOnly && pendingRegisterRef.current) {
      setPayError(undefined);
      setPaying(true);
      const pending = pendingRegisterRef.current;
      await completePurchase(pending.paymentData, pending.recurring, pending.subscriptionId);
      return;
    }
    if (!paymentReady) {
      setPayError("El formulario de pago todavía no está listo.");
      return;
    }
    setPayError(undefined);
    setPaying(true);
    if (selectedMethod?.slug === "recurrente") startHostedPopupWatch();
    // Stripe/Conekta: la confirmación vive en el widget de GafaPay.
    try {
      const triggered = await triggerGafaPayConfirm(selectedMethod?.slug ?? "");
      if (!triggered) {
        stopPopupWatchRef.current?.();
        stopPopupWatchRef.current = null;
        setPaying(false);
        setPayError(
          selectedMethod?.slug === "paypal"
            ? "Usa el botón de PayPal para completar el pago."
            : selectedMethod?.slug === "recurrente"
              ? "No pudimos abrir el pago. Intenta de nuevo."
              : "El procesador de pago aún no está listo. Intenta de nuevo.",
        );
      }
    } catch (err) {
      setPaying(false);
      const raw = err instanceof Error ? err.message : "";
      setPayError(
        /is not a function/i.test(raw)
          ? "El procesador de pago aún no está listo. Intenta de nuevo."
          : raw || "No pudimos iniciar el pago. Intenta de nuevo.",
      );
    }
  }

  function handlePayClick() {
    setPayError(undefined);
    if (!relevantLines.length) {
      setPayError("Agrega un paquete o membresía para continuar.");
      return;
    }
    if (registerOnly) {
      void proceedToPay();
      return;
    }
    if (waitingOnTerms) {
      setTermsPromptOpen(true);
      return;
    }
    if (!canPay) {
      if (waitingOnGift) {
        setPayError("Revisa el código de GiftCard.");
        return;
      }
      if (!paymentReady) setPayError("El formulario de pago todavía no está listo.");
      return;
    }
    void proceedToPay();
  }

  function acceptTermsAndPay() {
    setTermsAccepted(true);
    setTermsAttention(false);
    setTermsPromptOpen(false);
    void proceedToPay();
  }

  return (
    <>
    <div
      className="gafa-checkout-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gafa-checkout-title"
      data-gafa-membership-options={showMembershipOptions ? "true" : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && step !== "thanks") onClose();
      }}
    >
      <div className="gafa-checkout" data-step={step}>
        <button className="gafa-checkout__close" type="button" aria-label="Cerrar" onClick={onClose}>
          <CloseIcon />
        </button>

        {step !== "thanks" ? (
          <div className="gafa-checkout__layout">
            <section className="gafa-checkout__main">
              {reservation ? (
                <div className="gafa-checkout__context">
                  <span className="gafa-checkout__context-dot" aria-hidden="true" />
                  <span className="gafa-checkout__context-text">
                    {reservation.serviceName ?? reservation.meetingName} ·{" "}
                    {formatMeetingWhen(reservation.startsAt, reservation.timezone)}
                  </span>
                  <RemoveClassButton onClick={dropPendingClass} />
                </div>
              ) : null}

              <header className="gafa-checkout__hero">
                <h2 id="gafa-checkout-title">
                  {step === "auth"
                    ? AUTH_COPY[authStage].title
                    : step === "shop"
                      ? reservation
                        ? waitlistPurchase
                          ? "Compra para la lista de espera"
                          : "Compra para reservar"
                        : "Elige tu plan"
                      : "Pago"}
                </h2>
                <p>
                  {step === "auth"
                    ? AUTH_COPY[authStage].description
                    : step === "shop"
                      ? reservation
                        ? waitlistPurchase
                          ? "Al pagar te sumamos a la lista de espera y se descuenta el crédito."
                          : "Estos son los planes que aplican para esta clase."
                        : "Agrega paquetes o membresías."
                      : "Revisa tu pedido y paga de forma segura. Si quieres agregar más, vuelve al paso anterior."}
                </p>
              </header>

              {step === "auth" ? (
                <div className="gafa-checkout-auth">
                  <AuthWidget
                    client={client}
                    captcha={captcha}
                    brandSlug={brandSlug}
                    initialView="login"
                    hideHeader
                    onStageChange={setAuthStage}
                    onAuthenticated={() => {
                      // Con sesion ya se puede pedir la config de pago real.
                      void profileQuery.refetch();
                      setStep("pay");
                    }}
                  />
                </div>
              ) : step === "shop" ? (
                <>
                  <div className="gafa-checkout__toolbar">
                    <div className="gafa-checkout-tabs" role="tablist" aria-label="Tipo de producto">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={tab === "packages"}
                        data-active={tab === "packages" ? "true" : undefined}
                        onClick={() => setTab("packages")}
                      >
                        Paquetes
                        {combos.length ? <em>{combos.length}</em> : null}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={tab === "memberships"}
                        data-active={tab === "memberships" ? "true" : undefined}
                        onClick={() => setTab("memberships")}
                      >
                        Membresías
                        {memberships.length ? <em>{memberships.length}</em> : null}
                      </button>
                      {products.length ? (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={tab === "products"}
                          data-active={tab === "products" ? "true" : undefined}
                          onClick={() => setTab("products")}
                        >
                          Productos
                          <em>{products.length}</em>
                        </button>
                      ) : null}
                    </div>

                    <label className="gafa-checkout-search">
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M9.4 9.4L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar"
                        aria-label="Buscar en todo el catálogo"
                      />
                    </label>
                  </div>

                  {catalogBusy ? (
                    <CatalogSkeleton />
                  ) : searchGroups ? (
                    <div className="gafa-checkout-results">
                      {searchGroups.map((group) => (
                        <section key={group.key}>
                          <h3 className="gafa-checkout-results__title">
                            {group.label} <span>{group.items.length}</span>
                          </h3>
                          <div className="gafa-checkout-grid">
                            {group.items.map((item) => (
                              <ProductCard
                                key={`${item.type}-${item.id}`}
                                item={item}
                                currency={currency}
                                inCartAmount={amountInCart(relevantLines, item)}
                                onAdd={() => handleAdd(item)}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="gafa-checkout-grid">
                      {catalogItems.map((item) => (
                        <ProductCard
                          key={`${item.type}-${item.id}`}
                          item={item}
                          currency={currency}
                          inCartAmount={amountInCart(relevantLines, item)}
                          onAdd={() => handleAdd(item)}
                        />
                      ))}
                    </div>
                  )}

                  {!catalogBusy &&
                  ((configQuery.isError && !combos.length && !memberships.length && catalogQuery.isError) ||
                    (!classAttached && catalogQuery.isError && !combos.length && !memberships.length)) ? (
                    <p className="gafa-sdk-state gafa-sdk-state--error">
                      No pudimos cargar el catálogo de esta sede.
                    </p>
                  ) : null}

                  {!catalogBusy &&
                  !catalogQuery.isError &&
                  !(configQuery.isError && !combos.length && !memberships.length) &&
                  (search ? searchTotal === 0 : catalogItems.length === 0) ? (
                    <p className="gafa-sdk-state">
                      {search
                        ? "Nada coincide con tu búsqueda."
                        : tab === "packages"
                          ? classAttached
                            ? "Esta clase no tiene paquetes disponibles."
                            : "No hay paquetes disponibles."
                          : tab === "memberships"
                            ? classAttached
                              ? "Esta clase no tiene membresías disponibles."
                              : "No hay membresías disponibles."
                            : "No hay productos disponibles."}
                    </p>
                  ) : null}
                </>
              ) : preselectStatus === "loading" ? (
                <PaySkeleton withMethods label="Preparando tu compra…" />
              ) : (
                <PayPanel
                  methods={paymentMethods}
                  selectedMethodId={selectedMethodId}
                  onSelectMethod={(id) => {
                    setSelectedMethodId(id);
                    setPayError(undefined);
                  }}
                  configLoading={configQuery.isLoading}
                  config={config}
                  gafaPayFrontUrl={gafaPayFrontUrl}
                  lines={relevantLines}
                  discountAmount={discountAmount}
                  customer={{
                    email: profileQuery.data?.email,
                    firstName: profileQuery.data?.firstName,
                    lastName: profileQuery.data?.lastName,
                    phone: profileQuery.data?.phone ?? undefined,
                  }}
                  onSuccess={handleGafaPaySuccess}
                  onHostedCheckout={handleHostedCheckout}
                  onHostedClose={releaseHostedWait}
                  onStart={() => {
                    setPaying(true);
                    if (selectedMethod?.slug === "recurrente") startHostedPopupWatch();
                  }}
                  onReadyChange={setPaymentReady}
                  onError={(message) => {
                    setPaying(false);
                    setPayError(message);
                  }}
                  membershipOptions={
                    membershipPurchase
                      ? {
                          saveCard,
                          autoRenew,
                          open: membershipOptsOpen,
                          visible: showMembershipOptions,
                          onToggle: () => setMembershipOptsOpen((current) => !current),
                          onSaveCard: setSaveCard,
                          onAutoRenew: setAutoRenew,
                        }
                      : undefined
                  }
                  payCta={
                    selectedMethod?.slug === "recurrente"
                      ? {
                          label: registerOnly
                            ? hostedPendingRef.current?.purchaseId
                              ? "Revisar pago"
                              : "Registrar compra"
                            : `Pagar ${formatMoney(total, currency.prefix, "")}`,
                          busyLabel: "Esperando el pago…",
                          busy: paying,
                          disabled:
                            paying ||
                            relevantLines.length === 0 ||
                            (!registerOnly && !waitingOnTerms && !canPay),
                          onClick: handlePayClick,
                        }
                      : undefined
                  }
                />
              )}
            </section>

            <aside
              className="gafa-checkout__cart"
              aria-label="Tu pedido"
              data-open={cartOpen ? "true" : undefined}
            >
              {/* Solo movil: el carrito vive como barra fija abajo. Sin esto el
                  total y "Ir a pagar" quedaban debajo de todo el catalogo y
                  habia que scrollear a ciegas para pagar. */}
              <button
                className="gafa-checkout__cart-toggle"
                type="button"
                aria-expanded={cartOpen}
                onClick={() => setCartOpen((value) => !value)}
              >
                <span>
                  {cartCount === 0
                    ? "Carrito vacío"
                    : `${cartCount} ${cartCount === 1 ? "artículo" : "artículos"}`}
                </span>
                <strong>{formatMoney(total, currency.prefix, "")}</strong>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 9L7 4l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="gafa-checkout__cart-head">
                <h3>{resolvedLocationName ?? "Tu pedido"}</h3>
                {cartCount ? (
                  <span>
                    {cartCount} {cartCount === 1 ? "artículo" : "artículos"}
                  </span>
                ) : null}
              </div>

              {reservation ? (
                <div className="gafa-checkout__reserve-chip">
                  <div className="gafa-checkout__reserve-chip-text">
                    <strong>{reservation.serviceName ?? reservation.meetingName}</strong>
                    <small>
                      {formatMeetingWhen(reservation.startsAt, reservation.timezone)}
                      {reservation.seatLabel ? ` · Lugar ${reservation.seatLabel}` : ""}
                    </small>
                  </div>
                  <RemoveClassButton onClick={dropPendingClass} />
                </div>
              ) : null}

              {preselectStatus === "loading" ? (
                <div className="gafa-checkout-line-skel" aria-busy="true" aria-live="polite">
                  <span className="gafa-sr-only">Agregando tu plan…</span>
                  <span className="gafa-skeleton gafa-checkout-line-skel__name" aria-hidden="true" />
                  <span className="gafa-skeleton gafa-checkout-line-skel__meta" aria-hidden="true" />
                  <span className="gafa-skeleton gafa-checkout-line-skel__controls" aria-hidden="true" />
                </div>
              ) : relevantLines.length === 0 ? (
                <div className="gafa-checkout__empty">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 6h2l2.2 10.4A1.6 1.6 0 0 0 9.77 17.7h7.06a1.6 1.6 0 0 0 1.56-1.25L20 9H7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="10" cy="20.4" r="1.15" fill="currentColor" />
                    <circle cx="16.4" cy="20.4" r="1.15" fill="currentColor" />
                  </svg>
                  <p>Tu carrito está vacío</p>
                  <small>Agrega algo del catálogo para continuar.</small>
                </div>
              ) : (
                <ul className="gafa-checkout__lines">
                  {relevantLines.map((line) => (
                    <li key={line.key}>
                      <div className="gafa-checkout__line-info">
                        <strong>{line.name}</strong>
                        {line.expirationLabel ? <span>{line.expirationLabel}</span> : null}
                      </div>
                      <div className="gafa-checkout__line-actions">
                        <div className="gafa-checkout__stepper" aria-label={`Cantidad de ${line.name}`}>
                          <button
                            type="button"
                            aria-label="Quitar uno"
                            onClick={() => setAmount(line.key, line.amount - 1)}
                          >
                            −
                          </button>
                          <span>{line.amount}</span>
                          <button
                            type="button"
                            aria-label="Agregar uno"
                            onClick={() => setAmount(line.key, line.amount + 1)}
                          >
                            +
                          </button>
                        </div>
                        <strong className="gafa-checkout__line-price">
                          {formatMoney(line.price * line.amount, currency.prefix, "")}
                        </strong>
                        <button
                          className="gafa-checkout__line-remove"
                          type="button"
                          aria-label={`Eliminar ${line.name}`}
                          onClick={() => removeItem(line.key)}
                        >
                          <CloseIcon size={11} strokeWidth={1.5} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {step === "pay" ? (
                <div className="gafa-checkout__extras">
                  {config?.discountCodesEnabled !== false && client.checkDiscountCode ? (
                    <PromoDisclosure
                      linkLabel="¿Tienes un código de descuento?"
                      open={discountOpen}
                      onToggle={() => setDiscountOpen((v) => !v)}
                      value={discountCode}
                      onChange={(value) => {
                        setDiscountCode(value);
                        if (discountStatus === "error") {
                          setDiscountStatus("idle");
                          setDiscountError(undefined);
                        }
                      }}
                      onApply={applyDiscount}
                      status={discountStatus}
                      hint={
                        discountStatus === "ok"
                          ? (discountLabel ?? "Descuento aplicado")
                          : discountStatus === "error"
                            ? (discountError ?? "Código no válido")
                            : undefined
                      }
                    />
                  ) : null}

                  {config?.giftCardsEnabled ? (
                    <PromoDisclosure
                      linkLabel="Convertir en GiftCard"
                      open={convertGift}
                      onToggle={() => {
                        const next = !convertGift;
                        setConvertGift(next);
                        if (next) {
                          void assignGeneratedGiftCode();
                          return;
                        }
                        giftTypingRef.current = false;
                        giftCheckSeq.current += 1;
                        setGiftCode("");
                        setGiftStatus("idle");
                        setGiftHint(undefined);
                      }}
                      value={giftCode}
                      onChange={(value) => {
                        giftTypingRef.current = true;
                        setGiftStatus("checking");
                        setGiftHint("revisando…");
                        setGiftCode(value.toUpperCase());
                      }}
                      onApply={assignGeneratedGiftCode}
                      status={giftStatus}
                      hint={giftHint}
                      info="Convierte esta compra en una GiftCard para regalar. El código se activa al pagar y se canjea en el estudio."
                      persistField
                      inputLabel="Código de GiftCard"
                      applyAriaLabel="Generar otro código"
                      applyLabel={<RefreshGiftIcon />}
                    />
                  ) : null}

                  {hasTerms ? (
                    <CheckField
                      className="gafa-checkout__terms"
                      attention={termsAttention || termsPromptOpen}
                      checked={termsAccepted}
                      onChange={(next) => {
                        setTermsAccepted(next);
                        if (next) setTermsAttention(false);
                      }}
                    >
                      Acepto los{" "}
                      <a href={config!.termsConditionsLink!} target="_blank" rel="noreferrer">
                        términos y condiciones
                      </a>
                    </CheckField>
                  ) : null}
                </div>
              ) : null}

              <div className="gafa-checkout__total">
                {discountAmount > 0 ? (
                  <div className="gafa-checkout__total-row">
                    <span>Subtotal</span>
                    <span>{formatMoney(subtotal, currency.prefix, "")}</span>
                  </div>
                ) : null}
                {discountAmount > 0 ? (
                  <div className="gafa-checkout__total-row gafa-checkout__total-row--discount">
                    <span>Descuento</span>
                    <span>−{formatMoney(discountAmount, currency.prefix, "")}</span>
                  </div>
                ) : null}
                <div className="gafa-checkout__total-row gafa-checkout__total-row--grand">
                  <span>Total</span>
                  <strong>
                    {formatMoney(total, currency.prefix, "")}
                    <em>{currency.suffix}</em>
                  </strong>
                </div>
              </div>

              {envWarning ? <p className="gafa-checkout__env-warn">{envWarning}</p> : null}

              {payError ? <p className="gafa-checkout__error">{payError}</p> : null}

              {/* En el paso de login la accion es "Entrar" del propio formulario:
                  dejar aqui un "Ir a pagar" deshabilitado era un boton muerto. */}
              {step === "auth" ? null : step === "shop" ? (
                <button
                  className="gafa-sdk-button gafa-checkout__cta"
                  type="button"
                  disabled={!relevantLines.length}
                  onClick={() => setStep(isSignedIn ? "pay" : "auth")}
                >
                  Ir a pagar
                </button>
              ) : selectedMethod?.slug === "paypal" ? (
                <p className="gafa-checkout__paypal-hint">Completa el pago con el botón de PayPal.</p>
              ) : (
                <button
                  className="gafa-sdk-button gafa-checkout__cta"
                  type="button"
                  disabled={
                    paying ||
                    relevantLines.length === 0 ||
                    (!registerOnly && !waitingOnTerms && !canPay)
                  }
                  onClick={handlePayClick}
                >
                  {paying
                    ? selectedMethod?.slug === "recurrente"
                      ? "Esperando el pago…"
                      : "Procesando…"
                    : registerOnly
                      ? hostedPendingRef.current?.purchaseId
                        ? "Revisar pago"
                        : "Registrar compra"
                      : `Pagar ${formatMoney(total, currency.prefix, "")}`}
                </button>
              )}

              {step === "pay" || step === "auth" ? (
                <button
                  className="gafa-checkout__backlink"
                  type="button"
                  onClick={() => {
                    stayOnPayRef.current = false;
                    setStep("shop");
                  }}
                >
                  ← Agregar otro paquete o membresía
                </button>
              ) : null}
            </aside>
          </div>
        ) : (
          <ThanksPanel thanks={thanks} firstName={profileQuery.data?.firstName} currency={currency} onClose={onClose} />
        )}
      </div>
    </div>
    {termsPromptOpen && config?.termsConditionsLink ? (
      <ConfirmDialog
        title="Acepta los términos"
        description={
          <>
            Para cobrar necesitamos que aceptes los{" "}
            <a href={config.termsConditionsLink} target="_blank" rel="noreferrer">
              términos y condiciones
            </a>
            .
          </>
        }
        confirmLabel="Aceptar y pagar"
        cancelLabel="Volver"
        onConfirm={acceptTermsAndPay}
        onDismiss={() => {
          setTermsPromptOpen(false);
          setTermsAttention(true);
        }}
      />
    ) : null}
    </>
  );
}

/** Cuantas unidades de este item ya estan en el carrito. */
function amountInCart(lines: CartLine[], item: CatalogItem): number {
  const type: CartLineType =
    item.type === "membership" ? "membership" : item.type === "product" ? "product" : "combo";
  return lines.find((line) => line.id === item.id && line.type === type)?.amount ?? 0;
}

function CatalogSkeleton() {
  return (
    <div className="gafa-checkout-catalog-loading" aria-busy="true" aria-live="polite">
      <div className="gafa-checkout-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="gafa-checkout-product gafa-checkout-product--skel" key={index}>
            <span className="gafa-skeleton gafa-checkout-product-skel__price" />
            <span className="gafa-skeleton gafa-checkout-product-skel__title" />
            <span className="gafa-skeleton gafa-checkout-product-skel__meta" />
            <span className="gafa-skeleton gafa-checkout-product-skel__btn" />
          </div>
        ))}
      </div>
      <p className="gafa-sr-only">Cargando catálogo…</p>
    </div>
  );
}

/* Loader del paso de pago: las mismas cajas que va a pintar GafaPay (tarjeta
   guardada + tarjeta nueva), no un texto gris que nadie lee. */
function PaySkeleton({ withMethods = false, label }: { withMethods?: boolean; label: string }) {
  return (
    <div className="gafa-checkout-pay-skel" aria-busy="true" aria-live="polite">
      <span className="gafa-sr-only">{label}</span>
      {withMethods ? (
        <div className="gafa-checkout-pay-skel__methods" aria-hidden="true">
          <span className="gafa-skeleton gafa-checkout-pay-skel__pill" />
          <span className="gafa-skeleton gafa-checkout-pay-skel__pill" />
        </div>
      ) : null}
      <div className="gafa-checkout-pay-skel__card" aria-hidden="true">
        <span className="gafa-skeleton gafa-checkout-pay-skel__brand" />
        <span className="gafa-skeleton gafa-checkout-pay-skel__number" />
      </div>
      <div className="gafa-checkout-pay-skel__card" aria-hidden="true">
        <span className="gafa-skeleton gafa-checkout-pay-skel__brand" />
        <span className="gafa-skeleton gafa-checkout-pay-skel__number" />
      </div>
    </div>
  );
}

function ProductCard({
  item,
  currency,
  inCartAmount,
  onAdd,
}: {
  item: CatalogItem;
  currency: { prefix: string; suffix: string; code: string };
  inCartAmount: number;
  onAdd: () => void;
}) {
  const price = item.priceFinal ?? item.price ?? 0;
  const compareAt =
    item.hasDiscount && item.price != null && item.priceFinal != null && item.price > item.priceFinal
      ? formatMoney(item.price, currency.prefix, "")
      : null;
  return (
    <article className="gafa-checkout-product" data-in-cart={inCartAmount > 0 ? "true" : undefined}>
      {item.description ? (
        <span className="gafa-checkout-product__info">
          <button type="button" aria-label={`Detalles de ${item.name}`}>
            i
          </button>
          <span role="tooltip" className="gafa-checkout-product__tooltip">
            {item.description}
          </span>
        </span>
      ) : null}

      <div className="gafa-checkout-product__price">
        {compareAt ? <s>{compareAt}</s> : null}
        <strong>{formatMoney(price, currency.prefix, "")}</strong>
      </div>
      <h3>{item.name}</h3>
      <p className="gafa-checkout-product__meta">
        {[
          item.expirationDays ? `Vigencia ${item.expirationDays} días` : null,
          item.subscribable ? "Suscripción" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "\u00A0"}
      </p>
      <button className="gafa-checkout-product__add" type="button" onClick={onAdd}>
        {inCartAmount > 0 ? `Agregar otro (${inCartAmount})` : "Agregar"}
      </button>
    </article>
  );
}

function PayPanel({
  methods,
  selectedMethodId,
  onSelectMethod,
  configLoading,
  config,
  gafaPayFrontUrl,
  lines,
  discountAmount,
  customer,
  onSuccess,
  onHostedCheckout,
  onHostedClose,
  onStart,
  onReadyChange,
  onError,
  payCta,
  membershipOptions,
}: {
  methods: CheckoutConfig["paymentMethods"];
  selectedMethodId: number | null;
  onSelectMethod: (id: number) => void;
  configLoading: boolean;
  config?: CheckoutConfig;
  gafaPayFrontUrl?: string;
  lines: CartLine[];
  discountAmount: number;
  customer: { email?: string; firstName?: string; lastName?: string; phone?: string };
  onSuccess: (result: GafaPaySuccess) => void;
  onHostedCheckout: (data: unknown) => void;
  onHostedClose: () => void;
  onStart: () => void;
  onReadyChange: (ready: boolean) => void;
  onError: (message: string) => void;
  payCta?: {
    label: string;
    busyLabel: string;
    busy: boolean;
    disabled: boolean;
    onClick: () => void;
  };
  membershipOptions?: {
    saveCard: boolean;
    autoRenew: boolean;
    open: boolean;
    visible: boolean;
    onToggle: () => void;
    onSaveCard: (value: boolean) => void;
    onAutoRenew: (value: boolean) => void;
  };
}) {
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string>();
  const selected = methods.find((method) => method.id === selectedMethodId) ?? null;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const islandRef = useRef<GafaPayIsland | null>(null);
  // Los callbacks cambian en cada render; el widget vive fuera de React y no
  // debe re-montarse por eso.
  const handlersRef = useRef({
    onSuccess,
    onError,
    onStart,
    onHostedCheckout,
    onHostedClose,
    onSaveCard: membershipOptions?.onSaveCard,
    onAutoRenew: membershipOptions?.onAutoRenew,
  });
  handlersRef.current = {
    onSuccess,
    onError,
    onStart,
    onHostedCheckout,
    onHostedClose,
    onSaveCard: membershipOptions?.onSaveCard,
    onAutoRenew: membershipOptions?.onAutoRenew,
  };

  useEffect(() => {
    onReadyChange(loadState === "ready");
  }, [loadState, onReadyChange]);

  // lineItems con el descuento repartido, igual que el fancy v1.
  const lineItems = useMemo<GafaPayLineItem[]>(() => {
    let remaining = discountAmount;
    const sorted = [...lines].sort((a, b) => a.price - b.price);
    return sorted.map((line) => {
      const unit = line.price;
      let perUnitDiscount = 0;
      if (remaining > 0) {
        perUnitDiscount = Math.min(unit, remaining / line.amount);
        remaining = Math.max(0, remaining - perUnitDiscount * line.amount);
      }
      return {
        name: line.name,
        unitPrice: Math.max(0, unit - perUnitDiscount),
        quantity: line.amount,
        product_type: gafaFitProductType(line.type),
        product_id: line.id,
        height: 1,
        length: 1,
        weight: 1,
        width: 1,
      };
    });
  }, [lines, discountAmount]);

  const widgetProps: GafaPayWidgetProps = useMemo(
    () => ({
      order: {
        customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim(),
        customerEmail: customer.email,
        customerPhone: customer.phone,
        lineItems,
        currency: config?.currency.code,
      },
      generalData: {
        companiesId: config?.companiesId,
        locationsId: config?.locationId,
        adminProfilesId: null,
        usersProfilesId: config?.userProfileId,
        usersId: config?.usersId,
      },
      // GafaPay Recurrente deshabilita su botón si esto es falsy. Los términos
      // los exigimos en nuestro CTA; aquí hay que dejarlo pasar.
      termsAndConditions: selected?.slug === "recurrente" ? true : (config?.termsConditionsLink ?? null),
      hasRecurringPayment: Boolean(membershipOptions),
      onStartPayAction: () => handlersRef.current.onStart(),
      onGafaPaySuccessAction: (result) => handlersRef.current.onSuccess(result),
      onGafaPayErrAction: ({ message }) =>
        handlersRef.current.onError(message ?? "Ocurrió un error durante el pago."),
      onCheckoutOpenAction: (data) => handlersRef.current.onHostedCheckout(data),
      onCheckoutCloseAction: () => handlersRef.current.onHostedClose(),
      changePaymentSystemProperties: ({ recurringPayment, saveCard: nextSave }) => {
        if (typeof nextSave === "boolean") handlersRef.current.onSaveCard?.(nextSave);
        if (typeof recurringPayment === "boolean") handlersRef.current.onAutoRenew?.(recurringPayment);
      },
    }),
    [lineItems, config?.companiesId, config?.locationId, config?.userProfileId, config?.usersId, config?.currency.code, config?.termsConditionsLink, selected?.slug, customer.email, customer.firstName, customer.lastName, customer.phone, membershipOptions],
  );

  // Cambios de carrito/cliente actualizan props sin re-montar: tirar el iframe
  // de Stripe borraria la tarjeta que el usuario ya escribio.
  const propsRef = useRef(widgetProps);
  propsRef.current = widgetProps;

  const clientId = config?.gafapayClientId;
  const clientSecret = config?.gafapayClientSecret;
  const slug = selected?.slug;

  // Monta la isla: se re-monta solo si cambia el proveedor o las credenciales.
  useEffect(() => {
    if (!slug || !clientId || !clientSecret) return;
    let cancelled = false;
    setLoadState("loading");
    setLoadError(undefined);

    loadGafaPay({ clientId, clientSecret, scriptUrl: gafaPayFrontUrl })
      .then(async (runtime) => {
        if (cancelled || !mountRef.current) return;
        // PaypalPayment del frontpay exige checkout.js ANTES de pintar el
        // <div id="paypal">; si no, window.paypal es el DIV y revienta.
        if (slug === "paypal") await ensureLegacyPaypalCheckout();
        if (cancelled || !mountRef.current) return;
        const container = mountRef.current;
        islandRef.current?.unmount();
        islandRef.current = mountGafaPayWidget(runtime, container, slug, propsRef.current);
        await waitForWidgetContent(container);
        if (cancelled) return;
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState("error");
        const raw = error instanceof Error ? error.message : undefined;
        setLoadError(
          raw && /render/i.test(raw)
            ? "PayPal no terminó de cargar. Cierra el checkout e inténtalo de nuevo."
            : raw,
        );
      });

    return () => {
      cancelled = true;
      islandRef.current?.unmount();
      islandRef.current = null;
    };
  }, [slug, clientId, clientSecret, gafaPayFrontUrl]);

  useEffect(() => {
    if (loadState === "ready") islandRef.current?.update(widgetProps);
  }, [widgetProps, loadState]);

  useEffect(() => {
    if (loadState !== "ready" || !mountRef.current || !membershipOptions) return;
    syncGafaPayMembershipToggles(mountRef.current, {
      saveCard: membershipOptions.saveCard,
      autoRenew: membershipOptions.autoRenew,
    });
  }, [loadState, membershipOptions]);

  return (
    <div className="gafa-checkout-pay">
      {configLoading ? <PaySkeleton withMethods label="Cargando métodos de pago…" /> : null}

      {methods.length > 1 ? (
        <div className="gafa-checkout-methods" role="tablist" aria-label="Método de pago">
          {methods.map((method) => (
            <button
              key={method.id}
              type="button"
              role="tab"
              aria-selected={method.id === selectedMethodId}
              data-active={method.id === selectedMethodId ? "true" : undefined}
              onClick={() => onSelectMethod(method.id)}
            >
              {method.slug === "stripe" ? <CardIcon /> : method.slug === "paypal" ? <PaypalIcon /> : method.slug === "recurrente" ? <CardIcon /> : null}
              {method.slug === "stripe" ? "Tarjeta" : method.slug === "recurrente" ? "Tarjeta" : method.name}
            </button>
          ))}
        </div>
      ) : null}

      {!configLoading && methods.length === 0 ? (
        <p className="gafa-sdk-state">Esta sede no tiene métodos de pago en línea activos.</p>
      ) : null}

      {/* GafaPayFront trae su propio React 16: este div es suyo, nuestro React
          nunca toca lo que hay dentro (ver payments/gafaPay.ts). */}
      <div
        className="gafa-checkout-paymount"
        data-state={loadState}
        data-method={slug || undefined}
        data-membership={membershipOptions ? "true" : undefined}
      >
        {slug === "paypal" ? (
          <div className="gafa-checkout-paypal-copy">
            <span className="gafa-checkout-paypal-copy__mark" aria-hidden="true">
              <PaypalMark />
            </span>
            <div>
              <strong>Pagar con PayPal</strong>
              <p>Te llevamos a PayPal para confirmar. No guardamos tu cuenta.</p>
            </div>
          </div>
        ) : null}
        {slug === "recurrente" ? (
          <div className="gafa-checkout-cardpay">
            <div className="gafa-checkout-paypal-copy">
              <span className="gafa-checkout-paypal-copy__mark" aria-hidden="true">
                <CardIcon />
              </span>
              <div>
                <strong>Pagar con tarjeta</strong>
                <p>Se abre una ventana segura para confirmar tu pago.</p>
              </div>
            </div>
            {payCta ? (
              <button
                className="gafa-sdk-button gafa-checkout__cta"
                type="button"
                disabled={payCta.disabled}
                onClick={payCta.onClick}
              >
                {payCta.busy ? payCta.busyLabel : payCta.label}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="gafa-checkout-paymount__island gafa-pay-native" ref={mountRef} />

        {membershipOptions ? (
          <div
            className="gafa-checkout-membership"
            data-open={membershipOptions.open ? "true" : undefined}
            data-visible={membershipOptions.visible ? "true" : undefined}
            hidden={!membershipOptions.visible}
          >
            <button
              className="gafa-checkout-promo__link"
              type="button"
              aria-expanded={membershipOptions.open}
              onClick={membershipOptions.onToggle}
            >
              Opciones de la membresía
            </button>
            {membershipOptions.open ? (
              <div className="gafa-checkout-membership__fields">
                <CheckField
                  checked={membershipOptions.saveCard}
                  onChange={membershipOptions.onSaveCard}
                >
                  Guardar mi tarjeta para la próxima compra
                </CheckField>
                <CheckField
                  checked={membershipOptions.autoRenew}
                  onChange={membershipOptions.onAutoRenew}
                >
                  Renovar automáticamente al vencer
                </CheckField>
              </div>
            ) : null}
          </div>
        ) : null}

        {loadState === "loading" ? (
          <PaySkeleton label="Conectando con el procesador de pago…" />
        ) : null}
        {loadState === "error" ? (
          <p className="gafa-sdk-state gafa-sdk-state--error">
            {loadError ?? "No se pudo conectar con GafaPay. Revisa tu conexión e intenta de nuevo."}
          </p>
        ) : null}
        {selected && (!clientId || !clientSecret) && !configLoading ? (
          <p className="gafa-sdk-state gafa-sdk-state--error">
            Esta marca no tiene configurado GafaPay (falta client id/secret).
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PromoDisclosure({
  linkLabel,
  open,
  onToggle,
  value,
  onChange,
  onApply,
  status,
  hint,
  info,
  persistField = false,
  inputLabel,
  applyLabel,
  applyAriaLabel,
}: {
  linkLabel: string;
  open: boolean;
  onToggle: () => void;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void | Promise<void>;
  status: "idle" | "checking" | "ok" | "error";
  hint?: string;
  info?: string;
  persistField?: boolean;
  inputLabel?: string;
  applyLabel?: React.ReactNode;
  applyAriaLabel?: string;
}) {
  if (status === "ok" && hint && !persistField) {
    return (
      <p className="gafa-checkout-promo__applied" data-status="ok">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7.5L5.5 11L12 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {hint}
      </p>
    );
  }

  return (
    <div className="gafa-checkout-promo" data-status={status}>
      <div className="gafa-checkout-promo__head">
        <button className="gafa-checkout-promo__link" type="button" aria-expanded={open} onClick={onToggle}>
          {linkLabel}
        </button>
        {open && info ? (
          <span className="gafa-checkout-promo__info">
            <button type="button" aria-label="Más información">
              i
            </button>
            <span role="tooltip" className="gafa-checkout-product__tooltip">
              {info}
            </span>
          </span>
        ) : null}
      </div>
      {open ? (
        <>
          <div className="gafa-checkout-promo__row">
            <input
              value={value}
              autoFocus
              aria-label={inputLabel}
              spellCheck={false}
              autoCapitalize="characters"
              autoCorrect="off"
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onApply();
                }
              }}
              placeholder="Código"
            />
            <button
              type="button"
              aria-label={applyAriaLabel}
              onClick={() => void onApply()}
              disabled={status === "checking" || (!persistField && !value.trim())}
            >
              {status === "checking" ? "…" : (applyLabel ?? "Aplicar")}
            </button>
          </div>
          {status === "ok" && persistField && hint ? (
            <p className="gafa-checkout-promo__applied" data-status="ok" aria-live="polite">
              {hint}
            </p>
          ) : status === "error" && hint ? (
            <small>{hint}</small>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ThanksPanel({
  thanks,
  firstName,
  currency,
  onClose,
}: {
  thanks: {
    purchaseId?: number | null;
    reservationId?: number;
    confirmed?: boolean;
    isWaitlist?: boolean;
    reservationSnapshot: CartReservationContext | null;
    linesSnapshot: CartLine[];
  } | null;
  firstName?: string;
  currency: { prefix: string; suffix: string };
  onClose: () => void;
}) {
  const reservation = thanks?.reservationSnapshot;
  const lines = thanks?.linesSnapshot ?? [];

  return (
    <div className="gafa-checkout-thanks">
      <div className="gafa-checkout-thanks__badge" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5L9.5 18L20 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 id="gafa-checkout-title">
        {thanks?.isWaitlist
          ? "Estás en la lista de espera"
          : reservation
            ? "¡Reserva confirmada!"
            : "¡Gracias por tu compra!"}
      </h2>
      <p>
        {firstName ? `${firstName}, tu` : "Tu"} pago quedó registrado
        {thanks?.purchaseId ? ` (orden #${thanks.purchaseId})` : ""}. Te enviamos el detalle por correo.
      </p>

      {thanks?.confirmed === false ? (
        <p className="gafa-checkout-thanks__pending" role="status">
          Tu cobro ya se hizo, pero seguimos confirmando la compra. Si en unos minutos no ves tus
          créditos, escríbenos con el número de orden.
        </p>
      ) : null}

      {reservation ? (
        <div className="gafa-checkout-thanks__card">
          <span>Tu clase</span>
          <strong>{reservation.serviceName ?? reservation.meetingName}</strong>
          <p>
            {formatMeetingWhen(reservation.startsAt, reservation.timezone)}
            {reservation.locationName ? ` · ${reservation.locationName}` : ""}
            {reservation.seatLabel ? ` · Lugar ${reservation.seatLabel}` : ""}
          </p>
          {thanks?.reservationId ? <small>Reserva #{thanks.reservationId}</small> : null}
        </div>
      ) : null}

      {lines.length > 0 ? (
        <ul className="gafa-checkout-thanks__lines">
          {lines.map((line) => (
            <li key={line.key}>
              <span>
                {line.name}
                {line.amount > 1 ? ` × ${line.amount}` : ""}
              </span>
              <strong>{formatMoney(line.price * line.amount, currency.prefix, "")}</strong>
            </li>
          ))}
          <li className="gafa-checkout-thanks__total">
            <span>Total pagado</span>
            <strong>
              {formatMoney(
                lines.reduce((sum, line) => sum + line.price * line.amount, 0),
                currency.prefix,
                currency.suffix,
              )}
            </strong>
          </li>
        </ul>
      ) : null}

      <button className="gafa-sdk-button" type="button" onClick={onClose}>
        {reservation ? "Volver al calendario" : "Seguir explorando"}
      </button>
    </div>
  );
}

function RemoveClassButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="gafa-checkout__line-remove"
      type="button"
      aria-label="Quitar clase"
      onClick={onClick}
    >
      <CloseIcon size={11} strokeWidth={1.5} />
    </button>
  );
}

function CardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 9.6h19" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PaypalIcon() {
  return (
    <svg width="14" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.2 21l.7-4.5H5L7.4 3h7.1c2.9 0 4.7 1.6 4.3 4.3-.5 3.4-2.7 4.9-5.9 4.9h-2.4L9.6 21H7.2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaypalMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7.2 21l.7-4.5H5L7.4 3h7.1c2.9 0 4.7 1.6 4.3 4.3-.5 3.4-2.7 4.9-5.9 4.9h-2.4L9.6 21H7.2z"
        fill="currentColor"
      />
    </svg>
  );
}

function RefreshGiftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.4 8A5.4 5.4 0 0 1 4.2 11.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M2.6 8A5.4 5.4 0 0 1 11.8 4.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13.5 3.1v3.3h-3.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 12.9V9.6h3.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckField({
  checked,
  onChange,
  children,
  className,
  attention,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  className?: string;
  attention?: boolean;
}) {
  return (
    <label
      className={["gafa-check-row", className].filter(Boolean).join(" ")}
      data-attention={attention ? "true" : undefined}
    >
      <input
        className="gafa-check-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="gafa-check-box" aria-hidden="true" />
      <span className="gafa-check-row__text">{children}</span>
    </label>
  );
}

function formatMeetingWhen(value: string, timeZone?: string) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
