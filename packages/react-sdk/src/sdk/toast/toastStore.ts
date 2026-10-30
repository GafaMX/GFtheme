export type ToastTone = "error" | "success" | "warning" | "info";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type Listener = () => void;

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getToasts(): Toast[] {
  return toasts;
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Una alerta por mensaje: reenviar el mismo error no apila toasts.
 * El host las cierra solo a los ~5s.
 */
export function showToast(message: string, tone: ToastTone = "error"): string {
  const text = message.trim();
  if (!text) return "";
  toasts = toasts.filter((toast) => toast.message !== text || toast.tone !== tone);
  const id = `gafa-toast-${nextId++}`;
  toasts = [...toasts, { id, message: text, tone }];
  emit();
  return id;
}

export function dismissToast(id: string) {
  const next = toasts.filter((toast) => toast.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function clearToasts() {
  if (toasts.length === 0) return;
  toasts = [];
  emit();
}
