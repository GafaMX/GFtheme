import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CartLineType,
  CatalogItem,
  CheckoutConfig,
  GafaClient,
  Meeting,
} from "../client/types";
import {
  cartSubtotal,
  formatMoney,
  useCartStore,
  type CartLine,
  type CartReservationContext,
} from "../cart/cartStore";
import { AuthWidget } from "./AuthWidget";
import type { CaptchaProvider } from "../captcha/CaptchaProvider";
import {
  loadGafaPay,
  mountGafaPayWidget,
  triggerGafaPayConfirm,
  waitForWidgetContent,
  type GafaPayIsland,
  type GafaPayLineItem,
  type GafaPaySuccess,
  type GafaPayWidgetProps,
} from "../payments/gafaPay";
import { findPurchasableItem, sameCatalogId } from "../cart/findPurchasable";

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
  onClose: () => void;
  onCompleted?: (result: { purchaseId?: number | null; reservationId?: number }) => void;
};

type CheckoutStep = "shop" | "auth" | "pay" | "thanks";
type CatalogTab = "packages" | "memberships" | "products";

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
  onClose,
  onCompleted,
}: CheckoutModalProps) {
  const lines = useCartStore((s) => s.lines);
  const reservation = useCartStore((s) => s.reservation);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const setAmount = useCartStore((s) => s.setAmount);
  const setReservation = useCartStore((s) => s.setReservation);
  const resetAfterPurchase = useCartStore((s) => s.resetAfterPurchase);

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
  const [query, setQuery] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState<string>();
  const [discountStatus, setDiscountStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftCode, setGiftCode] = useState("");
  const [giftStatus, setGiftStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [giftLabel, setGiftLabel] = useState<string>();
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [payError, setPayError] = useState<string>();
  // El formulario del proveedor vive fuera de React: sin el listo, "Pagar" no
  // puede hacer nada, asi que no debe quedar habilitado.
  const [paymentReady, setPaymentReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [thanks, setThanks] = useState<{
    purchaseId?: number | null;
    reservationId?: number;
    reservationSnapshot: CartReservationContext | null;
    linesSnapshot: CartLine[];
  } | null>(null);

  // Compra suelta (boton HTML): sin marca/sede explicitas se toma la primera
  // de la compañia, que es lo que un sitio de un solo estudio espera.
  const brandsQuery = useQuery({
    queryKey: ["checkout", "brands"],
    queryFn: () => client.listBrands(),
    enabled: !brandSlugProp,
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

  // Al abrir desde una clase: anclar el contexto de reserva al carrito.
  useEffect(() => {
    if (!meeting || !brandSlug || !locationSlug) return;
    setReservation({
      meetingId: Number(meeting.id),
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
    queryKey: ["checkout", "config", brandSlug, locationSlug, meeting?.id],
    queryFn: () =>
      client.getCheckoutConfig!({
        brandSlug: brandSlug!,
        locationSlug: locationSlug!,
        meetingId: meeting?.id,
      }),
    enabled: Boolean(client.getCheckoutConfig && brandSlug && locationSlug && isSignedIn),
    staleTime: 60_000,
    retry: 1,
  });

  const config = configQuery.data;
  const currency = config?.currency ?? { prefix: "$", suffix: "MXN", code: "MXN" };
  const paymentMethods = config?.paymentMethods ?? [];
  const hasTerms = Boolean(config?.termsConditionsLink);

  // Compra suelta: el catalogo de la MARCA (listCombos), no el recorte de la
  // sede en create-form-template. Si no, un paquete de Lomas no aparece cuando
  // el checkout resolvio Cancun como primera sede.
  const catalogQuery = useQuery({
    queryKey: ["checkout", "catalog", brandSlug],
    queryFn: async () => {
      const [combos, memberships] = await Promise.all([
        client.listCombos(brandSlug!),
        client.listMemberships(brandSlug!),
      ]);
      return { combos, memberships };
    },
    enabled: Boolean(brandSlug) && !meeting,
    staleTime: 60_000,
  });

  const combos = meeting ? (config?.combos ?? []) : (catalogQuery.data?.combos ?? config?.combos ?? []);
  const memberships = meeting
    ? (config?.memberships ?? [])
    : (catalogQuery.data?.memberships ?? config?.memberships ?? []);
  const products = config?.products ?? [];

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

  const relevantLines = meeting
    ? lines.filter((line) => line.brandSlug === brandSlug)
    : lines.filter((line) => {
        if (preselect && sameCatalogId(line.id, preselect.id)) return true;
        if (!brandSlug) return true;
        return line.brandSlug === brandSlug;
      });
  const subtotal = cartSubtotal(relevantLines);
  const total = Math.max(0, subtotal - discountAmount);
  const cartCount = relevantLines.reduce((sum, line) => sum + line.amount, 0);

  const canPay =
    relevantLines.length > 0 &&
    Boolean(selectedMethod) &&
    paymentReady &&
    (!hasTerms || termsAccepted) &&
    !paying;

  async function applyDiscount() {
    if (!client.checkDiscountCode || !discountCode.trim() || !brandSlug || !locationSlug) return;
    setDiscountStatus("checking");
    try {
      const result = await client.checkDiscountCode({
        brandSlug,
        locationSlug,
        code: discountCode.trim(),
        meetingId: meeting?.id ?? reservation?.meetingId,
        lines: relevantLines.map((line) => ({ id: line.id, type: line.type })),
      });
      if (!result.valid) {
        setDiscountStatus("error");
        setDiscountAmount(0);
        setDiscountLabel(undefined);
        return;
      }
      setDiscountStatus("ok");
      setDiscountLabel(result.label);
      setDiscountAmount(result.discountAmount ?? 0);
    } catch {
      setDiscountStatus("error");
      setDiscountAmount(0);
    }
  }

  async function applyGift() {
    if (!client.checkGiftCode || !giftCode.trim() || !brandSlug || !locationSlug) return;
    setGiftStatus("checking");
    try {
      const result = await client.checkGiftCode({ brandSlug, locationSlug, code: giftCode.trim() });
      if (!result.valid) {
        setGiftStatus("error");
        setGiftLabel(undefined);
        return;
      }
      setGiftStatus("ok");
      setGiftLabel(
        result.label ??
          (result.balance != null
            ? `Saldo ${formatMoney(result.balance, currency.prefix, currency.suffix)}`
            : "Gift card válida"),
      );
    } catch {
      setGiftStatus("error");
    }
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
      priceLabel: item.priceLabel ?? formatMoney(price, currency.prefix, ""),
      brandSlug,
      locationSlug,
      expirationLabel: item.expirationDays ? `Expira en ${item.expirationDays} días` : undefined,
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
        priceLabel: match.item.priceLabel ?? formatMoney(price, currency.prefix, ""),
        brandSlug: match.brandSlug,
        locationSlug: locationSlugProp,
        expirationLabel: match.item.expirationDays ? `Expira en ${match.item.expirationDays} días` : undefined,
      });
      setPreselectStatus("ready");
    });
    return () => {
      cancelled = true;
    };
    // currency.prefix es estable por marca; addItem viene del store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect, client, brandSlugProp]);

  // Compra directa: login si falta, si no el paso de pago. Si el socio vuelve
  // al catalogo a proposito, ya no lo empujamos otra vez a pagar.
  useEffect(() => {
    if (!stayOnPayRef.current) return;
    if (step === "shop" || step === "thanks") return;
    if (profileQuery.isLoading) return;
    const next: CheckoutStep = isSignedIn ? "pay" : "auth";
    if (step !== next) setStep(next);
  }, [isSignedIn, profileQuery.isLoading, step]);

  /** Segunda mitad del pago: con payment_data ya tokenizado por GafaPay. */
  async function completePurchase(paymentData: Record<string, unknown>) {
    const profile = profileQuery.data;
    if (!profile || !client.initialPurchase || !selectedMethod || !brandSlug || !locationSlug) return;

    const reservationSnapshot = reservation;
    const linesSnapshot = relevantLines;

    try {
      const checkoutToken =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `chk_${Date.now()}`;

      const purchase = await client.initialPurchase({
        brandSlug,
        locationSlug,
        userId: config?.userProfileId ?? profile.id,
        meetingId: reservation?.meetingId,
        lines: linesSnapshot.map((line) => ({ id: line.id, type: line.type, amount: line.amount })),
        paymentTypeId: selectedMethod.id,
        paymentData,
        discountCode: discountStatus === "ok" ? discountCode.trim() : null,
        giftCode: giftStatus === "ok" ? giftCode.trim() : null,
        checkoutToken,
        seatObjectId: reservation?.seatObjectId,
      });

      let reservationId: number | undefined;
      if (purchase.purchaseId && client.pollInitialPurchaseStatus) {
        reservationId = await waitForPurchase(client, {
          brandSlug,
          locationSlug,
          checkoutToken: purchase.checkoutToken ?? checkoutToken,
          pendingPurchaseId: purchase.purchaseId,
        });
      }

      setThanks({
        purchaseId: purchase.purchaseId,
        reservationId,
        reservationSnapshot,
        linesSnapshot,
      });
      resetAfterPurchase();
      setStep("thanks");
      onCompleted?.({ purchaseId: purchase.purchaseId, reservationId });
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "No pudimos completar el pago.");
    } finally {
      setPaying(false);
    }
  }

  function handleGafaPaySuccess(result: GafaPaySuccess) {
    const paymentData =
      result.message && typeof result.message === "object"
        ? (result.message as Record<string, unknown>)
        : { token: result.message };
    void completePurchase(paymentData);
  }

  function handlePayClick() {
    setPayError(undefined);
    if (!canPay) {
      if (!relevantLines.length) setPayError("Agrega un paquete o membresía para continuar.");
      else if (hasTerms && !termsAccepted) setPayError("Acepta los términos y condiciones para pagar.");
      else if (!paymentReady) setPayError("El formulario de pago todavía no está listo.");
      return;
    }
    setPaying(true);
    // Stripe/Conekta: la confirmación vive en el widget de GafaPay.
    const triggered = triggerGafaPayConfirm(selectedMethod?.slug ?? "");
    if (!triggered) {
      setPaying(false);
      setPayError(
        selectedMethod?.slug === "paypal"
          ? "Usa el botón de PayPal para completar el pago."
          : "El procesador de pago aún no está listo. Intenta de nuevo.",
      );
    }
  }

  return (
    <div
      className="gafa-checkout-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gafa-checkout-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && step !== "thanks") onClose();
      }}
    >
      <div className="gafa-checkout" data-step={step}>
        <button className="gafa-checkout__close" type="button" aria-label="Cerrar" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        {step !== "thanks" ? (
          <div className="gafa-checkout__layout">
            <section className="gafa-checkout__main">
              {reservation ? (
                <p className="gafa-checkout__context">
                  <span className="gafa-checkout__context-dot" aria-hidden="true" />
                  {reservation.serviceName ?? reservation.meetingName} ·{" "}
                  {formatMeetingWhen(reservation.startsAt, reservation.timezone)}
                </p>
              ) : null}

              <header className="gafa-checkout__hero">
                <h2 id="gafa-checkout-title">
                  {step === "auth"
                    ? "Inicia sesión para pagar"
                    : step === "shop"
                      ? reservation
                        ? "Compra para reservar"
                        : "Elige tu plan"
                      : "Pago"}
                </h2>
                <p>
                  {step === "auth"
                    ? "Tu carrito te espera; solo necesitamos tu cuenta para cobrar."
                    : step === "shop"
                      ? reservation
                        ? "Estos son los planes que aplican para esta clase."
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

                  {configQuery.isLoading || catalogQuery.isLoading ? (
                    <p className="gafa-sdk-state">Cargando catálogo…</p>
                  ) : null}
                  {(configQuery.isError && !combos.length && !memberships.length) || catalogQuery.isError ? (
                    <p className="gafa-sdk-state gafa-sdk-state--error">
                      No pudimos cargar el catálogo de esta sede.
                    </p>
                  ) : null}

                  {searchGroups ? (
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
                          inCartAmount={amountInCart(relevantLines, item)}
                          onAdd={() => handleAdd(item)}
                        />
                      ))}
                    </div>
                  )}

                  {!configQuery.isLoading &&
                  !catalogQuery.isLoading &&
                  (search ? searchTotal === 0 : catalogItems.length === 0) ? (
                    <p className="gafa-sdk-state">
                      {search
                        ? "Nada coincide con tu búsqueda."
                        : tab === "packages"
                          ? meeting
                            ? "Esta clase no tiene paquetes disponibles."
                            : "No hay paquetes disponibles."
                          : tab === "memberships"
                            ? meeting
                              ? "Esta clase no tiene membresías disponibles."
                              : "No hay membresías disponibles."
                            : "No hay productos disponibles."}
                    </p>
                  ) : null}
                </>
              ) : preselectStatus === "loading" ? (
                <p className="gafa-sdk-state">Preparando tu compra…</p>
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
                  onReadyChange={setPaymentReady}
                  onError={(message) => {
                    setPaying(false);
                    setPayError(message);
                  }}
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
                  <strong>{reservation.serviceName ?? reservation.meetingName}</strong>
                  <small>
                    {formatMeetingWhen(reservation.startsAt, reservation.timezone)}
                    {reservation.seatLabel ? ` · Lugar ${reservation.seatLabel}` : ""}
                  </small>
                </div>
              ) : null}

              {preselectStatus === "loading" ? (
                <div className="gafa-checkout__empty">
                  <p>Agregando tu plan…</p>
                  <small>Un segundo, estamos cargando el producto.</small>
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
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
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
                      onChange={setDiscountCode}
                      onApply={applyDiscount}
                      status={discountStatus}
                      hint={
                        discountStatus === "ok"
                          ? (discountLabel ?? "Descuento aplicado")
                          : discountStatus === "error"
                            ? "Código no válido"
                            : undefined
                      }
                    />
                  ) : null}

                  {config?.giftCardsEnabled && client.checkGiftCode ? (
                    <PromoDisclosure
                      linkLabel="Canjear gift card"
                      open={giftOpen}
                      onToggle={() => setGiftOpen((v) => !v)}
                      value={giftCode}
                      onChange={setGiftCode}
                      onApply={applyGift}
                      status={giftStatus}
                      hint={
                        giftStatus === "ok"
                          ? giftLabel
                          : giftStatus === "error"
                            ? "Gift card no válida"
                            : undefined
                      }
                    />
                  ) : null}

                  {hasTerms ? (
                    <label className="gafa-checkout__terms">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(event) => setTermsAccepted(event.target.checked)}
                      />
                      <span>
                        Acepto los{" "}
                        <a href={config!.termsConditionsLink!} target="_blank" rel="noreferrer">
                          términos y condiciones
                        </a>
                      </span>
                    </label>
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
                  disabled={!canPay}
                  onClick={handlePayClick}
                >
                  {paying ? "Procesando…" : `Pagar ${formatMoney(total, currency.prefix, "")}`}
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
  );
}

