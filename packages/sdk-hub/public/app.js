const root = document.getElementById("root");
const state = {
  view: "installations",
  me: false,
  password: "",
  error: "",
  companyId: "",
  days: "7",
  eventName: "",
  summary: { companies: [], event_count: 0 },
  installations: [],
  events: [],
  funnel: { steps: [], totals: {} },
  widgets: [],
  ranking: [],
  ledger: [],
  rules: { defaults: [], company: [], effective: [] },
  grantUserId: "",
  grantPoints: "10",
  grantReason: "",
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

async function refresh() {
  try {
    await api("/v1/admin/me");
    state.me = true;
    state.error = "";
    const [summary, installations, events, funnel, widgets, ranking, ledger, rules] = await Promise.all([
      api("/v1/admin/summary"),
      api(`/v1/admin/installations${qs({ company_id: state.companyId })}`),
      api(`/v1/admin/events${qs({ company_id: state.companyId, event: state.eventName })}`),
      api(`/v1/admin/funnel${qs({ company_id: state.companyId, days: state.days })}`),
      api("/v1/widgets"),
      api(`/v1/admin/loyalty/ranking${qs({ company_id: state.companyId })}`),
      api(`/v1/admin/loyalty/ledger${qs({ company_id: state.companyId })}`),
      api(`/v1/admin/loyalty/rules${qs({ company_id: state.companyId || "0" })}`),
    ]);
    state.summary = summary;
    state.installations = installations.installations ?? [];
    state.events = events.events ?? [];
    state.funnel = funnel;
    state.widgets = widgets.widgets ?? [];
    state.ranking = ranking.ranking ?? [];
    state.ledger = ledger.ledger ?? [];
    state.rules = rules;
  } catch (error) {
    if (error.status === 401) {
      state.me = false;
    } else {
      state.error = error.message;
    }
  }
  render();
}

function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") el.className = value;
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
          const form = event.currentTarget;
          const password = new FormData(form).get("password");
          state.password = typeof password === "string" ? password : "";
          try {
            await api("/v1/admin/login", { method: "POST", body: JSON.stringify({ password: state.password }) });
            await refresh();
            if (!state.me) {
              state.error = "Entró el login pero la sesión no quedó. Recarga e intenta de nuevo.";
              render();
            }
          } catch (error) {
            state.error =
              error.message === "missing_admin_password"
                ? "Falta ADMIN_PASSWORD. Copia .dev.vars.example a .dev.vars y reinicia wrangler."
                : "Password incorrecto. Local: buq-hub-dev";
            render();
          }
        },
      },
      h("small", { class: "muted" }, "hub.buq.partners"),
      h("h1", {}, "SDK Hub"),
      h("p", { class: "muted" }, "Control plane del SDK V2: instalaciones, uso y catálogo. Independiente de Laravel."),
      h("label", { for: "admin-password" }, "Password de admin"),
      h("input", {
        id: "admin-password",
        name: "password",
        type: "password",
        autocomplete: "current-password",
        placeholder: "buq-hub-dev",
      }),
      h("p", { class: "muted" }, "Local: ", h("code", {}, "buq-hub-dev")),
      h("p", { class: "error" }, state.error),
      h("button", { class: "btn wide", type: "submit" }, "Entrar"),
    ),
  );
}

function renderApp() {
  return h(
    "div",
    { class: "app" },
    h(
      "aside",
      { class: "side" },
      h("div", { class: "brand" }, h("small", {}, "Buq"), h("h1", {}, "SDK Hub")),
      h(
        "nav",
        {},
        navBtn("installations", "Instalaciones"),
        navBtn("usage", "Uso"),
        navBtn("events", "Eventos"),
        navBtn("loyalty", "Lealtad"),
        navBtn("catalog", "Catálogo"),
      ),
      h(
        "button",
        {
          class: "btn ghost",
          style: "margin-top:32px;width:100%",
          onClick: async () => {
            await api("/v1/admin/logout", { method: "POST" });
            state.me = false;
            render();
          },
        },
        "Salir",
      ),
    ),
    h("main", { class: "main" }, renderFilters(), state.error ? h("p", { class: "error" }, state.error) : null, renderView()),
  );
}

