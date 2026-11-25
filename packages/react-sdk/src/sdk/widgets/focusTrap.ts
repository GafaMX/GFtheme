const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.matches(":disabled") || el.closest('[inert], [aria-hidden="true"]')) return false;
    return el.getClientRects().length > 0;
  });
}

/** Keeps Tab inside `container`. Call from a capture keydown listener. */
export function trapTabKey(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== "Tab") return;
  const nodes = focusableElements(container);
  if (nodes.length === 0) {
    event.preventDefault();
    return;
  }
  const first = nodes[0]!;
  const last = nodes[nodes.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (active === last || !container.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

export function firstFocusable(container: HTMLElement): HTMLElement | null {
  return focusableElements(container)[0] ?? null;
}
