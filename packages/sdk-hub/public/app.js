const root = document.getElementById("root");

const state = {
  view: "sites",
  me: false,
  loading: false,
  error: "",
  env: "",
  siteKey: "",
  eventName: "",
  q: "",
  days: "7",
  pages: { sites: 1, events: 1, ranking: 1, ledger: 1 },
  directory: { sites: [], people: [], events: [] },
  stats: null,
  sites: { items: [], total: 0, page: 1, pages: 1, per_page: 24 },
  events: { items: [], total: 0, page: 1, pages: 1, per_page: 25 },
  funnel: { steps: [], days: 7 },
  ranking: { items: [], total: 0, page: 1, pages: 1 },
  ledger: { items: [], total: 0, page: 1, pages: 1 },
  rules: [],
  widgets: [],
  grantPerson: "",
  grantPoints: "10",
  grantReason: "",
};

const TITLES = {
  sites: ["Sitios", "Dónde está vivo el SDK, con el nombre del estudio. No hace falta memorizar números."],
  usage: ["Actividad", "El pulso del negocio. Los gráficos salen de totales diarios, no de bajar toda la bitácora."],
  events: ["Bitácora", "Cada gesto del SDK. 25 por página. Los crudos se guardan 90 días; los totales se quedan."],
  loyalty: ["Lealtad", "Puntos en el Hub. Las cuentas se ven por estudio y alias, no por user_id."],
  catalog: ["Widgets", "Lo que un sitio puede montar. El shortcode queda detrás del nombre."],
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

function selectedSite() {
  return state.directory.sites.find((site) => site.key === state.siteKey) ?? null;
}

function siteParams() {
  const site = selectedSite();
  return {
    company_id: site?.company_id ?? "",
    host: site?.host ?? "",
    q: state.q,
    event: state.eventName,
    days: state.days,
  };
}

async function boot() {
  try {
    const health = await fetch("/v1/health").then((r) => r.json()).catch(() => ({}));
    state.env = health.environment ?? "";
  } catch {
    state.env = "";
  }
  await refresh();
}

async function refresh() {
  try {
    await api("/v1/admin/me");
    state.me = true;
    state.error = "";
    state.loading = true;
    render();
    const params = siteParams();
    const [directory, stats] = await Promise.all([api("/v1/admin/directory"), api("/v1/admin/stats")]);
    state.directory = directory;
    state.stats = stats;
    if (state.view === "sites") {
      state.sites = await api(
        `/v1/admin/installations${qs({ ...params, page: state.pages.sites, per_page: 24 })}`,
      );
    } else if (state.view === "usage") {
      state.funnel = await api(`/v1/admin/funnel${qs({ company_id: params.company_id, days: state.days })}`);
    } else if (state.view === "events") {
      state.events = await api(`/v1/admin/events${qs({ ...params, page: state.pages.events, per_page: 25 })}`);
    } else if (state.view === "loyalty") {
      const [ranking, ledger, rules] = await Promise.all([
        api(`/v1/admin/loyalty/ranking${qs({ company_id: params.company_id, page: state.pages.ranking, per_page: 20 })}`),
        api(`/v1/admin/loyalty/ledger${qs({ company_id: params.company_id, page: state.pages.ledger, per_page: 25 })}`),
        api(`/v1/admin/loyalty/rules${qs({ company_id: params.company_id || "0" })}`),
      ]);
      state.ranking = ranking;
      state.ledger = ledger;
      state.rules = rules.effective ?? [];
    } else {
      const widgets = await api("/v1/widgets");
      state.widgets = widgets.widgets ?? [];
    }
    state.loading = false;
  } catch (error) {
    state.loading = false;
    if (error.status === 401) state.me = false;
    else state.error = error.message;
  }
  render();
}

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") el.className = value;
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value != null && value !== false) el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

function render() {
  root.replaceChildren(state.me ? renderApp() : renderLogin());
}

