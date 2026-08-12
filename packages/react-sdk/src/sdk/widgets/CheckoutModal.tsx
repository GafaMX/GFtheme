import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
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
import {
  getGafaPayComponent,
  loadGafaPayFront,
  triggerGafaPayConfirm,
  type GafaPayElementsGlobal,
  type GafaPayLineItem,
  type GafaPaySuccess,
} from "../payments/gafaPay";

export type CheckoutModalProps = {
  client: GafaClient;
  brandSlug: string;
  locationSlug: string;
  locationName?: string;
  /** Si viene del calendario: pre-carga contexto de reserva. */
  meeting?: Meeting | null;
  seatObjectId?: number;
  seatLabel?: string;
  gafaPayFrontUrl?: string;
  onClose: () => void;
  onCompleted?: (result: { purchaseId?: number | null; reservationId?: number }) => void;
};

type CheckoutStep = "shop" | "pay" | "thanks";
type CatalogTab = "packages" | "memberships";

/**
 * Checkout nativo v2 (reemplaza al Fancy legacy). Cuando nace de una clase,
 * el catalogo trae SOLO los paquetes/membresias que esa clase acepta
 * (combosSelection/membershipSelection del create-form-template).
 */
export function CheckoutModal({
  client,
  brandSlug,
  locationSlug,
  locationName,
  meeting,
  seatObjectId,
  seatLabel,
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

  const [step, setStep] = useState<CheckoutStep>("shop");
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
  const [paying, setPaying] = useState(false);
  const [thanks, setThanks] = useState<{
    purchaseId?: number | null;
    reservationId?: number;
    reservationSnapshot: CartReservationContext | null;
    linesSnapshot: CartLine[];
  } | null>(null);

  // Al abrir desde una clase: anclar el contexto de reserva al carrito.
  useEffect(() => {
    if (!meeting) return;
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

  const configQuery = useQuery({
    queryKey: ["checkout", "config", brandSlug, locationSlug, meeting?.id],
    queryFn: () =>
      client.getCheckoutConfig!({
        brandSlug,
        locationSlug,
        meetingId: meeting?.id,
      }),
    enabled: Boolean(client.getCheckoutConfig),
    staleTime: 60_000,
    retry: 1,
  });

  const profileQuery = useQuery({
    queryKey: ["checkout", "profile"],
    queryFn: () => client.getProfile(),
    staleTime: 60_000,
  });

  const config = configQuery.data;
  const currency = config?.currency ?? { prefix: "$", suffix: "MXN", code: "MXN" };
  const paymentMethods = config?.paymentMethods ?? [];
  const hasTerms = Boolean(config?.termsConditionsLink);

  useEffect(() => {
    if (selectedMethodId != null) return;
    if (paymentMethods[0]) setSelectedMethodId(paymentMethods[0].id);
  }, [paymentMethods, selectedMethodId]);

  const selectedMethod = paymentMethods.find((method) => method.id === selectedMethodId) ?? null;

  const catalogItems = useMemo(() => {
    const source = tab === "packages" ? config?.combos : config?.memberships;
    const list = source ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [tab, config?.combos, config?.memberships, query]);

  const relevantLines = lines.filter((line) => line.brandSlug === brandSlug);
  const subtotal = cartSubtotal(relevantLines);
  const total = Math.max(0, subtotal - discountAmount);

  const canPay =
    relevantLines.length > 0 &&
    Boolean(selectedMethod) &&
    (!hasTerms || termsAccepted) &&
    !paying;

  async function applyDiscount() {
    if (!client.checkDiscountCode || !discountCode.trim()) return;
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
    if (!client.checkGiftCode || !giftCode.trim()) return;
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
    const type = item.type === "membership" ? "membership" : "combo";
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

  /** Segunda mitad del pago: con payment_data ya tokenizado por GafaPay. */
  async function completePurchase(paymentData: Record<string, unknown>) {
    const profile = profileQuery.data;
    if (!profile || !client.initialPurchase || !selectedMethod) return;

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
                  {step === "shop" ? (reservation ? "Compra para reservar" : "Elige tu plan") : "Pago"}
                </h2>
                <p>
                  {step === "shop"
                    ? reservation
                      ? "Estos son los planes que aplican para esta clase."
                      : "Agrega paquetes o membresías."
                    : "Revisa tu pedido y paga de forma segura."}
                </p>
              </header>

              {step === "shop" ? (
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
                        {config?.combos?.length ? <em>{config.combos.length}</em> : null}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={tab === "memberships"}
                        data-active={tab === "memberships" ? "true" : undefined}
                        onClick={() => setTab("memberships")}
                      >
                        Membresías
                        {config?.memberships?.length ? <em>{config.memberships.length}</em> : null}
                      </button>
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
                        aria-label="Buscar en el catálogo"
                      />
                    </label>
                  </div>

                  {configQuery.isLoading ? <p className="gafa-sdk-state">Cargando catálogo…</p> : null}
                  {configQuery.isError ? (
                    <p className="gafa-sdk-state gafa-sdk-state--error">
                      No pudimos cargar el catálogo de esta sede.
                    </p>
                  ) : null}

                  <div className="gafa-checkout-grid">
                    {catalogItems.map((item) => (
                      <ProductCard
                        key={`${item.type}-${item.id}`}
                        item={item}
                        inCartAmount={
                          relevantLines.find(
                            (line) =>
                              line.id === item.id &&
                              line.type === (item.type === "membership" ? "membership" : "combo"),
                          )?.amount ?? 0
                        }
                        onAdd={() => handleAdd(item)}
                      />
                    ))}
                  </div>

                  {!configQuery.isLoading && !configQuery.isError && catalogItems.length === 0 ? (
                    <p className="gafa-sdk-state">
                      {query
                        ? "Nada coincide con tu búsqueda."
                        : tab === "packages"
                          ? "Esta clase no tiene paquetes disponibles."
                          : "Esta clase no tiene membresías disponibles."}
                    </p>
                  ) : null}
                </>
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
                  onError={(message) => {
                    setPaying(false);
                    setPayError(message);
                  }}
                />
              )}
            </section>

            <aside className="gafa-checkout__cart" aria-label="Tu pedido">
              <div className="gafa-checkout__cart-head">
                <h3>{locationName ?? "Tu pedido"}</h3>
                {relevantLines.length ? (
                  <span>
                    {relevantLines.reduce((n, l) => n + l.amount, 0)}{" "}
                    {relevantLines.reduce((n, l) => n + l.amount, 0) === 1 ? "artículo" : "artículos"}
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

              {relevantLines.length === 0 ? (
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
                  <small>Elige un paquete o membresía para continuar.</small>
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

              {step === "shop" ? (
                <button
                  className="gafa-sdk-button gafa-checkout__cta"
                  type="button"
                  disabled={!relevantLines.length}
                  onClick={() => setStep("pay")}
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

              {step === "pay" ? (
                <button className="gafa-checkout__backlink" type="button" onClick={() => setStep("shop")}>
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

/** Error boundary: si el widget externo de GafaPay truena, no tira el modal. */
class GafaPayBoundary extends React.Component<
  { onError: (message: string) => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message || "El procesador de pago falló al cargar.");
  }

  render() {
    if (this.state.failed) {
      return <p className="gafa-sdk-state gafa-sdk-state--error">No se pudo mostrar el formulario de pago.</p>;
    }
    return this.props.children;
  }
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
  onError: (message: string) => void;
}) {
  const [elements, setElements] = useState<GafaPayElementsGlobal | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const selected = methods.find((method) => method.id === selectedMethodId) ?? null;

  useEffect(() => {
    let cancelled = false;
    loadGafaPayFront(gafaPayFrontUrl)
      .then((loaded) => {
        if (cancelled) return;
        setElements(loaded);
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [gafaPayFrontUrl]);

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

  const cartSignature = lineItems.map((item) => `${item.product_id}x${item.quantity}@${item.unitPrice}`).join("|");

  const PaymentComponent = elements && selected ? getGafaPayComponent(elements, selected.slug) : null;

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

      <div className="gafa-checkout-paymount" data-loading={loadState === "loading" ? "true" : undefined}>
        {loadState === "loading" ? <p className="gafa-sdk-state">Conectando con el procesador de pago…</p> : null}
        {loadState === "error" ? (
          <p className="gafa-sdk-state gafa-sdk-state--error">
            No se pudo conectar con GafaPay. Revisa tu conexión e intenta de nuevo.
          </p>
        ) : null}
        {loadState === "ready" && PaymentComponent && selected ? (
          <GafaPayBoundary onError={onError}>
            <PaymentComponent
              key={`${selected.slug}-${cartSignature}`}
              order={{
                customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim(),
                customerEmail: customer.email,
                customerPhone: customer.phone,
                lineItems,
              }}
              generalData={{
                companiesId: config?.companiesId,
                locationsId: config?.locationId,
                adminProfilesId: null,
                usersProfilesId: config?.userProfileId,
                usersId: config?.usersId,
              }}
              termsAndConditions={config?.termsConditionsLink ?? null}
              hasRecurringPayment={false}
              onGafaPaySuccessAction={onSuccess}
              onGafaPayErrAction={({ message }) =>
                onError(message ?? "Ocurrió un error durante el pago.")
              }
            />
          </GafaPayBoundary>
        ) : null}
        {loadState === "ready" && selected && !PaymentComponent ? (
          <p className="gafa-sdk-state gafa-sdk-state--error">
            GafaPay no soporta el método “{selected.name}” en esta versión.
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
