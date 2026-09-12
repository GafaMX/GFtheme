/**
 * Catálogo del partial en lenguaje de humano.
 *
 * La fuente de verdad del shape sigue siendo el Zod del SDK
 * (`packages/react-sdk/src/sdk/config.ts` y `sdk/concierge/contracts.ts`).
 * Aquí solo describimos cada opción para pintar un formulario y traducir
 * formulario <-> partial sin que nadie escriba JSON.
 *
 * Lo que el formulario no conoce se conserva tal cual al guardar.
 */

const TIMEZONES = [
  ["America/Mexico_City", "Ciudad de México"],
  ["America/Monterrey", "Monterrey"],
  ["America/Cancun", "Cancún"],
  ["America/Tijuana", "Tijuana"],
  ["America/Hermosillo", "Hermosillo"],
  ["America/Bogota", "Bogotá"],
  ["America/Lima", "Lima"],
  ["America/Santiago", "Santiago"],
  ["America/Argentina/Buenos_Aires", "Buenos Aires"],
  ["America/New_York", "Nueva York"],
  ["America/Los_Angeles", "Los Ángeles"],
  ["Europe/Madrid", "Madrid"],
];

function options(pairs, blank) {
  return [{ value: "", label: blank }, ...pairs.map(([value, label]) => ({ value, label }))];
}

function color(key, path, label, help, placeholder) {
  return { key, path, type: "color", label, help, placeholder };
}

function radius(key, label, help, placeholder) {
  return {
    key: `radius.${key}`,
    path: ["THEME", "radius", key],
    type: "px",
    label,
    help,
    placeholder,
  };
}

function capability(key, label, help) {
  return { key: `concierge.capabilities.${key}`, path: ["CONCIERGE", "capabilities", key], type: "tri", label, help };
}

/**
 * Secciones del formulario. Cada campo se pinta solo a partir de esto:
 * si agregas un campo aquí, aparece en la UI, en el resumen y en el guardado.
 */