function renderLogin() {
  return h(
    "section",
    { class: "login" },
    h(
      "form",
      {
        class: "login-card",
        onSubmit: async (event) => {
          event.preventDefault();
          const password = new FormData(event.currentTarget).get("password");
          try {
            await api("/v1/admin/login", {
              method: "POST",
              body: JSON.stringify({ password: typeof password === "string" ? password : "" }),
            });
            await refresh();
          } catch (error) {
            state.error =
              error.message === "missing_admin_password"
                ? "Falta la contraseña del Hub en este entorno."
                : "Esa contraseña no entra.";
            render();
          }
        },
      },
      h("div", { class: "login-kicker" }, "Buq"),
      h("h1", {}, "Hub"),
      h("p", {}, "El tablero de lo que está pasando en el SDK. Sitios, reservas, compras — con nombres, no con IDs."),
      h("label", { for: "admin-password" }, "Contraseña"),
      h("input", {
        id: "admin-password",
        name: "password",
        type: "password",
        autocomplete: "current-password",
        placeholder: "Tu llave de operación",
      }),
      state.env && state.env !== "production" ? h("p", { class: "muted" }, "Local: buq-hub-dev") : null,
      h("p", { class: "error" }, state.error),
      h("button", { class: "btn wide", type: "submit" }, "Entrar"),
    ),
  );
}

function icon(path) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", path);
  svg.append(p);
  return svg;
}

function renderApp() {
  const [title, lede] = TITLES[state.view];
  return h(
    "div",
    { class: "app" },
    h(
      "aside",
      { class: "side" },
      h("div", { class: "brand" }, h("small", {}, "Buq"), h("h1", {}, "Hub")),
      h(
        "nav",
        {},
        navBtn("sites", "Sitios", "M4 7h16M4 12h10M4 17h16"),
        navBtn("usage", "Actividad", "M4 19V5m4 14V9m4 10V7m4 12v-6m4 6V8"),
        navBtn("events", "Bitácora", "M5 5h14v14H5zM8 9h8M8 13h5"),
        navBtn("loyalty", "Lealtad", "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"),
        navBtn("catalog", "Widgets", "M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z"),
      ),
      h(
        "div",
        { class: "side-foot" },
        h(
          "p",
          { class: "muted" },
          state.stats
            ? `${fmt(state.stats.sites)} sitios · ${fmt(state.stats.events)} eventos guardados`
            : "Cargando el pulso…",
        ),
        h(
          "button",
          {
            class: "btn ghost",
            style: "width:100%;margin-top:14px",
            onClick: async () => {
              await api("/v1/admin/logout", { method: "POST" });
              state.me = false;
              render();
            },
          },
          "Salir",
        ),
      ),
    ),
    h(
      "main",
      { class: "main" },
      h("div", { class: "top" }, h("div", {}, h("h2", {}, title), h("p", { class: "lede muted" }, lede))),
      renderFilters(),
      state.error ? h("p", { class: "error" }, state.error) : null,
      state.loading ? h("p", { class: "loading" }, "Cargando…") : renderView(),
    ),
  );
}

function navBtn(view, label, d) {
  return h(
    "button",
    {
      class: `nav-btn${state.view === view ? " active" : ""}`,
      onClick: () => {
        state.view = view;
        refresh();
      },
    },
    icon(d),
    label,
  );
}

function renderFilters() {
  const sites = [
    h("option", { value: "" }, "Todos los estudios"),
    ...state.directory.sites.map((site) => h("option", { value: site.key }, site.name)),
  ];
  const events = [
    h("option", { value: "" }, "Todos los gestos"),
    ...(state.directory.events ?? []).map((event) => h("option", { value: event.name }, event.label)),
  ];
  return h(
    "div",
    { class: "filters" },
    h(
      "select",
      {
        value: state.siteKey,
        onChange: (event) => {
          state.siteKey = event.target.value;
          resetPages();
        },
      },
      ...sites,
    ),
    state.view === "events"
      ? h(
          "select",
          {
            value: state.eventName,
            onChange: (event) => {
              state.eventName = event.target.value;
              state.pages.events = 1;
            },
          },
          ...events,
        )
      : null,
    state.view === "usage"
      ? h(
          "div",
          { class: "seg" },
          ["7", "30", "90"].map((days) =>
            h(
              "button",
              {
                type: "button",
                class: state.days === days ? "active" : "",
                onClick: () => {
                  state.days = days;
                  refresh();
                },
              },
              `${days} días`,
            ),
          ),
        )
      : null,
    state.view === "sites" || state.view === "events"
      ? h("input", {
          placeholder: "Buscar sitio o página",
          value: state.q,
          onChange: (event) => {
            state.q = event.target.value;
          },
        })
      : null,
    h(
      "button",
      {
        class: "btn",
        onClick: () => {
          resetPages();
          refresh();
        },
      },
      "Ver",
    ),
  );
}

