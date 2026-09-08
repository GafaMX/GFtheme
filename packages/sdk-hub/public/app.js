const root = document.getElementById("root");

const state = {
  view: "sites",
  me: false,
  loading: false,
  error: "",
  env: "",
  traffic: "prod",
  siteKey: "",
  eventName: "",
  q: "",
  days: "7",
  pages: { sites: 1, events: 1, ranking: 1, ledger: 1 },
  directory: { sites: [], people: [], events: [] },
  stats: null,
  sites: { items: [], total: 0, page: 1, pages: 1, per_page: 24 },
  events: { items: [], total: 0, page: 1, pages: 1, per_page: 25 },
  funnel: { steps: [], days: 7, note: "" },
  loyaltyMode: "buq",
  loyaltyTab: "clients",
  loyaltyOverview: { studios: [], totals: { studios: 0, members: 0, points: 0, issued: 0, movements: 0 } },
  ranking: { items: [], total: 0, page: 1, pages: 1 },
  ledger: { items: [], total: 0, page: 1, pages: 1 },
  rules: [],
  widgets: [],
  grantPerson: "",
  grantPoints: "10",
  grantReason: "",
  remoteConfig: { company_id: null, config: {}, updated_at: null, stripped: [] },
  configDraft: {
    concierge: "unset",
    displayName: "",
    whatsapp: "",
    colorScheme: "",
    allowUserColorScheme: "",
    brand: "",
    logoUrl: "",
    showMembershipOptions: false,
    analytics: true,
    json: "{}",
  },
  configSaving: false,
  configNotice: "",
};

function pageCopy() {
  if (state.view === "loyalty" && state.loyaltyMode === "studio") {
    const name = selectedSite()?.name ?? "un estudio";
    return [
      `Lealtad · ${selectedSite()?.name ?? "Estudio"}`,
      `Lo que vería el operador de ${name}: clientes, movimientos y cómo se ganan los puntos.`,
    ];
  }
  if (state.view === "loyalty") {
    return [
      "Lealtad · Buq",
      "La red. Estudios con programa, socios y puntos en circulación. Abre un estudio para ver la consola del operador.",
    ];
  }
  return (
    {
      sites: ["Sitios", "Dónde está vivo el SDK, con el nombre del estudio. No hace falta memorizar números."],
      usage: ["Actividad", "El pulso del negocio. Cada barra es un conteo aparte, no las mismas personas. Por defecto sin Replit ni localhost."],
      events: ["Bitácora", "Cada gesto del SDK. 25 por página. Los crudos se guardan 90 días; los totales se quedan."],
      catalog: ["Widgets", "Lo que un sitio puede montar. Clic en la tarjeta abre la guía en otra pestaña."],
      config: [
        "Remote config",
        "Partial del SDK para este estudio. El secret no se guarda. Concierge no enciende la barra: hace falta el nodo en esa página.",
      ],
    }[state.view] ?? ["Hub", ""]
  );
}

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

function siteForCompany(companyId) {
  const matches = state.directory.sites.filter((site) => Number(site.company_id) === Number(companyId));
  return matches.find((site) => site.env !== "dev") ?? matches[0] ?? null;
}