export const CONFIG_SECTIONS = [
  {
    id: "marca",
    label: "Marca",
    blurb: "Cómo se ve el SDK dentro del sitio: colores, logo, tipografía y bordes.",
    groups: [
      {
        title: "Claro u oscuro",
        note: "Si no tocas nada, el SDK se acomoda al sitio donde está montado.",
        fields: [
          {
            key: "theme.colorScheme",
            path: ["THEME", "colorScheme"],
            type: "select",
            label: "Modo de color",
            help: "Claro u oscuro para todo lo que pinta el SDK. “Como el equipo del visitante” usa la preferencia de su celular o computadora. “Como la página” copia lo que ya tenga el sitio.",
            choices: options(
              [
                ["light", "Siempre claro"],
                ["dark", "Siempre oscuro"],
                ["system", "Como el equipo del visitante"],
                ["host", "Como la página"],
              ],
              "Sin cambio — lo decide la página",
            ),
          },
          {
            key: "theme.allowUserColorScheme",
            path: ["THEME", "allowUserColorScheme"],
            type: "tri",
            label: "¿El visitante puede cambiarlo?",
            help: "Con “Sí” aparece el botoncito de sol/luna y la persona elige. Con “No” queda fijo en el modo que escogiste arriba.",
          },
          {
            key: "theme.preset",
            path: ["THEME", "preset"],
            type: "select",
            label: "Paleta de arranque",
            help: "Un punto de partida ya armado. Cualquier color que pongas abajo le gana a la paleta.",
            choices: options(
              [
                ["default", "La del SDK"],
                ["boutique", "Boutique — negro y rosa"],
                ["fitness-dark", "Fitness — oscuro y naranja"],
                ["wellness-light", "Wellness — claro y verde"],
              ],
              "Sin cambio",
            ),
          },
        ],
      },
      {
        title: "Logo",
        fields: [
          {
            key: "theme.logoUrl",
            path: ["THEME", "logoUrl"],
            type: "url",
            label: "Liga del logo",
            help: "Dirección de la imagen del logo. Tiene que empezar con https:// y ser una imagen pública (PNG o SVG con fondo transparente se ven mejor).",
            placeholder: "https://tusitio.com/logo.svg",
          },
        ],
      },
      {
        title: "Colores",
        note: "Lo que dejes vacío se calcula solo a partir del color de marca. No hace falta llenar todo.",
        fields: [
          color("theme.colors.brand", ["THEME", "colors", "brand"], "Color de marca", "El principal: botones, ligas y detalles importantes.", "#111827"),
          color("theme.colors.accent", ["THEME", "colors", "accent"], "Color de acento", "El segundo color, para detalles. Si lo dejas vacío se usa el de marca.", "#f97316"),
          color("theme.colors.background", ["THEME", "colors", "background"], "Fondo", "El fondo de las pantallas del SDK. Úsalo solo si el sitio tiene un fondo muy distinto.", "#ffffff"),
          color("theme.colors.surface", ["THEME", "colors", "surface"], "Fondo de tarjetas", "El color de las tarjetas y cajas que van encima del fondo.", "#f8fafc"),
          color("theme.colors.surfaceRaised", ["THEME", "colors", "surfaceRaised"], "Fondo de campos", "Cajitas de texto, menús y todo lo que se ve “levantado”.", "#ffffff"),
          color("theme.colors.text", ["THEME", "colors", "text"], "Texto", "El color de las letras normales.", "#111827"),
          color("theme.colors.mutedText", ["THEME", "colors", "mutedText"], "Texto secundario", "Las letras chiquitas y grises: ayudas, fechas, notas.", "#6b7280"),
          color("theme.colors.border", ["THEME", "colors", "border"], "Líneas", "El color de los bordes y separadores.", "#e5e7eb"),
          color("theme.colors.success", ["THEME", "colors", "success"], "Éxito", "Verde de “todo salió bien”: confirmaciones y lugares disponibles.", "#16a34a"),
          color("theme.colors.warning", ["THEME", "colors", "warning"], "Aviso", "Amarillo de “ojo con esto”: pocos lugares, avisos.", "#f59e0b"),
          color("theme.colors.danger", ["THEME", "colors", "danger"], "Error", "Rojo de “algo falló”: errores y cancelaciones.", "#dc2626"),
        ],
      },
      {
        title: "Tipografía",
        fields: [
          {
            key: "theme.typography.fontFamily",
            path: ["THEME", "typography", "fontFamily"],
            type: "text",
            label: "Letra del texto",
            help: "El nombre de la fuente, tal como la carga el sitio. Si la dejas vacía se hereda la del sitio, que casi siempre es lo correcto.",
            placeholder: "DM Sans, sans-serif",
          },
          {
            key: "theme.typography.headingFontFamily",
            path: ["THEME", "typography", "headingFontFamily"],
            type: "text",
            label: "Letra de los títulos",
            help: "Solo si los títulos usan otra fuente distinta a la del texto.",
            placeholder: "Fraunces, serif",
          },
        ],
      },
      {
        title: "Esquinas redondeadas",
        note: "Qué tan redondas son las esquinas, en píxeles. 0 es cuadrado; 999 es forma de pastilla.",
        fields: [
          radius("sm", "Chicas", "Las esquinas de las etiquetas y los botones pequeños.", "10"),
          radius("md", "Medianas", "Las esquinas de los botones normales y los campos de texto.", "16"),
          radius("lg", "Grandes", "Las esquinas de las tarjetas y las ventanas emergentes.", "24"),
          radius("pill", "Pastilla", "Los chips y botones con forma de píldora. Normalmente se deja en 999.", "999"),
        ],
      },
      {
        title: "Imágenes de fondo",
        fields: [
          {
            key: "theme.assets.heroBackgroundUrl",
            path: ["THEME", "assets", "heroBackgroundUrl"],
            type: "url",
            label: "Fondo de la portada",
            help: "Foto grande detrás del bloque principal. Debe ser una liga pública que empiece con https://.",
            placeholder: "https://tusitio.com/portada.jpg",
          },
          {
            key: "theme.assets.loginBackgroundUrl",
            path: ["THEME", "assets", "loginBackgroundUrl"],
            type: "url",
            label: "Fondo del login",
            help: "Foto detrás de la pantalla de entrar / registrarse.",
            placeholder: "https://tusitio.com/login.jpg",
          },
        ],
      },
    ],
  },
  {
    id: "concierge",
    label: "Concierge",
    blurb: "El asistente que responde y ayuda a reservar. Se enciende desde aquí y aparece en todas las páginas del sitio que carguen el SDK.",
    groups: [
      {
        title: "Encendido",
        fields: [
          {
            key: "conciergeEnabled",
            type: "switch",
            label: "Mostrar el Concierge en el sitio",
            help: "Encendido: la barra del asistente aparece sola en las páginas que ya cargan el SDK, con textos y colores automáticos que puedes ajustar abajo. Apagado: no la mandamos y cada página queda como esté en su propio código. Si hay una página suelta donde no la quieres, tu desarrollador puede excluirla con data-gf-concierge=\"off\".",
          },
        ],
      },
      {
        title: "Quién es",
        requires: "conciergeEnabled",
        fields: [
          {
            key: "concierge.displayName",
            path: ["CONCIERGE", "displayName"],
            type: "text",
            label: "Nombre del estudio",
            help: "Como se presenta el asistente. Si lo dejas vacío, toma el nombre de la marca en cuanto carga el catálogo.",
            placeholder: "Bunker Indoor Golf",
          },
          {
            key: "concierge.contact.whatsapp",
            path: ["CONCIERGE", "contact", "whatsapp"],
            type: "tel",
            label: "WhatsApp de atención",
            help: "Solo números, con lada de país y sin el signo +. México se escribe 52 y luego el número a 10 dígitos. Si lo dejas vacío, no aparece el botón de WhatsApp.",
            placeholder: "5215512345678",
          },
          {
            key: "concierge.locale",
            path: ["CONCIERGE", "locale"],
            type: "select",
            label: "Idioma y formato",
            help: "Cómo se escriben fechas, horas y precios dentro del asistente.",
            choices: options(
              [
                ["es-MX", "Español de México"],
                ["es-ES", "Español de España"],
                ["es-CO", "Español de Colombia"],
                ["en-US", "Inglés de Estados Unidos"],
              ],
              "Automático — español de México",
            ),
          },
          {
            key: "concierge.timezone",
            path: ["CONCIERGE", "timezone"],
            type: "select",
            label: "Zona horaria",
            help: "Con esto el asistente sabe qué es “hoy” y a qué hora son las clases.",
            choices: options(TIMEZONES, "Automático — Ciudad de México"),
          },
        ],
      },
      {
        title: "Qué dice",
        requires: "conciergeEnabled",
        note: "Si dejas un texto vacío, el asistente arma uno solo con el nombre del estudio.",
        fields: [
          {
            key: "concierge.copy.assistantName",
            path: ["CONCIERGE", "copy", "assistantName"],
            type: "text",
            label: "Cómo se llama el asistente",
            help: "El nombre propio del asistente, no el del estudio. Por defecto es “Concierge”.",
            placeholder: "Concierge",
          },
          {
            key: "concierge.copy.title",
            path: ["CONCIERGE", "copy", "title"],
            type: "text",
            label: "Título de la ventana",
            help: "El renglón grande arriba del chat.",
            placeholder: "Bunker Concierge",
          },
          {
            key: "concierge.copy.subtitle",
            path: ["CONCIERGE", "copy", "subtitle"],
            type: "text",
            label: "Subtítulo",
            help: "El renglón chiquito debajo del título.",
            placeholder: "Tu asistente personal",
          },
          {
            key: "concierge.copy.greeting",
            path: ["CONCIERGE", "copy", "greeting"],
            type: "longtext",
            label: "Saludo de bienvenida",
            help: "Lo primero que lee la persona al abrir el asistente. Dos renglones bastan.",
            placeholder: "¡Hola! Soy el concierge de Bunker. Puedo ayudarte a reservar, comprar o resolver tus dudas.",
          },
          {
            key: "concierge.copy.fallback",
            path: ["CONCIERGE", "copy", "fallback"],
            type: "longtext",
            label: "Cuando no entiende",
            help: "La respuesta de rescate cuando la pregunta se sale de lo que sabe contestar.",
            placeholder: "Puedo ayudarte con horarios, paquetes, sedes y reservas.",
          },
        ],
      },
      {
        title: "Qué puede hacer",
        requires: "conciergeEnabled",
        note: "Todo viene encendido. Apaga solo lo que este estudio no vende o no quiere ofrecer por chat.",
        fields: [
          capability("schedule", "Ver horarios", "Consultar clases y horarios del día."),
          capability("packages", "Vender paquetes", "Mostrar y cobrar paquetes de clases."),
          capability("memberships", "Vender membresías", "Mostrar y cobrar membresías."),
          capability("account", "Abrir la cuenta", "Entrar a la cuenta del cliente: sus compras y reservas."),
          capability("directReservation", "Reservar directo", "Apartar un lugar sin salir del chat."),
          capability("whatsapp", "Botón de WhatsApp", "Pasar la conversación a WhatsApp. Se enciende solo si pusiste el número arriba."),
          {
            key: "concierge.experience.locationSwitcher",
            path: ["CONCIERGE", "experience", "locationSwitcher"],
            type: "tri",
            label: "Selector de sede",
            help: "Deja que la persona escoja sucursal dentro del chat. Apágalo si el estudio tiene una sola sede.",
          },
        ],
      },
      {
        title: "Colores del asistente",
        requires: "conciergeEnabled",
        note: "Por defecto usa los colores de la pestaña Marca.",
        fields: [
          {
            key: "concierge.theme.mode",
            path: ["CONCIERGE", "theme", "mode"],
            type: "select",
            label: "Fondo del chat",
            help: "Claro u oscuro solo para la ventana del asistente.",
            choices: options(
              [
                ["light", "Claro"],
                ["dark", "Oscuro"],
              ],
              "Igual que la marca",
            ),
          },
          color("concierge.theme.accent", ["CONCIERGE", "theme", "accent"], "Color del asistente", "El color de la burbuja y los botones del chat.", "#f97316"),
          color("concierge.theme.foreground", ["CONCIERGE", "theme", "foreground"], "Texto del asistente", "El color de las letras dentro del chat.", "#111111"),
        ],
      },
    ],
  },
  {
    id: "tienda",
    label: "Tienda",
    blurb: "Qué ve el cliente cuando compra, y cómo se sirven las imágenes.",
    groups: [
      {
        title: "Membresías",
        fields: [
          {
            key: "SHOW_MEMBERSHIP_OPTIONS",
            path: ["SHOW_MEMBERSHIP_OPTIONS"],
            type: "tri",
            label: "Mostrar “Opciones de la membresía”",
            help: "Es la liga donde el socio administra su membresía: cambiar tarjeta, pausar o cancelar. Viene oculta. Guardar tarjeta y renovar siguen funcionando aunque esté apagada.",
          },
        ],
      },
      {
        title: "Sugerencia al pagar",
        note: "Una oferta fija en el pie del carrito (pago) y en la pantalla de gracias. El título lo escribes tú: donación, proteína, un paquete extra…",
        fields: [
          {
            key: "CROSS_SELL.enabled",
            path: ["CROSS_SELL", "enabled"],
            type: "tri",
            label: "Mostrar una sugerencia en el pago",
            help: "Aparece abajo, fija, en “Tu pedido” cuando el cliente va a pagar, y otra vez en la página de gracias. Hoy es un solo producto; después podemos sumar más.",
          },
          {
            key: "CROSS_SELL.payTitle",
            path: ["CROSS_SELL", "payTitle"],
            type: "text",
            label: "Título en el pago",
            help: "Lo que lee el cliente encima de la oferta, en el carrito. Cada estudio lo usa distinto: “¿Donación para el estudio?”, “¿Proteína después de tu clase?”, “¿Quieres agregar algo más?”.",
            placeholder: "¿Quieres agregar algo más?",
          },
          {
            key: "CROSS_SELL.thanksTitle",
            path: ["CROSS_SELL", "thanksTitle"],
            type: "text",
            label: "Título en la página de gracias",
            help: "El mismo concepto, pero cuando ya pagó o reservó. También es texto libre.",
            placeholder: "¿Algo más para después de tu clase?",
          },
          {
            key: "CROSS_SELL.itemType",
            path: ["CROSS_SELL", "itemType"],
            type: "select",
            label: "Tipo de producto",
            help: "Paquete, membresía o producto de tienda (agua, proteína, donación). Tiene que existir y estar activo en gafa.fit.",
            choices: options(
              [
                ["combo", "Paquete"],
                ["membership", "Membresía"],
                ["product", "Producto de tienda"],
              ],
              "Paquete",
            ),
          },
          {
            key: "CROSS_SELL.itemId",
            path: ["CROSS_SELL", "itemId"],
            type: "number",
            label: "Número del producto",
            help: "El ID de gafa.fit. En Fitspin, por ejemplo, el paquete “1 clase” es 971. Si el ID no existe o ya está en el carrito, no se muestra nada.",
            placeholder: "971",
          },
        ],
      },
      {
        title: "Imágenes",
        fields: [
          {
            key: "IMAGES.provider",
            path: ["IMAGES", "provider"],
            type: "select",
            label: "Miniaturas",
            help: "“Optimizadas” hace las fotos más ligeras y el sitio carga más rápido. Cámbialo a “Originales” solo si notas fotos que no cargan.",
            choices: options(
              [
                ["cloudflare", "Optimizadas (recomendado)"],
                ["none", "Originales, sin tocar"],
              ],
              "Sin cambio — optimizadas",
            ),
          },
        ],
      },
      {
        title: "Catálogo",
        fields: [
          {
            key: "BRAND_ID",
            path: ["BRAND_ID"],
            type: "number",
            label: "Marca por defecto",
            help: "Si la compañía tiene varias marcas en gafa.fit, aquí va el número de la que se muestra primero. Si tiene una sola, déjalo vacío.",
            placeholder: "171",
          },
          {
            key: "language",
            path: ["language"],
            type: "select",
            label: "Idioma",
            help: "Reservado para cuando el SDK esté traducido. Hoy los textos siguen en español aunque escojas inglés.",
            choices: options(
              [
                ["es", "Español"],
                ["en", "Inglés"],
              ],
              "Sin cambio — español",
            ),
          },
        ],
      },
    ],
  },
  {
    id: "conexion",
    label: "Conexión",
    blurb: "Plomería. No hace falta tocar nada aquí salvo que el equipo de Buq te lo pida.",
    advanced: true,
    groups: [
      {
        title: "Actividad",
        fields: [
          {
            key: "ANALYTICS",
            path: ["ANALYTICS"],
            type: "tri",
            label: "Mandar actividad al Hub",
            help: "Es lo que llena Actividad y Bitácora: quién entró, qué reservó, qué compró. Si lo apagas, este estudio deja de aparecer en los tableros.",
          },
        ],
      },
      {
        title: "Servidores",
        note: "Cámbialos solo para pruebas. Vacío = el servidor que le toca a producción.",
        fields: [
          {
            key: "BUQ_ENV",
            path: ["BUQ_ENV"],
            type: "select",
            label: "Ambiente",
            help: "Contra qué servidor habla el sitio. “Producción” es el de siempre; los otros dos son para pruebas internas y no tienen los datos reales.",
            choices: options(
              [
                ["production", "Producción"],
                ["staging", "Pruebas (staging)"],
                ["development", "Desarrollo"],
              ],
              "Sin cambio — producción",
            ),
          },
          {
            key: "GAFA_FIT_URL",
            path: ["GAFA_FIT_URL"],
            type: "url",
            label: "Dirección de la API",
            help: "El servidor de gafa.fit que responde reservas y compras. Vacío = el que corresponde al ambiente de arriba.",
            placeholder: "https://api.gafa.fit",
          },
          {
            key: "GAFAPAY_FRONT_URL",
            path: ["GAFAPAY_FRONT_URL"],
            type: "url",
            label: "Dirección del cobro",
            help: "El script que abre Stripe o PayPal al pagar.",
            placeholder: "https://pay.buq.mx",
          },
          {
            key: "HUB_URL",
            path: ["HUB_URL"],
            type: "url",
            label: "Dirección del Hub",
            help: "A dónde manda el sitio su actividad y de dónde baja esta configuración. Vacío = hub.buq.partners.",
            placeholder: "https://hub.buq.partners",
          },
        ],
      },
      {
        title: "Llaves públicas",
        note: "Aquí solo van llaves públicas. La llave secreta nunca se guarda en el Hub: si la pegas, se tira al guardar.",
        fields: [
          {
            key: "CAPTCHA_PUBLIC_KEY",
            path: ["CAPTCHA_PUBLIC_KEY"],
            type: "text",
            label: "Llave pública del captcha",
            help: "El “no soy un robot” del registro. Vacío = la llave compartida de Buq, que ya funciona.",
            placeholder: "6Lc…",
          },
          {
            key: "TOKENMOVIL",
            path: ["TOKENMOVIL"],
            type: "text",
            label: "Token de la app móvil",
            help: "Solo si este sitio se abre dentro de la app y tiene que reconocer al usuario que ya entró ahí.",
            placeholder: "—",
          },
        ],
      },
    ],
  },
];

