export const FUNNEL_STEPS = [
  { event: "calendar.viewed", label: "Vieron el calendario" },
  { event: "auth.login_succeeded", label: "Entraron a su cuenta" },
  { event: "reservation.confirmed", label: "Reservaron" },
  { event: "checkout.opened", label: "Abrieron el pago" },
  { event: "checkout.paid", label: "Compraron" },
] as const;

export type FunnelStep = {
  event: string;
  label: string;
  count: number;
  share: number;
  from_previous: number | null;
};

export function buildFunnelSteps(byName: Map<string, number>): FunnelStep[] {
  const first = byName.get(FUNNEL_STEPS[0].event) ?? 0;
  return FUNNEL_STEPS.map((step, index, list) => {
    const count = byName.get(step.event) ?? 0;
    const prev = index === 0 ? count : (byName.get(list[index - 1]?.event ?? "") ?? 0);
    return {
      event: step.event,
      label: step.label,
      count,
      share: first > 0 ? Math.round((count / first) * 100) : 0,
      from_previous: index === 0 ? null : prev > 0 ? Math.round((count / prev) * 100) : null,
    };
  });
}