function resetPages() {
  state.pages = { sites: 1, events: 1, ranking: 1, ledger: 1 };
}

function renderView() {
  if (state.view === "sites") return renderSites();
  if (state.view === "usage") return renderUsage();
  if (state.view === "events") return renderEvents();
  if (state.view === "loyalty") return renderLoyalty();
  return renderCatalog();
}

function renderSites() {
  const items = state.sites.items ?? state.sites.installations ?? [];
  const live = items.filter((row) => minutesAgo(row.last_seen_at) < 15).length;
  return h(
    "div",
    {},
    h(
      "div",
      { class: "grid" },
      stat("En vivo", live, "vistos en 15 min"),
      stat("Estudios", state.stats?.studios ?? 0, "compañías distintas"),
      stat("Sitios", state.stats?.sites ?? 0, "páginas con el SDK"),
      stat("Eventos", state.stats?.events ?? 0, "en la bitácora"),
    ),
    items.length
      ? h(
          "div",
          { class: "sites" },
          items.map((row) => siteCard(row)),
        )
      : empty("Todavía no hay sitios", "En cuanto un estudio cargue el SDK, aparece aquí con su nombre."),
    pager(state.sites, (page) => {
      state.pages.sites = page;
      refresh();
    }),
  );
}

function siteCard(row) {
  const name = row.studio || row.host;
  const live = minutesAgo(row.last_seen_at) < 15;
  return h(
    "article",
    { class: "site-card" },
    avatar(name),
    h(
      "div",
      {},
      h("h3", {}, name),
      h("div", { class: "where" }, `${row.host}${row.path === "/" ? "" : row.path}`),
      h(
        "div",
        { class: "chips" },
        (row.widget_labels?.length ? row.widget_labels : row.widgets ?? []).map((widget) =>
          h("span", { class: "chip" }, widget),
        ),
      ),
    ),
    h(
      "div",
      {},
      live
        ? h("div", { class: "pulse" }, h("i"), "En vivo")
        : h("div", { class: "muted", style: "font-size:12px" }, relTime(row.last_seen_at)),
    ),
  );
}

function renderUsage() {
  const steps = state.funnel.steps ?? [];
  const max = Math.max(1, ...steps.map((step) => step.count));
  return h(
    "div",
    { class: "stack" },
    h(
      "div",
      { class: "health" },
      h(
        "div",
        { class: "panel", style: "padding:22px" },
        h("h3", {}, "Cómo se guarda"),
        h(
          "p",
          { class: "muted" },
          "Cada gesto entra a D1. El admin nunca baja más de 25 filas. Los gráficos leen totales diarios (rollups), así que el funnel sigue rápido aunque la bitácora crezca. A los 90 días se limpian eventos crudos; los totales se quedan.",
        ),
      ),
      h(
        "div",
        { class: "panel", style: "padding:22px" },
        h("h3", {}, "Capacidad"),
        h(
          "p",
          { class: "muted" },
          `${fmt(state.stats?.events ?? 0)} eventos crudos · ${fmt(state.stats?.rollup_days ?? 0)} días agregados · ${fmt(state.stats?.people ?? 0)} cuentas vistas. D1 aguanta millones de filas; esto está pensado para mucho movimiento.`,
        ),
      ),
    ),
    h(
      "div",
      { class: "panel", style: "padding:22px" },
      h("h3", {}, `Embudo · ${state.funnel.days ?? state.days} días`),
      h(
        "div",
        { class: "funnel" },
        steps.map((step) =>
          h(
            "div",
            { class: "funnel-row" },
            h("div", {}, step.label),
            h("div", { class: "bar" }, h("span", { style: `width:${Math.round((step.count / max) * 100)}%` })),
            h("b", {}, fmt(step.count)),
            h("div", { class: "conv" }, step.conversion ? `${step.conversion}%` : "—"),
          ),
        ),
      ),
    ),
  );
}