const TRI_LABELS = [
  { value: "", label: "Sin cambio" },
  { value: "true", label: "Sí" },
  { value: "false", label: "No" },
];

export function triChoices() {
  return TRI_LABELS;
}

export function allFields() {
  const out = [];
  for (const section of CONFIG_SECTIONS) {
    for (const group of section.groups) {
      for (const field of group.fields) {
        if (field.path) out.push({ ...field, section: section.id, group: group.title });
      }
    }
  }
  return out;
}

export function fieldByKey(key) {
  return allFields().find((field) => field.key === key) ?? null;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getAtPath(source, path) {
  let node = source;
  for (const step of path) {
    if (!isObject(node)) return undefined;
    node = node[step];
  }
  return node;
}

export function setAtPath(target, path, value) {
  let node = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    const step = path[index];
    if (!isObject(node[step])) node[step] = {};
    node = node[step];
  }
  node[path[path.length - 1]] = value;
}

export function deleteAtPath(target, path) {
  const parents = [];
  let node = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    const step = path[index];
    if (!isObject(node[step])) return;
    parents.push([node, step]);
    node = node[step];
  }
  delete node[path[path.length - 1]];
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const [parent, step] = parents[index];
    if (isObject(parent[step]) && !Object.keys(parent[step]).length) delete parent[step];
  }
}