function navBtn(view, label) {
  return h(
    "button",
    { class: state.view === view ? "active" : "", onClick: () => { state.view = view; render(); } },
    label,
  );
}

function renderFilters() {
  return h(
    "div",
    { class: "top" },
    h("div", {}, h("h2", {}, titleFor(state.view)), h("p", { class: "muted" }, "Compañía → marca → salón. Los IDs vienen del SDK, no de Laravel.")),
    h(
      "div",
      { class: "filters" },
      h("input", {
        placeholder: "company_id",
        value: state.companyId,
        onChange: (event) => { state.companyId = event.target.value; },
      }),
      state.view === "usage"
        ? h(
            "select",
            { value: state.days, onChange: (event) => { state.days = event.target.value; } },
            h("option", { value: "7" }, "7 días"),
            h("option", { value: "30" }, "30 días"),
          )
        : null,
      state.view === "events"
        ? h("input", {
            placeholder: "evento",
            value: state.eventName,
            onChange: (event) => { state.eventName = event.target.value; },
          })
        : null,
      h("button", { class: "btn", onClick: () => refresh() }, "Filtrar"),
    ),
  );
}

function titleFor(view) {
  return {
    installations: "Dónde está el SDK",
    usage: "Cómo se usa",
    events: "Explorer de eventos",
    loyalty: "Puntos y niveles",
    catalog: "Catálogo de widgets",
  }[view];
}

function renderView() {
  if (state.view === "installations") return renderInstallations();
  if (state.view === "usage") return renderUsage();
  if (state.view === "events") return renderEvents();
  if (state.view === "loyalty") return renderLoyalty();
  return renderCatalog();
}

function renderInstallations() {
  const live = state.installations.length;
  return h(
    "div",
    {},
    h(
      "div",
      { class: "grid" },
      stat("Instalaciones", live),
      stat("Compañías", state.summary.companies?.length ?? 0),
      stat("Eventos", state.summary.event_count ?? 0),
      stat("Versiones", new Set(state.installations.map((row) => row.sdk_version).filter(Boolean)).size),
    ),
    table(
      ["Compañía", "Marca", "Salón", "Host", "Página", "Versión", "Widgets", "Visto"],
      state.installations.map((row) => [
        row.company_id,
        row.brand_id ?? "—",
        row.location_id ?? "—",
        row.host,
        row.path,
        row.sdk_version ?? "—",
        (row.widgets ?? []).map((widget) => h("span", { class: "tag" }, widget)),
        formatTime(row.last_seen_at),
      ]),
    ),
  );
}

function renderUsage() {
  const max = Math.max(1, ...state.funnel.steps.map((step) => step.count));
  return h(
    "div",
    { class: "panel", style: "padding:20px" },
    h("p", { class: "muted" }, `Funnel de ${state.funnel.days ?? state.days} días. Heartbeats y UI no sustituyen la caja de Laravel.`),
    h(
      "div",
      { class: "funnel" },
      (state.funnel.steps ?? []).map((step) =>
        h(
          "div",
          { class: "funnel-row" },
          h("div", {}, step.label),
          h("div", { class: "bar" }, h("span", { style: `width:${Math.round((step.count / max) * 100)}%` })),
          h("b", {}, step.count),
        ),
      ),
    ),
  );
}

function renderEvents() {
  return table(
    ["Cuando", "Evento", "Compañía", "Marca", "Salón", "Widget", "Host", "User"],
    state.events.map((row) => [
      formatTime(row.ts),
      row.name,
      row.company_id,
      row.brand_id ?? "—",
      row.location_id ?? "—",
      row.widget ?? "—",
      row.host ?? "—",
      row.user_id ?? "—",
    ]),
  );
}