function renderEvents() {
  const items = state.events.items ?? state.events.events ?? [];
  return h(
    "div",
    {},
    table(
      ["Cuándo", "Qué pasó", "Dónde", "Quién"],
      items.map((row) => [
        h("div", {}, relTime(row.ts), h("span", { class: "sub" }, absTime(row.ts))),
        h("div", {}, h("div", { class: "what" }, row.event_label || row.name), row.widget_label ? h("span", { class: "sub" }, row.widget_label) : null),
        h("div", {}, row.studio || "—", h("span", { class: "sub" }, `${row.host ?? ""}${row.path && row.path !== "/" ? row.path : ""}`)),
        row.person || "Visitante",
      ]),
      "Nadie ha usado el SDK con estos filtros.",
    ),
    pager(state.events, (page) => {
      state.pages.events = page;
      refresh();
    }),
  );
}

function renderLoyalty() {
  const ranking = state.ranking.items ?? state.ranking.ranking ?? [];
  const ledger = state.ledger.items ?? state.ledger.ledger ?? [];
  const people = ranking.map((row) =>
    h("option", { value: `${row.company_id}:${row.user_id}` }, `${row.name} · ${fmt(row.points)} pts`),
  );
  return h(
    "div",
    { class: "stack" },
    h(
      "div",
      { class: "grid" },
      stat("Cuentas", state.ranking.total ?? ranking.length, "con puntos"),
      stat("Movimientos", state.ledger.total ?? ledger.length, "en el ledger"),
      stat("Reglas", state.rules.length, "qué suma y qué resta"),
      stat("Top", ranking[0] ? `${fmt(ranking[0].points)} pts` : "—", ranking[0]?.name ?? "sin ranking"),
    ),
    h("h3", {}, "Ranking"),
    ranking.length
      ? h(
          "div",
          { class: "stack" },
          ranking.map((row, index) =>
            h(
              "div",
              { class: "leader" },
              h("div", { class: "rank" }, rankLabel(state.ranking, index)),
              avatar(row.name),
              h("div", {}, h("b", {}, row.name), h("span", { class: "sub" }, row.tier?.label ?? "Bronze")),
              h("div", { class: `pts tier-${row.tier?.id ?? "bronze"}` }, fmt(row.points)),
            ),
          ),
        )
      : empty("Nadie tiene puntos todavía", "Cuando alguien se registre o reserve con cuenta, aparece aquí."),
    pager(state.ranking, (page) => {
      state.pages.ranking = page;
      refresh();
    }),
    h("h3", {}, "Ajuste"),
    h(
      "form",
      {
        class: "grant",
        onSubmit: onGrant,
      },
      h(
        "label",
        {},
        "Cuenta",
        h(
          "select",
          {
            value: state.grantPerson,
            onChange: (event) => {
              state.grantPerson = event.target.value;
            },
          },
          h("option", { value: "" }, ranking.length ? "Elige a alguien del ranking" : "No hay cuentas aún"),
          ...people,
        ),
      ),
      h(
        "label",
        {},
        "Puntos",
        h("input", {
          value: state.grantPoints,
          onInput: (event) => {
            state.grantPoints = event.target.value;
          },
        }),
      ),
      h(
        "label",
        {},
        "Motivo",
        h("input", {
          placeholder: "Cortesía, corrección…",
          value: state.grantReason,
          onInput: (event) => {
            state.grantReason = event.target.value;
          },
        }),
      ),
      h("button", { class: "btn", type: "submit" }, "Sumar"),
    ),
    h("h3", {}, "Cómo se ganan"),
    h(
      "div",
      { class: "rules" },
      state.rules.map((row) =>
        h(
          "div",
          { class: "rule" },
          h("div", { class: "muted" }, row.event_label || row.label || row.event_name),
          h("b", {}, `${row.points > 0 ? "+" : ""}${row.points} pts`),
          h("div", { class: "muted" }, row.once_per_user ? "Una vez por cuenta" : row.daily_cap ? `Hasta ${row.daily_cap} al día` : row.scope),
        ),
      ),
    ),
    h("h3", {}, "Movimientos"),
    table(
      ["Cuándo", "Quién", "Qué", "Puntos"],
      ledger.map((row) => [
        relTime(row.ts),
        row.person || row.studio,
        row.event_label || row.event_name,
        h("b", { class: Number(row.points) < 0 ? "tier-bronze" : "tier-gold" }, `${Number(row.points) > 0 ? "+" : ""}${row.points}`),
      ]),
      "El ledger está quieto.",
    ),
    pager(state.ledger, (page) => {
      state.pages.ledger = page;
      refresh();
    }),
  );
}