/** `concierge` en minúsculas es alias viejo: lo normalizamos a `CONCIERGE`. */
export function normalizeConfig(config) {
  const source = isObject(config) ? clone(config) : {};
  if (source.concierge !== undefined) {
    if (source.CONCIERGE === undefined) source.CONCIERGE = source.concierge;
    delete source.concierge;
  }
  return source;
}

function draftValue(field, raw) {
  if (raw == null) return "";
  if (field.type === "tri") return raw === true ? "true" : raw === false ? "false" : "";
  if (field.type === "px") {
    const match = String(raw).match(/-?\d+(\.\d+)?/);
    return match ? match[0] : "";
  }
  if (typeof raw === "object") return "";
  return String(raw);
}

export function draftFromConfig(config) {
  const source = normalizeConfig(config);
  const draft = { conciergeEnabled: source.CONCIERGE != null && source.CONCIERGE !== false };
  for (const field of allFields()) {
    draft[field.key] = draftValue(field, getAtPath(source, field.path));
  }
  return draft;
}

function storedValue(field, value) {
  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === "" || raw == null) return undefined;
  if (field.type === "tri") return raw === "true";
  if (field.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  if (field.type === "px") {
    const n = Number(raw);
    return Number.isFinite(n) ? `${n}px` : undefined;
  }
  if (field.type === "color") return String(raw).toLowerCase();
  return String(raw);
}

