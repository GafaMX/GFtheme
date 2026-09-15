import { fullClassAction } from "../client/meetingAvailability";

export type ConciergeReservationCredit = {
  id: string;
  kind: "credit" | "membership";
  name: string;
  remaining?: number;
};

export type ReservationCaseKind =
  | "need_auth"
  | "open_reservation"
  | "need_purchase"
  | "full"
  | "confirm_in_chat"
  | "pick_credit";

export type ReservationCase = {
  kind: ReservationCaseKind;
  waitlist?: boolean;
  credits: ConciergeReservationCredit[];
  /** Solo `open_reservation`: el salón tiene mapa y hay que elegir lugar. */
  reason?: "map" | "inspect_unavailable";
};

export type PlanReservationCaseInput = {
  signedIn: boolean;
  hasMap: boolean;
  soldOut: boolean;
  waitlistAvailable: boolean;
  paymentOptions: ConciergeReservationCredit[];
  contextReady: boolean;
};

/**
 * Clasifica cómo debe reservar Concierge. El chat confirma solo el camino
 * feliz (logueado, cupo, sin mapa, créditos claros). Mapa, auth y compra
 * salen por los popups que ya usa el calendario.
 */
export function planReservationCase(input: PlanReservationCaseInput): ReservationCase {
  const credits = input.paymentOptions;
  if (!input.signedIn) return { kind: "need_auth", credits: [] };
  if (!input.contextReady) {
    return { kind: "open_reservation", credits: [], reason: "inspect_unavailable" };
  }

  const classAction = fullClassAction({
    soldOut: input.soldOut,
    waitlistEnabled: input.waitlistAvailable,
    hasPaymentOption: credits.length > 0,
    contextReady: true,
  });

  if (classAction === "full") return { kind: "full", credits };

  if (input.hasMap) return { kind: "open_reservation", credits, reason: "map" };

  if (classAction === "buy-to-waitlist") {
    return { kind: "need_purchase", waitlist: true, credits: [] };
  }

  if (credits.length === 0) return { kind: "need_purchase", credits: [] };

  const waitlist = classAction === "join-waitlist";
  if (credits.length > 1) return { kind: "pick_credit", waitlist, credits };
  return { kind: "confirm_in_chat", waitlist, credits };
}

export function creditChipLabel(credit: ConciergeReservationCredit): string {
  if (credit.kind === "membership") return `Membresía: ${credit.name}`;
  if (typeof credit.remaining === "number") {
    const unit = credit.remaining === 1 ? "crédito" : "créditos";
    return `${credit.name} · ${credit.remaining} ${unit}`;
  }
  return credit.name;
}

export function confirmReservationLabel(waitlist?: boolean): string {
  return waitlist ? "Apúntame" : "Confirmar reserva";
}

export function reservationCaseCopy(
  plan: ReservationCase,
  item: { className: string; time: string },
): string {
  const when = `${item.className} a las ${item.time}`;
  if (plan.kind === "need_auth") {
    return "Para reservar necesito que inicies sesión.";
  }
  if (plan.kind === "open_reservation") {
    return plan.reason === "map"
      ? "Te abro el salón para que elijas tu lugar."
      : "Te abro el detalle de la clase.";
  }
  if (plan.kind === "need_purchase") {
    return plan.waitlist
      ? `La clase de ${when} está llena y no tienes un crédito que aplique. Compra un paquete o membresía y te sumo a la lista de espera.`
      : `No tienes un crédito que aplique a ${when}. Elige un paquete o membresía para reservar.`;
  }
  if (plan.kind === "full") {
    return "Esta clase está llena y el estudio no tiene lista de espera. ¿Quieres ver otro horario?";
  }
  if (plan.kind === "pick_credit") {
    return plan.waitlist
      ? `La clase de ${when} está llena. ¿Con cuál crédito te apunto a la lista de espera?`
      : `Tienes varios créditos que aplican a ${when}. ¿Con cuál reservo?`;
  }

  const credit = plan.credits[0];
  if (plan.waitlist) {
    const extra = credit
      ? credit.kind === "membership"
        ? ` Se usa tu membresía ${credit.name}.`
        : ` Se usa un crédito de ${credit.name}.`
      : "";
    return `La clase está llena. ¿Te apunto en la lista de espera de ${when}?${extra}`;
  }
  const withWhat = credit
    ? credit.kind === "membership"
      ? ` con tu membresía ${credit.name}`
      : ` con tu paquete ${credit.name}`
    : "";
  return `Puedo reservarte ${when}${withWhat}. ¿Confirmas?`;
}

export function selectedCreditCopy(
  credit: Pick<ConciergeReservationCredit, "name" | "kind">,
  waitlist?: boolean,
): string {
  const withWhat =
    credit.kind === "membership" ? `tu membresía ${credit.name}` : `tu paquete ${credit.name}`;
  return waitlist
    ? `¿Te apunto a la lista de espera con ${withWhat}?`
    : `¿Confirmo la reserva con ${withWhat}?`;
}