async function onGrant(event) {
  event.preventDefault();
  const [company, user] = state.grantPerson.split(":");
  const points = Number(state.grantPoints);
  if (!company || !user || !points) {
    state.error = "Elige una cuenta del ranking y una cantidad distinta de cero.";
    render();
    return;
  }
  try {
    await api("/v1/admin/loyalty/grant", {
      method: "POST",
      body: JSON.stringify({
        company_id: Number(company),
        user_id: Number(user),
        points,
        reason: state.grantReason || "ajuste",
      }),
    });
    state.grantReason = "";
    state.error = "";
    await refresh();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

function renderCatalog() {
  return h(
    "div",
    { class: "widgets" },
    state.widgets.map((row) =>
      h(
        "article",
        { class: "panel widget-card" },
        h("span", { class: `tag ${row.status}` }, row.status === "stable" ? "Listo" : "En preview"),
        h("h3", {}, row.title),
        h("p", { class: "muted" }, row.description ?? ""),
      ),
    ),
  );
}

function stat(label, value, hint) {
  return h("div", { class: "stat" }, h("span", { class: "muted" }, label), h("b", {}, fmt(value)), hint ? h("span", { class: "hint" }, hint) : null);
}

function table(headers, rows, emptyText) {
  if (!rows.length) return empty("Nada por aquí", emptyText);
  return h(
    "div",
    { class: "panel table-wrap" },
    h(
      "table",
      {},
      h("thead", {}, h("tr", {}, ...headers.map((header) => h("th", {}, header)))),
      h(
        "tbody",
        {},
        rows.map((cols) => h("tr", {}, ...cols.map((col) => h("td", {}, col)))),
      ),
    ),
  );
}

function pager(meta, onPage) {
  const total = Number(meta?.total ?? 0);
  const page = Number(meta?.page ?? 1);
  const pages = Number(meta?.pages ?? 1);
  const per = Number(meta?.per_page ?? 25);
  if (total <= per && pages <= 1) return null;
  const from = (page - 1) * per + 1;
  const to = Math.min(total, page * per);
  return h(
    "div",
    { class: "pager" },
    h("span", { class: "muted" }, `${fmt(from)}–${fmt(to)} de ${fmt(total)}`),
    h(
      "div",
      { class: "pager-btns" },
      h(
        "button",
        {
          disabled: page <= 1,
          onClick: () => onPage(page - 1),
        },
        "Anterior",
      ),
      h(
        "button",
        {
          disabled: page >= pages,
          onClick: () => onPage(page + 1),
        },
        "Siguiente",
      ),
    ),
  );
}

function empty(title, text) {
  return h("div", { class: "empty" }, h("b", {}, title), text);
}

function avatar(name) {
  const label = (name || "?").trim();
  const letter = label.charAt(0).toUpperCase();
  const hue = [...label].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  const el = h("div", { class: "avatar" }, letter);
  el.style.background = `hsl(${hue} 55% 62%)`;
  return el;
}

function rankLabel(meta, index) {
  return (Number(meta.page ?? 1) - 1) * Number(meta.per_page ?? 20) + index + 1;
}

function minutesAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 9999;
  return (Date.now() - date.getTime()) / 60000;
}

function relTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 14) return `hace ${days} d`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function absTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function fmt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "—";
  return n.toLocaleString("es-MX");
}

boot();