/**
 * Formulario -> partial. Parte del partial guardado para no borrar nada que
 * esta pantalla no sepa pintar.
 */
export function configFromDraft(base, draft) {
  const next = normalizeConfig(base);
  const conciergeOn = Boolean(draft.conciergeEnabled);
  if (!conciergeOn) delete next.CONCIERGE;
  else if (!isObject(next.CONCIERGE)) next.CONCIERGE = {};

  for (const field of allFields()) {
    const insideConcierge = field.path[0] === "CONCIERGE";
    if (insideConcierge && !conciergeOn) continue;
    const value = storedValue(field, draft[field.key]);
    if (value === undefined) deleteAtPath(next, field.path);
    else setAtPath(next, field.path, value);
  }

  // Vaciar los campos poda el objeto: si no quedó nada, el Concierge sigue
  // encendido con los defaults live.
  if (conciergeOn && (!isObject(next.CONCIERGE) || !Object.keys(next.CONCIERGE).length)) next.CONCIERGE = true;
  return next;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Errores en lenguaje de humano, por clave de campo. */
export function validateDraft(draft) {
  const errors = {};
  for (const field of allFields()) {
    const raw = typeof draft[field.key] === "string" ? draft[field.key].trim() : "";
    if (!raw) continue;
    if (field.type === "color" && !HEX.test(raw)) {
      errors[field.key] = "Escribe el color con # y seis letras o números, como #c8ff2e.";
    } else if (field.type === "url" && !/^https?:\/\/.+/i.test(raw)) {
      errors[field.key] = "La liga tiene que empezar con https:// y llevar la dirección completa.";
    } else if (field.type === "tel" && !/^\d{8,20}$/.test(raw)) {
      errors[field.key] = "Solo números, con la lada del país y sin el +. Ejemplo: 5215512345678.";
    } else if (field.type === "number" && !(Number.isFinite(Number(raw)) && Number(raw) > 0)) {
      errors[field.key] = "Tiene que ser un número mayor que cero.";
    } else if (field.type === "px" && !(Number.isFinite(Number(raw)) && Number(raw) >= 0)) {
      errors[field.key] = "Tiene que ser un número de píxeles, por ejemplo 16.";
    }
  }
  return errors;
}

function labelForValue(field, raw) {
  if (field.type === "tri") return raw === true ? "Sí" : "No";
  if (field.type === "px") return `${draftValue(field, raw)} px`;
  if (field.choices) {
    const match = field.choices.find((choice) => choice.value === String(raw));
    return match ? match.label : String(raw);
  }
  return String(raw);
}

/** Lo que está cambiando este estudio, en frases cortas. */
export function summarizeConfig(config) {
  const source = normalizeConfig(config);
  const out = [];
  if (source.CONCIERGE === true) {
    out.push({ label: "Concierge", value: "Encendido con todo automático", section: "concierge" });
  } else if (isObject(source.CONCIERGE)) {
    out.push({ label: "Concierge", value: "Encendido y ajustado", section: "concierge" });
  }
  for (const field of allFields()) {
    const raw = getAtPath(source, field.path);
    if (raw == null || typeof raw === "object") continue;
    out.push({
      label: field.label,
      value: labelForValue(field, raw),
      section: field.section,
      swatch: field.type === "color" ? String(raw) : null,
    });
  }
  return out;
}

/** Claves guardadas que este formulario no pinta: se conservan al guardar. */
export function unmanagedPaths(config) {
  const source = normalizeConfig(config);
  const known = new Set(allFields().map((field) => field.path.join(".")));
  const skipRoots = new Set(["COMPANY_ID", "API_CLIENT"]);
  const out = [];
  const walk = (node, path) => {
    for (const [key, value] of Object.entries(node)) {
      const next = [...path, key];
      const joined = next.join(".");
      if (path.length === 0 && skipRoots.has(key)) continue;
      if (known.has(joined)) continue;
      if (isObject(value)) {
        const before = out.length;
        walk(value, next);
        if (out.length === before && !Object.keys(value).length) out.push(joined);
      } else if (joined === "CONCIERGE" && value === true) {
        continue;
      } else {
        out.push(joined);
      }
    }
  };
  walk(source, []);
  return out;
}

export function sameConfig(a, b) {
  return JSON.stringify(sortDeep(normalizeConfig(a))) === JSON.stringify(sortDeep(normalizeConfig(b)));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!isObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key]);
  return out;
}