/** Cuantas unidades de este item ya estan en el carrito. */
function amountInCart(lines: CartLine[], item: CatalogItem): number {
  const type: CartLineType =
    item.type === "membership" ? "membership" : item.type === "product" ? "product" : "combo";
  return lines.find((line) => line.id === item.id && line.type === type)?.amount ?? 0;
}

function ProductCard({
  item,
  inCartAmount,
  onAdd,
}: {
  item: CatalogItem;
  inCartAmount: number;
  onAdd: () => void;
}) {
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
        {item.compareAtPriceLabel ? <s>{item.compareAtPriceLabel}</s> : null}
        <strong>{item.priceLabel}</strong>
      </div>
      <h3>{item.name}</h3>
      <p className="gafa-checkout-product__meta">
        {[
          item.expirationDays ? `Vigencia ${item.expirationDays} días` : null,
          item.subscribable ? "Recurrente" : null,
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
  onReadyChange,
  onError,
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
  onReadyChange: (ready: boolean) => void;
  onError: (message: string) => void;
}) {
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string>();
  const selected = methods.find((method) => method.id === selectedMethodId) ?? null;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const islandRef = useRef<GafaPayIsland | null>(null);
  // Los callbacks cambian en cada render; el widget vive fuera de React y no
  // debe re-montarse por eso.
  const handlersRef = useRef({ onSuccess, onError });
  handlersRef.current = { onSuccess, onError };

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
        product_type: line.type,
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
      },
      generalData: {
        companiesId: config?.companiesId,
        locationsId: config?.locationId,
        adminProfilesId: null,
        usersProfilesId: config?.userProfileId,
        usersId: config?.usersId,
      },
      termsAndConditions: config?.termsConditionsLink ?? null,
      hasRecurringPayment: false,
      onGafaPaySuccessAction: (result) => handlersRef.current.onSuccess(result),
      onGafaPayErrAction: ({ message }) =>
        handlersRef.current.onError(message ?? "Ocurrió un error durante el pago."),
    }),
    [lineItems, config?.companiesId, config?.locationId, config?.userProfileId, config?.usersId, config?.termsConditionsLink, customer.email, customer.firstName, customer.lastName, customer.phone],
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
        setLoadError(error instanceof Error ? error.message : undefined);
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

  return (
    <div className="gafa-checkout-pay">
      {configLoading ? <p className="gafa-sdk-state">Cargando métodos de pago…</p> : null}

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
              {method.slug === "stripe" ? <CardIcon /> : method.slug === "paypal" ? <PaypalIcon /> : null}
              {method.slug === "stripe" ? "Tarjeta" : method.name}
            </button>
          ))}
        </div>
      ) : null}

      {!configLoading && methods.length === 0 ? (
        <p className="gafa-sdk-state">Esta sede no tiene métodos de pago en línea activos.</p>
      ) : null}

      {/* GafaPayFront trae su propio React 16: este div es suyo, nuestro React
          nunca toca lo que hay dentro (ver payments/gafaPay.ts). */}
      <div className="gafa-checkout-paymount" data-state={loadState}>
        <div className="gafa-checkout-paymount__island" ref={mountRef} />

        {loadState === "loading" ? (
          <p className="gafa-sdk-state">Conectando con el procesador de pago…</p>
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
}: {
  linkLabel: string;
  open: boolean;
  onToggle: () => void;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void | Promise<void>;
  status: "idle" | "checking" | "ok" | "error";
  hint?: string;
}) {
  if (status === "ok" && hint) {
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
      <button className="gafa-checkout-promo__link" type="button" aria-expanded={open} onClick={onToggle}>
        {linkLabel}
      </button>
      {open ? (
        <>
          <div className="gafa-checkout-promo__row">
            <input
              value={value}
              autoFocus
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onApply();
                }
              }}
              placeholder="Código"
            />
            <button type="button" onClick={() => void onApply()} disabled={status === "checking" || !value.trim()}>
              {status === "checking" ? "…" : "Aplicar"}
            </button>
          </div>
          {status === "error" && hint ? <small>{hint}</small> : null}
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
      <h2 id="gafa-checkout-title">{reservation ? "¡Reserva confirmada!" : "¡Gracias por tu compra!"}</h2>
      <p>
        {firstName ? `${firstName}, tu` : "Tu"} pago quedó registrado
        {thanks?.purchaseId ? ` (orden #${thanks.purchaseId})` : ""}. Te enviamos el detalle por correo.
      </p>

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

async function waitForPurchase(
  client: GafaClient,
  payload: {
    brandSlug: string;
    locationSlug: string;
    checkoutToken: string;
    pendingPurchaseId: number;
  },
): Promise<number | undefined> {
  if (!client.pollInitialPurchaseStatus) return undefined;
  for (let attempt = 0; attempt < 40; attempt++) {
    const status = await client.pollInitialPurchaseStatus(payload);
    if (status.code === 1) return status.reservationId;
    if (status.code === -1) throw new Error(status.message || "El pago no se pudo confirmar.");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  // Compra creada pero el status no resolvió a tiempo: no bloqueamos el thank you.
  return undefined;
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