function renderLoyalty() {
  const rules = state.rules.effective?.length ? state.rules.effective : state.rules.defaults ?? [];
  return h(
    "div",
    { class: "stack" },
    h(
      "p",
      { class: "muted" },
      "Los puntos viven en el Hub. No se puntúan heartbeats ni vistas de calendario. Sin user_id no hay puntos. Canje a crédito de tienda: después (Laravel).",
    ),
    h(
      "div",
      { class: "grid" },
      stat("Socios con puntos", state.ranking.length),
      stat("Movimientos", state.ledger.length),
      stat("Reglas", rules.length),
      stat("Top", state.ranking[0] ? `${state.ranking[0].points} pts · user ${state.ranking[0].user_id}` : "—"),
    ),
    h("h3", {}, "Ranking"),
    table(
      ["Compañía", "User", "Puntos", "Nivel", "Actualizado"],
      state.ranking.map((row) => [
        row.company_id,
        row.user_id,
        row.points,
        h("span", { class: `tag tier-${row.tier?.id ?? "bronze"}` }, row.tier?.label ?? "Bronze"),
        formatTime(row.updated_at),
      ]),
    ),
    h("h3", {}, "Reglas"),
    table(
      ["Evento", "Puntos", "Tope/día", "Una vez", "Etiqueta", "Origen"],
      rules.map((row) => [
        h("code", {}, row.event_name),
        row.points,
        row.daily_cap || "—",
        row.once_per_user ? "sí" : "no",
        row.label ?? "—",
        Number(row.company_id) === 0 ? "global" : `compañía ${row.company_id}`,
      ]),
    ),
    h("h3", {}, "Ajuste manual"),
    h(
      "form",
      {
        class: "grant",
        onSubmit: async (event) => {
          event.preventDefault();
          const companyId = Number(state.companyId);
          const userId = Number(state.grantUserId);
          const points = Number(state.grantPoints);
          if (!companyId || !userId || !Number.isFinite(points) || points === 0) {
            state.error = "Para otorgar puntos filtra company_id y llena user_id y puntos ≠ 0.";
            render();
            return;
          }
          try {
            await api("/v1/admin/loyalty/grant", {
              method: "POST",
              body: JSON.stringify({
                company_id: companyId,
                user_id: userId,
                points,
                reason: state.grantReason || "manual",
              }),
            });
            state.grantReason = "";
            state.error = "";
            await refresh();
          } catch (error) {
            state.error = error.message;
            render();
          }
        },
      },
      h("input", {
        placeholder: "user_id",
        value: state.grantUserId,
        onInput: (event) => {
          state.grantUserId = event.target.value;
        },
      }),
      h("input", {
        placeholder: "puntos (+/-)",
        value: state.grantPoints,
        onInput: (event) => {
          state.grantPoints = event.target.value;
        },
      }),
      h("input", {
        placeholder: "motivo",
        value: state.grantReason,
        onInput: (event) => {
          state.grantReason = event.target.value;
        },
      }),
      h("button", { class: "btn", type: "submit" }, "Otorgar"),
    ),
    h("h3", {}, "Ledger"),
    table(
      ["Cuando", "Compañía", "User", "Evento", "Puntos", "Día"],
      state.ledger.map((row) => [
        formatTime(row.ts),
        row.company_id,
        row.user_id,
        h("code", {}, row.event_name),
        row.points,
        row.day,
      ]),
    ),
  );
}

function renderCatalog() {
  return table(
    ["Widget", "Shortcode", "Estado", "Descripción"],
    state.widgets.map((row) => [
      row.title,
      h("code", {}, row.shortcode),
      h("span", { class: `tag ${row.status}` }, row.status),
      row.description ?? "",
    ]),
  );
}

function stat(label, value) {
  return h("div", { class: "panel stat" }, h("span", { class: "muted" }, label), h("b", {}, value));
}

function table(headers, rows) {
  if (!rows.length) return h("div", { class: "panel empty" }, "Sin datos todavía. Arranca el SDK contra este Hub y van a aparecer heartbeats.");
  return h(
    "div",
    { class: "panel", style: "padding:8px 12px; overflow:auto" },
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

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX");
}

refresh();
