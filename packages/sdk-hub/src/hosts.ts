export type TrafficEnv = "prod" | "dev" | "all";

const DEV_EXACT = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const DEV_SUFFIXES = [".replit.dev", ".repl.co", ".workers.dev", ".pages.dev", ".ngrok.io", ".ngrok-free.app"];

export function envFromQuery(value: string | null | undefined): TrafficEnv {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "dev" || raw === "development") return "dev";
  if (raw === "all") return "all";
  return "prod";
}

export function isDevelopmentHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const clean = host.replace(/^www\./i, "").toLowerCase();
  if (DEV_EXACT.has(clean)) return true;
  return DEV_SUFFIXES.some((suffix) => clean.endsWith(suffix));
}

export function hostKind(host: string | null | undefined): "prod" | "dev" {
  return isDevelopmentHost(host) ? "dev" : "prod";
}

/** SQL fragment: production hosts only, or the inverse for pruebas. */
export function hostScopeSql(column: string, env: TrafficEnv): string | null {
  if (env === "all") return null;
  const prod = `(
    ${column} IS NOT NULL
    AND lower(${column}) NOT IN ('localhost', '127.0.0.1', '0.0.0.0')
    AND lower(${column}) NOT LIKE '%.replit.dev'
    AND lower(${column}) NOT LIKE '%.repl.co'
    AND lower(${column}) NOT LIKE '%.workers.dev'
    AND lower(${column}) NOT LIKE '%.pages.dev'
    AND lower(${column}) NOT LIKE '%.ngrok.io'
    AND lower(${column}) NOT LIKE '%.ngrok-free.app'
  )`;
  return env === "prod" ? prod : `NOT ${prod}`;
}
