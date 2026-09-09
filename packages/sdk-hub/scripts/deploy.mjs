#!/usr/bin/env node
/**
 * Deploy the SDK Hub Worker + D1.
 *
 *   CLOUDFLARE_API_TOKEN=… node scripts/deploy.mjs --env production
 *
 * Optional: CLOUDFLARE_ACCOUNT_ID, ADMIN_PASSWORD, ADMIN_SESSION_SECRET.
 * Los secretos que ya existen en el Worker se conservan: un redeploy no le
 * cambia la contraseña a un Hub que está en el aire.
 * Custom domain (hub.buq.partners) is attempted; if the zone is not in this
 * account the script retries without the route and prints the workers.dev URL.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wranglerBin = join(root, "node_modules/.bin/wrangler");
const configPath = join(root, "wrangler.jsonc");

const envName = readArg("--env") ?? "production";
if (envName !== "production" && envName !== "staging") {
  console.error("Use --env production or --env staging");
  process.exit(1);
}

const dbName = envName === "staging" ? "sdk-hub-staging" : "sdk-hub";
const customHost = envName === "staging" ? "hub.buq.com.mx" : "hub.buq.partners";

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function wrangler(args, { input, allowFail = false } = {}) {
  try {
    return execFileSync(wranglerBin, args, {
      cwd: root,
      encoding: "utf8",
      stdio: input ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
      input,
      env: process.env,
    });
  } catch (error) {
    const stderr = error.stderr?.toString() ?? error.message;
    if (allowFail) return stderr;
    throw new Error(stderr || error.message);
  }
}

function parseJson(text) {
  const start = text.indexOf("{") >= 0 && (text.indexOf("[") < 0 || text.indexOf("{") < text.indexOf("["))
    ? text.indexOf("{")
    : text.indexOf("[");
  if (start < 0) throw new Error(`No JSON in wrangler output:\n${text}`);
  return JSON.parse(text.slice(start));
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
  const session = wrangler(["whoami"], { allowFail: true });
  if (!/logged in|OAuth Token/i.test(session)) {
    console.error(
      "Falta login de Cloudflare. O pegas CLOUDFLARE_API_TOKEN, o corres: npx wrangler login --device",
    );
    process.exit(1);
  }
  console.log("Usando la sesión de Wrangler (OAuth). No hace falta CLOUDFLARE_API_TOKEN.");
}

console.log("== whoami ==");
const whoami = wrangler(["whoami"]);
console.log(whoami);

console.log(`== D1 ${dbName} ==`);
let databases = [];
try {
  databases = parseJson(wrangler(["d1", "list", "--json"]));
} catch {
  databases = [];
}
const list = Array.isArray(databases) ? databases : databases.databases ?? databases.result ?? [];
let db = list.find((row) => row.name === dbName || row.database_name === dbName);

if (!db) {
  console.log(`Creating D1 ${dbName}…`);
  const created = wrangler(["d1", "create", dbName]);
  console.log(created);
  const idMatch = created.match(/database_id\s*=\s*"([^"]+)"/i) ?? created.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!idMatch) throw new Error("Could not parse database_id from wrangler d1 create");
  db = { uuid: idMatch[1] ?? idMatch[0], name: dbName };
}

const databaseId = db.uuid ?? db.id ?? db.database_id;
if (!databaseId) throw new Error(`D1 ${dbName} has no id: ${JSON.stringify(db)}`);
console.log(`D1 id: ${databaseId}`);

let config = readFileSync(configPath, "utf8");
const envBlock = new RegExp(`("${envName}"\\s*:\\s*\\{[\\s\\S]*?"database_name":\\s*"${dbName}"[\\s\\S]*?"database_id":\\s*")[^"]+(")`);
if (!envBlock.test(config)) throw new Error(`Could not find ${envName} D1 block in wrangler.jsonc`);
config = config.replace(envBlock, `$1${databaseId}$2`);
writeFileSync(configPath, config);

console.log("== migrations ==");
console.log(wrangler(["d1", "migrations", "apply", dbName, "--remote", "--env", envName]));

console.log("== secrets ==");
const existingSecrets = readSecretNames();

/**
 * Un redeploy no puede cambiarle la contraseña a un Hub que ya está en el aire:
 * solo se escribe el secreto si lo pides explícito o si todavía no existe.
 */
function ensureSecret(name, provided, generate) {
  if (provided) {
    wrangler(["secret", "put", name, "--env", envName], { input: `${provided}\n` });
    console.log(`${name}: actualizado con el valor que pasaste.`);
    return;
  }
  if (existingSecrets.has(name)) {
    console.log(`${name}: ya existe, se conserva.`);
    return;
  }
  const value = generate();
  wrangler(["secret", "put", name, "--env", envName], { input: `${value}\n` });
  console.log(`${name} generado (guárdalo): ${value}`);
}

function readSecretNames() {
  const raw = wrangler(["secret", "list", "--env", envName, "--format", "json"], { allowFail: true });
  try {
    const parsed = parseJson(raw);
    const rows = Array.isArray(parsed) ? parsed : parsed.result ?? [];
    return new Set(rows.map((row) => row.name).filter(Boolean));
  } catch {
    // Worker nuevo o salida inesperada: tratamos todo como faltante.
    return new Set();
  }
}

ensureSecret("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD, () => randomBytes(18).toString("base64url"));
ensureSecret("ADMIN_SESSION_SECRET", process.env.ADMIN_SESSION_SECRET, () =>
  randomBytes(32).toString("base64url"),
);

console.log("== deploy ==");
let deployed = wrangler(["deploy", "--env", envName], { allowFail: true });
console.log(deployed);
if (/error|Error|✘/.test(deployed) && /route|custom domain|zone/i.test(deployed)) {
  console.warn(`Custom domain ${customHost} failed. Retrying without the route (workers.dev).`);
  config = readFileSync(configPath, "utf8");
  config = config.replace(
    new RegExp(`("${envName}"\\s*:\\s*\\{[\\s\\S]*?)\\s*"routes":\\s*\\[[^\\]]*\\],?`),
    "$1",
  );
  writeFileSync(configPath, config);
  deployed = wrangler(["deploy", "--env", envName]);
  console.log(deployed);
}

const workersDev = deployed.match(/https:\/\/[a-z0-9.-]+\.workers\.dev[^\s]*/i);
console.log("\nHub deployed.");
if (workersDev) console.log(`workers.dev: ${workersDev[0]}`);
console.log(`Intended hostname: https://${customHost}`);
console.log("Health: curl -sS https://<host>/v1/health");
console.log("Fitspin WP still unchanged. Next: publish the V2 tracker JS (no points card).");
