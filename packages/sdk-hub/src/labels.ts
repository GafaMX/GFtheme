export const EVENT_LABELS: Record<string, string> = {
  "sdk.heartbeat": "Pulso",
  "widget.mounted": "Widget listo",
  "widget.error": "Error de widget",
  "calendar.viewed": "Calendario visto",
  "calendar.filter_changed": "Filtro del calendario",
  "calendar.meeting_opened": "Clase abierta",
  "auth.login_succeeded": "Entró a su cuenta",
  "auth.login_failed": "Login fallido",
  "auth.registered": "Se registró",
  "auth.logged_out": "Cerró sesión",
  "reservation.previewed": "Vio una clase",
  "reservation.confirmed": "Reservó",
  "reservation.waitlisted": "Lista de espera",
  "reservation.cancelled": "Canceló",
  "checkout.opened": "Abrió el pago",
  "checkout.paid": "Compró",
  "checkout.failed": "Pago fallido",
  "catalog.item_opened": "Vio un paquete",
  "purchase_button.clicked": "Clic en comprar",
  "concierge.opened": "Abrió Concierge",
  "concierge.message_sent": "Mensaje al Concierge",
  "admin.grant": "Ajuste manual",
};

export const WIDGET_LABELS: Record<string, string> = {
  "meetings-calendar": "Calendario",
  "combo-list": "Paquetes",
  "membership-list": "Membresías",
  "staff-list": "Coaches",
  "service-list": "Servicios",
  "login": "Login",
  "register": "Registro",
  "password-recovery": "Recuperar contraseña",
  "login-register": "Mi cuenta",
  "login-register-pages": "Auth en página",
  "profile-info": "Perfil",
  "purchase-button": "Botón de compra",
  fancy: "Checkout",
  concierge: "Concierge",
  auth: "Cuenta",
  calendar: "Calendario",
  catalog: "Catálogo",
  checkout: "Pago",
  profile: "Perfil",
};

const KNOWN_HOSTS: Record<string, string> = {
  "fitspin.mx": "Fitspin",
  "hybrix.mx": "Hybrix",
  "insightstudio.mx": "Insight Studio",
  "forzaroom.com": "Forza Room",
};

const PLATFORM_HOST = /(^|\.)(buq\.(mx|partners|com\.mx|technology)|replit\.dev|workers\.dev)$/i;

export function eventLabel(name: string | null | undefined): string {
  if (!name) return "Evento";
  return EVENT_LABELS[name] ?? name.replace(/[._]/g, " ");
}

export function widgetLabel(shortcode: string | null | undefined): string {
  if (!shortcode) return "Widget";
  return WIDGET_LABELS[shortcode] ?? shortcode.replace(/[-_]/g, " ");
}

export function titleCaseSlug(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function studioName(host: string | null | undefined, path: string | null | undefined = "/"): string {
  if (!host || host === "localhost" || host === "127.0.0.1") return "Local";
  const clean = host.replace(/^www\./i, "").toLowerCase();
  if (KNOWN_HOSTS[clean]) return KNOWN_HOSTS[clean];

  const firstPath = (path ?? "/").split("/").filter(Boolean)[0] ?? "";
  const firstLabel = clean.split(".")[0] ?? clean;
  const isPlatform = PLATFORM_HOST.test(clean) || firstLabel === "web" || firstLabel === "app";
  if (isPlatform && firstPath) return titleCaseSlug(firstPath);
  return titleCaseSlug(firstLabel);
}

export function siteKey(companyId: number, host: string, path = "/"): string {
  const first = (path || "/").split("/").filter(Boolean)[0] ?? "";
  return `${companyId}|${host.toLowerCase()}|${first}`;
}

export function personAlias(companyId: number, userId: number): string {
  let n = (Math.imul(companyId, 2654435761) ^ Math.imul(userId, 2246822519)) >>> 0;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) {
    out += alphabet[n % alphabet.length];
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
  }
  return out;
}

export function personLabel(input: {
  companyId: number;
  userId: number | null | undefined;
  host?: string | null;
  path?: string | null;
  displayName?: string | null;
}): string {
  if (input.displayName?.trim()) return input.displayName.trim();
  if (input.userId == null || input.userId <= 0) return "Visitante";
  return `${studioName(input.host, input.path)} · ${personAlias(input.companyId, input.userId)}`;
}

export const EVENT_OPTIONS = Object.entries(EVENT_LABELS).map(([name, label]) => ({ name, label }));