function siteParams() {
  const site = selectedSite();
  const studioLocked = state.view === "loyalty" && state.loyaltyMode === "studio";
  const network = state.view === "loyalty" && state.loyaltyMode === "buq";
  return {
    company_id: network ? "" : site?.company_id ?? "",
    host: network || studioLocked ? "" : site?.host ?? "",
    q: state.q,
    event: state.eventName,
    days: state.days,
    env: state.traffic,
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
    const [directory, stats] = await Promise.all([
      api(`/v1/admin/directory${qs({ env: state.traffic })}`),
      api("/v1/admin/stats"),
    ]);
    state.directory = directory;
    state.stats = stats;
    if (state.siteKey && !selectedSite()) state.siteKey = "";
    if (state.view === "sites") {
      state.sites = await api(
        `/v1/admin/installations${qs({ ...params, page: state.pages.sites, per_page: 24 })}`,
      );
    } else if (state.view === "usage") {
      state.funnel = await api(
        `/v1/admin/funnel${qs({ company_id: params.company_id, days: state.days, env: state.traffic })}`,
      );
    } else if (state.view === "events") {
      state.events = await api(`/v1/admin/events${qs({ ...params, page: state.pages.events, per_page: 25 })}`);
    } else if (state.view === "loyalty") {
      const overview = await api(`/v1/admin/loyalty/overview${qs({ env: state.traffic })}`);
      state.loyaltyOverview = overview;
      const studio = state.loyaltyMode === "studio" ? selectedSite() : null;
      if (state.loyaltyMode === "studio" && !studio) {
        state.ranking = { items: [], total: 0, page: 1, pages: 1 };
        state.ledger = { items: [], total: 0, page: 1, pages: 1 };
        state.rules = [];
      } else {
        const companyId = studio?.company_id ?? "";
        const [ranking, ledger, rules] = await Promise.all([
          api(
            `/v1/admin/loyalty/ranking${qs({
              company_id: companyId,
              q: state.loyaltyMode === "studio" ? state.q : "",
              page: state.pages.ranking,
              per_page: state.loyaltyMode === "buq" ? 8 : 20,
            })}`,
          ),
          api(`/v1/admin/loyalty/ledger${qs({ company_id: companyId, page: state.pages.ledger, per_page: 25 })}`),
          api(`/v1/admin/loyalty/rules${qs({ company_id: companyId || "0" })}`),
        ]);
        state.ranking = ranking;
        state.ledger = ledger;
        state.rules = rules.effective ?? [];
      }
    } else if (state.view === "config") {
      const site = selectedSite();
      if (site?.company_id) {
        const row = await api(`/v1/admin/config${qs({ company_id: site.company_id })}`);
        state.remoteConfig = row;
        state.configDraft = draftFromConfig(row.config ?? {});
      } else {
        state.remoteConfig = { company_id: null, config: {}, updated_at: null, stripped: [] };
        state.configDraft = draftFromConfig({});
      }
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
  let selected = null;
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") el.className = value;
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "value" && (tag === "select" || tag === "textarea")) selected = value == null ? "" : String(value);
    else if (value != null && value !== false) el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  if (selected != null) el.value = selected;
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
  const [title, lede] = pageCopy();
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
        navBtn("config", "Config", "M4 6h16M4 12h10M4 18h16M17 9l3 3-3 3"),
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
  const studioOptions = [
    h("option", { value: "" }, state.view === "loyalty" && state.loyaltyMode === "studio" ? "Elige un estudio" : "Todos los estudios"),
    ...state.directory.sites.map((site) => h("option", { value: site.key }, site.env === "dev" ? `${site.name} · pruebas` : site.name)),
  ];
  const events = [
    h("option", { value: "" }, "Todos los gestos"),
    ...(state.directory.events ?? []).map((event) => h("option", { value: event.name }, event.label)),
  ];
  const showStudio =
    state.view !== "catalog" &&
    !(state.view === "loyalty" && state.loyaltyMode === "buq");
  const showSearch =
    state.view === "sites" ||
    state.view === "events" ||
    (state.view === "loyalty" && state.loyaltyMode === "studio" && state.loyaltyTab === "clients");
  return h(
    "div",
    { class: "filters" },
    state.view === "loyalty"
      ? h(
          "div",
          { class: "seg mode" },
          [
            ["buq", "Buq"],
            ["studio", "Estudio"],
          ].map(([mode, label]) =>
            h(
              "button",
              {
                type: "button",
                class: state.loyaltyMode === mode ? "active" : "",
                onClick: () => {
                  state.loyaltyMode = mode;
                  state.loyaltyTab = "clients";
                  resetPages();
                  refresh();
                },
              },
              label,
            ),
          ),
        )
      : null,
    showStudio
      ? h(
          "select",
          {
            value: state.siteKey,
            onChange: (event) => {
              state.siteKey = event.target.value;
              resetPages();
              if (state.view === "loyalty" || state.view === "config") refresh();
            },
          },
          ...studioOptions,
        )
      : null,
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
    showSearch
      ? h("input", {
          placeholder:
            state.view === "loyalty"
              ? "Nombre o correo"
              : state.view === "events"
                ? "Sitio, nombre o correo"
                : "Buscar sitio o página",
          value: state.q,
          onChange: (event) => {
            state.q = event.target.value;
          },
        })
      : null,
    state.view !== "catalog"
      ? h(
          "div",
          { class: "seg" },
          [
            ["prod", "Producción"],
            ["dev", "Pruebas"],
            ["all", "Todo"],
          ].map(([value, label]) =>
            h(
              "button",
              {
                type: "button",
                class: state.traffic === value ? "active" : "",
                onClick: () => {
                  state.traffic = value;
                  resetPages();
                  refresh();
                },
              },
              label,
            ),
          ),
        )
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
  if (state.view === "config") return renderConfig();
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
      stat("En vivo", live, "estudios activos"),
      stat("Estudios", items.length || state.stats?.studios || 0, "un card por marca"),
      stat("Páginas", state.stats?.sites ?? 0, "rutas con el SDK"),
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
  const name = row.name || row.studio || row.host;
  const live = minutesAgo(row.last_seen_at) < 15;
  const pages = row.pages ?? [];
  const extra = Math.max(0, pages.length - 4);
  return h(
    "article",
    { class: "site-card" },
    avatar(name),
    h(
      "div",
      {},
      h("h3", {}, name, row.env === "dev" ? h("span", { class: "tag dev" }, "Pruebas") : null),
      h("div", { class: "where" }, `${row.host} · ${pages.length || 1} ${pages.length === 1 ? "página" : "páginas"}`),
      h(
        "div",
        { class: "chips" },
        [...new Set(row.widget_labels?.length ? row.widget_labels : row.widgets ?? [])].map((widget) =>
          h("span", { class: "chip" }, widget),
        ),
      ),
      pages.length
        ? h(
            "ul",
            { class: "pages" },
            pages.slice(0, 4).map((page) =>
              h("li", {}, h("code", {}, page.path || "/"), h("span", { class: "muted" }, relTime(page.last_seen_at))),
            ),
            extra ? h("li", { class: "muted" }, `+${extra} más`) : null,
          )
        : null,
    ),
    h(
      "div",
      { class: "site-actions" },
      live
        ? h("div", { class: "pulse" }, h("i"), "En vivo")
        : h("div", { class: "muted", style: "font-size:12px" }, relTime(row.last_seen_at)),
      h(
        "button",
        {
          type: "button",
          class: "btn ghost compact",
          onClick: () => {
            state.view = "config";
            state.siteKey = row.key || state.directory.sites.find((site) => site.company_id === row.company_id)?.key || "";
            refresh();
          },
        },
        "Config",
      ),
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
      "Cloudflare D1 (SQLite). Cada gesto es una fila de ~400 bytes. El admin pide 25. El embudo lee la bitácora de estos días (así puede ocultar Replit). A los 90 días se borran crudos; los rollups se quedan para siempre.",
    ),
      ),
      h(
        "div",
        { class: "panel", style: "padding:22px" },
        h("h3", {}, "Capacidad ahora"),
        h(
          "p",
          { class: "muted" },
          `${fmt(state.stats?.events ?? 0)} eventos ≈ ${fmtBytes(state.stats?.event_bytes_est)} de 10 GB. ${fmt(state.stats?.sites ?? 0)} páginas · ${fmt(state.stats?.studios ?? 0)} estudios. Un millón de gestos son ~400 MB. Si todos los socios de Buq disparan a la vez, acortamos retención a 30 días o dejamos de guardar cada pulso. Hoy no hay tema.`,
        ),
      ),
    ),
    h(
      "div",
      { class: "panel", style: "padding:22px" },
      h("h3", {}, `Embudo · ${state.funnel.days ?? state.days} días`),
      h(
        "p",
        { class: "muted funnel-note" },
        state.funnel.note ||
          "Cada barra es un conteo independiente, no las mismas personas. El % es sobre quienes vieron el calendario. Un paso puede ser más alto que el anterior (por eso a veces ves más de 100%).",
      ),
      h(
        "div",
        { class: "funnel" },
        steps.map((step, index) =>
          h(
            "div",
            { class: "funnel-row" },
            h("div", {}, step.label),
            h("div", { class: "bar" }, h("span", { style: `width:${Math.round((step.count / max) * 100)}%` })),
            h("b", {}, fmt(step.count)),
            h(
              "div",
              { class: `conv${step.from_previous > 100 ? " over" : ""}` },
              index === 0 ? "base" : step.share != null ? `${step.share}%` : "—",
              step.from_previous > 100
                ? h("span", { class: "sub" }, `${step.from_previous}% vs anterior`)
                : null,
            ),
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
      ["Cuándo", "Qué pasó", "Sitio", "Quién"],
      items.map((row) => [
        h("div", {}, relTime(row.ts), h("span", { class: "sub" }, absTime(row.ts))),
        h("div", {}, h("div", { class: "what" }, row.event_label || row.name), row.widget_label ? h("span", { class: "sub" }, row.widget_label) : null),
        h("div", {}, row.site || row.host || "—"),
        h(
          "div",
          {},
          h("div", { class: "what" }, row.person_name || row.person || "Visitante"),
          row.person_email ? h("span", { class: "sub" }, row.person_email) : null,
        ),
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
  return state.loyaltyMode === "studio" ? renderStudioLoyalty() : renderBuqLoyalty();
}

function openStudio(companyId) {
  const site = siteForCompany(companyId);
  state.loyaltyMode = "studio";
  state.loyaltyTab = "clients";
  state.siteKey = site?.key ?? "";
  state.q = "";
  resetPages();
  refresh();
}

function renderBuqLoyalty() {
  const totals = state.loyaltyOverview.totals ?? {};
  const studios = state.loyaltyOverview.studios ?? [];
  const ranking = state.ranking.items ?? state.ranking.ranking ?? [];
  return h(
    "div",
    { class: "stack" },
    h(
      "div",
      { class: "grid" },
      stat("Estudios", totals.studios ?? studios.length, "con programa"),
      stat("Socios", totals.members ?? 0, "cuentas con puntos"),
      stat("En circulación", `${fmt(totals.points ?? 0)} pts`, "saldo vivo de la red"),
      stat("Movimientos", totals.movements ?? 0, "en el ledger"),
    ),
    h("h3", {}, "Por estudio"),
    studios.length
      ? table(
          ["Estudio", "Socios", "Puntos", "Emitidos", "Niveles", ""],
          studios.map((row) => [
            h(
              "button",
              {
                class: "linkish",
                type: "button",
                onClick: () => openStudio(row.company_id),
              },
              h("div", { class: "what" }, row.name, row.env === "dev" ? h("span", { class: "tag dev" }, "Pruebas") : null),
              h("span", { class: "sub" }, row.host || "sin sitio público"),
            ),
            fmt(row.members),
            h("b", { class: "tier-gold" }, fmt(row.points)),
            fmt(row.issued),
            h("span", { class: "sub" }, `${row.gold} Gold · ${row.silver} Silver · ${row.bronze} Bronze`),
            h(
              "button",
              {
                class: "btn ghost compact",
                type: "button",
                onClick: () => openStudio(row.company_id),
              },
              "Abrir",
            ),
          ]),
        )
      : empty("Nadie tiene programa todavía", "Cuando un estudio sume puntos, aparece aquí para que lo abras."),
    ranking.length
      ? h(
          "div",
          { class: "stack" },
          h("h3", {}, "Top de la red"),
          ranking.slice(0, 8).map((row, index) =>
            h(
              "div",
              { class: "leader" },
              h("div", { class: "rank" }, index + 1),
              avatar(row.name),
              h(
                "div",
                {},
                h("b", {}, row.name),
                h("span", { class: "sub" }, [row.email, row.studio || row.site, row.tier?.label].filter(Boolean).join(" · ")),
              ),
              h("div", { class: `pts tier-${row.tier?.id ?? "bronze"}` }, fmt(row.points)),
            ),
          ),
        )
      : null,
    h("h3", {}, "Programa de la red"),
    renderRules("Así ganan puntos los clientes en cualquier estudio, salvo que el operador ponga las suyas."),
  );
}

function renderStudioLoyalty() {
  const site = selectedSite();
  if (!site) {
    const studios = state.loyaltyOverview.studios ?? [];
    return h(
      "div",
      { class: "stack" },
      empty("Elige el estudio", "Esta consola es la de un operador: clientes, ledger y reglas de su marca. No es la vista de toda la red."),
      studios.length
        ? h(
            "div",
            { class: "studio-pick" },
            studios.map((row) =>
              h(
                "button",
                {
                  class: "studio-pick-card",
                  type: "button",
                  onClick: () => openStudio(row.company_id),
                },
                avatar(row.name),
                h(
                  "div",
                  {},
                  h("b", {}, row.name),
                  h("span", { class: "sub" }, `${fmt(row.members)} socios · ${fmt(row.points)} pts`),
                ),
              ),
            ),
          )
        : null,
    );
  }

  const ranking = state.ranking.items ?? state.ranking.ranking ?? [];
  const ledger = state.ledger.items ?? state.ledger.ledger ?? [];
  const studioRow = (state.loyaltyOverview.studios ?? []).find(
    (row) => Number(row.company_id) === Number(site.company_id),
  );
  const top = ranking[0];
  return h(
    "div",
    { class: "stack" },
    h(
      "div",
      { class: "op-head" },
      h(
        "div",
        {},
        h("div", { class: "kicker" }, site.host || "estudio"),
        h("h3", { class: "op-title" }, `Clientes de ${site.name}`),
      ),
      h(
        "button",
        {
          class: "btn ghost compact",
          type: "button",
          onClick: () => {
            state.loyaltyMode = "buq";
            refresh();
          },
        },
        "Volver a la red",
      ),
    ),
    h(
      "div",
      { class: "grid" },
      stat("Socios", state.ranking.total ?? ranking.length, "con puntos"),
      stat("Puntos", `${fmt(studioRow?.points ?? ranking.reduce((sum, row) => sum + Number(row.points || 0), 0))} pts`, "en circulación"),
      stat("Movimientos", state.ledger.total ?? ledger.length, "en el ledger"),
      stat("Top", top ? `${fmt(top.points)} pts` : "—", top?.name ?? "sin ranking"),
    ),
    h(
      "div",
      { class: "seg tabs" },
      [
        ["clients", "Clientes"],
        ["ledger", "Movimientos"],
        ["program", "Programa"],
      ].map(([tab, label]) =>
        h(
          "button",
          {
            type: "button",
            class: state.loyaltyTab === tab ? "active" : "",
            onClick: () => {
              state.loyaltyTab = tab;
              render();
            },
          },
          label,
        ),
      ),
    ),
    state.loyaltyTab === "clients"
      ? renderStudioClients(ranking)
      : state.loyaltyTab === "ledger"
        ? renderStudioLedger(ledger)
        : renderStudioProgram(),
  );
}

function renderStudioClients(ranking) {
  const people = ranking.map((row) =>
    h(
      "option",
      { value: `${row.company_id}:${row.user_id}` },
      `${row.name}${row.email ? ` · ${row.email}` : ""} · ${fmt(row.points)} pts`,
    ),
  );
  return h(
    "div",
    { class: "stack" },
    table(
      ["Cliente", "Sitio", "Nivel", "Puntos", "Actividad"],
      ranking.map((row) => [
        h(
          "div",
          { class: "who" },
          h("div", { class: "what" }, row.name),
          h("span", { class: "sub" }, row.email || `Alias ${row.alias || ""}`.trim()),
        ),
        row.site || row.host || selectedSite()?.host || "—",
        h("span", { class: `pill tier-${row.tier?.id ?? "bronze"}` }, row.tier?.label ?? "Bronze"),
        h("b", { class: `tier-${row.tier?.id ?? "bronze"}` }, fmt(row.points)),
        relTime(row.updated_at || row.last_seen_at),
      ]),
      "Nadie de este estudio tiene puntos todavía.",
    ),
    pager(state.ranking, (page) => {
      state.pages.ranking = page;
      refresh();
    }),
    h("h3", {}, "Ajuste del operador"),
    h(
      "form",
      { class: "grant", onSubmit: onGrant },
      h(
        "label",
        {},
        "Cliente",
        h(
          "select",
          {
            value: state.grantPerson,
            onChange: (event) => {
              state.grantPerson = event.target.value;
            },
          },
          h("option", { value: "" }, ranking.length ? "Elige un cliente" : "No hay clientes aún"),
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
  );
}

function renderStudioLedger(ledger) {
  return h(
    "div",
    { class: "stack" },
    table(
      ["Cuándo", "Cliente", "Qué", "Puntos"],
      ledger.map((row) => [
        h("div", {}, relTime(row.ts), h("span", { class: "sub" }, absTime(row.ts))),
        h("div", {}, row.person || "Cuenta", row.person_email ? h("span", { class: "sub" }, row.person_email) : null),
        row.event_label || row.event_name,
        h("b", { class: Number(row.points) < 0 ? "tier-bronze" : "tier-gold" }, `${Number(row.points) > 0 ? "+" : ""}${row.points}`),
      ]),
      "El ledger de este estudio está quieto.",
    ),
    pager(state.ledger, (page) => {
      state.pages.ledger = page;
      refresh();
    }),
  );
}

function renderStudioProgram() {
  return h(
    "div",
    { class: "stack" },
    h("p", { class: "muted" }, "Así ganan o pierden puntos los clientes de este estudio. Las reglas de la red aplican si el estudio no puso las suyas."),
    renderRules(),
  );
}

function renderRules(note) {
  if (!state.rules.length) return empty("Sin reglas", "El programa todavía no tiene eventos que sumen o resten.");
  return h(
    "div",
    { class: "stack" },
    note ? h("p", { class: "muted" }, note) : null,
    h(
      "div",
      { class: "rules" },
      state.rules.map((row) =>
        h(
          "div",
          { class: "rule" },
          h("div", { class: "muted" }, row.event_label || row.label || row.event_name),
          h("b", {}, `${row.points > 0 ? "+" : ""}${row.points} pts`),
          h(
            "div",
            { class: "muted" },
            row.once_per_user ? "Una vez por cuenta" : row.daily_cap ? `Hasta ${row.daily_cap} al día` : row.scope,
          ),
        ),
      ),
    ),
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

function draftFromConfig(config) {
  const theme = config.THEME && typeof config.THEME === "object" ? config.THEME : {};
  const colors = theme.colors && typeof theme.colors === "object" ? theme.colors : {};
  const concierge = config.CONCIERGE ?? config.concierge;
  let mode = "unset";
  if (concierge === true) mode = "true";
  else if (concierge && typeof concierge === "object" && !Object.keys(concierge).length) mode = "true";
  else if (concierge && typeof concierge === "object") mode = "partial";
  const contact = concierge && typeof concierge === "object" ? concierge.contact ?? {} : {};
  return {
    concierge: mode,
    displayName: concierge && typeof concierge === "object" ? concierge.displayName ?? "" : "",
    whatsapp: typeof contact.whatsapp === "string" ? contact.whatsapp : "",
    colorScheme: theme.colorScheme ?? "",
    allowUserColorScheme: theme.allowUserColorScheme === false ? "false" : theme.allowUserColorScheme === true ? "true" : "",
    brand: colors.brand ?? "",
    logoUrl: theme.logoUrl ?? "",
    showMembershipOptions: config.SHOW_MEMBERSHIP_OPTIONS === true || config.SHOW_MEMBERSHIP_OPTIONS === "true",
    analytics: config.ANALYTICS !== false && config.ANALYTICS !== "false",
    json: JSON.stringify(config, null, 2),
  };
}

function configFromDraft(draft) {
  const config = {};
  if (draft.concierge === "true") {
    const partial = {};
    if (draft.displayName.trim()) partial.displayName = draft.displayName.trim();
    if (draft.whatsapp.trim()) partial.contact = { whatsapp: draft.whatsapp.trim() };
    config.CONCIERGE = Object.keys(partial).length ? partial : true;
  } else if (draft.concierge === "partial") {
    try {
      const parsed = JSON.parse(draft.json || "{}");
      if (parsed.CONCIERGE != null) config.CONCIERGE = parsed.CONCIERGE;
    } catch {
      /* el JSON se valida al guardar */
    }
  }
  const theme = {};
  if (draft.colorScheme) theme.colorScheme = draft.colorScheme;
  if (draft.allowUserColorScheme === "false") theme.allowUserColorScheme = false;
  if (draft.allowUserColorScheme === "true") theme.allowUserColorScheme = true;
  if (draft.logoUrl.trim()) theme.logoUrl = draft.logoUrl.trim();
  if (draft.brand.trim()) theme.colors = { brand: draft.brand.trim() };
  if (Object.keys(theme).length) config.THEME = theme;
  if (draft.showMembershipOptions) config.SHOW_MEMBERSHIP_OPTIONS = true;
  if (!draft.analytics) config.ANALYTICS = false;
  return config;
}

function renderConfig() {
  const site = selectedSite();
  if (!site) {
    return empty("Elige un estudio", "La config remota es por compañía. El nodo de Concierge sigue siendo por página.");
  }
  const draft = state.configDraft;
  const bind = (field, refresh) => (event) => {
    state.configDraft = {
      ...state.configDraft,
      [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
    };
    if (refresh) render();
  };
  return h(
    "div",
    { class: "stack config-form" },
    h(
      "div",
      { class: "panel", style: "padding:22px" },
      h("div", { class: "kicker" }, site.name),
      h("h3", { class: "op-title" }, "Partial del SDK"),
      h(
        "p",
        { class: "muted" },
        "Se mezcla encima de los defaults y debajo del HTML de la página. COMPANY_ID + API_CLIENT + API_SECRET se quedan en el sitio. El secret no entra aquí.",
      ),
      state.remoteConfig.updated_at
        ? h("p", { class: "muted" }, `Último guardado ${relTime(state.remoteConfig.updated_at)}`)
        : h("p", { class: "muted" }, "Todavía no hay override. El SDK usa solo el HTML."),
    ),
    h(
      "form",
      {
        class: "panel",
        style: "padding:22px",
        onSubmit: async (event) => {
          event.preventDefault();
          const siteNow = selectedSite();
          if (!siteNow) return;
          let config = configFromDraft(state.configDraft);
          if (state.configDraft.concierge === "partial") {
            try {
              config = JSON.parse(state.configDraft.json || "{}");
            } catch {
              state.error = "El JSON avanzado no parsea.";
              render();
              return;
            }
          }
          state.configSaving = true;
          state.configNotice = "";
          state.error = "";
          render();
          try {
            const saved = await api("/v1/admin/config", {
              method: "PUT",
              body: JSON.stringify({ company_id: siteNow.company_id, config }),
            });
            state.remoteConfig = saved;
            state.configDraft = draftFromConfig(saved.config ?? {});
            state.configNotice =
              saved.stripped?.length
                ? `Guardado. Se tiró ${saved.stripped.join(", ")} — el secret no vive en el Hub.`
                : "Guardado. El embed lo pide en el próximo load.";
          } catch (error) {
            state.error = error.message;
          }
          state.configSaving = false;
          render();
        },
      },
      h("label", {}, "Concierge (config, no el nodo)"),
      h(
        "select",
        { value: draft.concierge, onChange: bind("concierge", true) },
        h("option", { value: "unset" }, "Sin override — lo decide el HTML"),
        h("option", { value: "true" }, "true / {} — defaults live"),
        h("option", { value: "partial" }, "JSON avanzado"),
      ),
      draft.concierge === "true"
        ? h(
            "div",
            { class: "config-grid" },
            h("label", {}, "Nombre (opcional)", h("input", { value: draft.displayName, onInput: bind("displayName"), placeholder: "Bunker Indoor Golf" })),
            h("label", {}, "WhatsApp (solo dígitos)", h("input", { value: draft.whatsapp, onInput: bind("whatsapp"), placeholder: "5215512345678" })),
          )
        : null,
      draft.concierge === "partial"
        ? h("label", {}, "JSON del partial", h("textarea", { value: draft.json, onInput: bind("json"), rows: "12" }))
        : null,
      h("label", {}, "Esquema"),
      h(
        "select",
        { value: draft.colorScheme, onChange: bind("colorScheme") },
        h("option", { value: "" }, "Sin override"),
        h("option", { value: "light" }, "light"),
        h("option", { value: "dark" }, "dark"),
      ),
      h("label", {}, "Lock de esquema"),
      h(
        "select",
        { value: draft.allowUserColorScheme, onChange: bind("allowUserColorScheme") },
        h("option", { value: "" }, "Sin override"),
        h("option", { value: "false" }, "Fijo (allowUserColorScheme false)"),
        h("option", { value: "true" }, "El usuario puede cambiar"),
      ),
      h(
        "div",
        { class: "config-grid" },
        h("label", {}, "Brand", h("input", { value: draft.brand, onInput: bind("brand"), placeholder: "#F3D15E" })),
        h("label", {}, "Logo", h("input", { value: draft.logoUrl, onInput: bind("logoUrl"), placeholder: "https://…" })),
      ),
      h(
        "label",
        { class: "check" },
        h("input", { type: "checkbox", checked: draft.showMembershipOptions, onChange: bind("showMembershipOptions") }),
        " Mostrar “Opciones de la membresía”",
      ),
      h(
        "label",
        { class: "check" },
        h("input", { type: "checkbox", checked: draft.analytics, onChange: bind("analytics") }),
        " Analytics / heartbeats",
      ),
      state.configNotice ? h("p", { class: "ok" }, state.configNotice) : null,
      h(
        "button",
        { class: "btn", type: "submit", disabled: state.configSaving },
        state.configSaving ? "Guardando…" : "Guardar partial",
      ),
    ),
  );
}

const WIDGET_DOCS = {
  concierge: "docs/v2-agente.md#11-concierge--opt-in-apagado-por-default",
  "meetings-calendar": "docs/v2-agente.md#7-calendario--filtros-y-vista",
  "combo-list": "docs/v2-agente.md#8-catálogo-header-auth--atributos",
  "membership-list": "docs/v2-agente.md#8-catálogo-header-auth--atributos",
  "staff-list": "docs/v2-agente.md#8-catálogo-header-auth--atributos",
  "service-list": "docs/v2-agente.md#8-catálogo-header-auth--atributos",
  login: "docs/v2-agente.md#8-catálogo-header-auth--atributos",
  register: "docs/v2-agente.md#8-catálogo-header-auth--atributos",
  "password-recovery": "docs/v2-agente.md#8-catálogo-header-auth--atributos",
  "login-register": "docs/v2-agente.md#header-login-register",
  "login-register-pages": "docs/v2-agente.md#auth-en-página-login-register-pages",
  "profile-info": "docs/v2-agente.md#6-widgets-data-gf-theme",
  "purchase-button": "docs/v2-agente.md#9-html-plano--comprar-reservar-carrito-cuenta",
  fancy: "docs/v2-agente.md#9-html-plano--comprar-reservar-carrito-cuenta",
};

function widgetDocsUrl(row) {
  const path = WIDGET_DOCS[row.id] || WIDGET_DOCS[row.shortcode] || "docs/v2-agente.md#6-widgets-data-gf-theme";
  const hash = path.indexOf("#");
  const file = hash === -1 ? path : path.slice(0, hash);
  const fragment = hash === -1 ? "" : path.slice(hash);
  return `https://github.com/GafaMX/GFtheme/blob/v2/main/${file}${fragment}`;
}

function renderCatalog() {
  return h(
    "div",
    { class: "widgets" },
    state.widgets.map((row) =>
      h(
        "a",
        {
          class: `panel widget-card${row.status === "preview" ? " is-preview" : ""}`,
          href: widgetDocsUrl(row),
          target: "_blank",
          rel: "noopener noreferrer",
        },
        h("span", { class: `tag ${row.status}` }, row.status === "stable" ? "Listo" : "En preview"),
        h("h3", {}, row.title),
        h("p", { class: "muted" }, row.description ?? ""),
        h("span", { class: "widget-doc" }, "Guía ↗"),
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

function fmtBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0 KB";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

boot();
