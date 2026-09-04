import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  MapPin,
  MessageCircle,
  Send,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  ConciergeResponseSchema,
  type ConciergeActionData,
  type ConciergeCardData,
  type ConciergePartnerConfig,
  type ConciergeProduct,
} from "./contracts";
import {
  completeAdapterHandoff,
  createConciergeBrowserAdapter,
  type ConciergeBrowserAdapter,
  type ConciergeSdkBridge,
} from "./adapter";
import { type ConciergeAskFn } from "./ask";
import { timeoutSignal } from "./ask";
import { conciergeProducts } from "./products";
import {
  actionAllowed,
  allLocationsLabel,
  catalogGroups,
  emptyCatalogCopy,
  filterCatalogProducts,
  openingChips,
  packagesIntro,
  showLocationSwitcher,
  todayIntro,
  whatsappAvailable,
  whatsappNumber,
  todayIso,
} from "./experience";
import "./concierge.css";

export type ConciergeWidgetProps = {
  config: ConciergePartnerConfig;
  open: boolean;
  onClose: () => void;
  navigate: (path: string) => void;
  sdk?: ConciergeSdkBridge | null;
  webview?: boolean;
  resolveHardPath?: (path: string) => string;
  ask?: ConciergeAskFn;
  /** Incrementar para abrir el catálogo en el chat (botón Comprar de la barra). */
  catalogNonce?: number;
};

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  card?: ConciergeCardData;
  catalog?: boolean;
  chips?: Array<{ label: string; action: ConciergeActionData }>;
};

let messageId = 0;

function personalizeGreeting(greeting: string, firstName?: string): string {
  if (!firstName) return greeting;
  if (greeting.includes("{name}")) return greeting.replace(/\{name\}/g, firstName);
  return greeting.replace(/^(¡?Hola!?)\s*/i, `¡Hola, ${firstName}! `);
}

function packageFor(
  config: ConciergePartnerConfig,
  action: Extract<ConciergeActionData, { kind: "buy_package" }>,
): ConciergeProduct | undefined {
  if (!config.capabilities.packages) return undefined;
  return config.catalog.products.find((product) =>
    product.id === action.productId &&
    product.type === action.productType &&
    (product.type !== "membership" || config.capabilities.memberships) &&
    product.brandSlug === action.brandSlug &&
    product.locationId === action.locationId,
  );
}

function CatalogPanel({
  config,
  adapter,
  onHandoff,
  onStay,
}: {
  config: ConciergePartnerConfig;
  adapter: ConciergeBrowserAdapter;
  onHandoff: () => void;
  onStay: () => void;
}) {
  const groups = catalogGroups(config);
  const switcher = showLocationSwitcher(config);
  const [locationId, setLocationId] = useState<string | undefined>();
  const [groupId, setGroupId] = useState<string | undefined>(groups[0]?.id);
  const products = filterCatalogProducts(config, { locationId, groupId });

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--concierge-line)]" data-gafa-concierge-catalog="">
      {switcher ? (
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--concierge-line)] p-2">
          <button
            type="button"
            data-gafa-concierge-location=""
            onClick={() => setLocationId(undefined)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${locationId ? "border border-[var(--concierge-line)]" : "chip-on"}`}
          >
            {allLocationsLabel(config)}
          </button>
          {config.studios.map((studio) => (
            <button
              key={studio.id}
              type="button"
              data-gafa-concierge-location={studio.locationId}
              onClick={() => setLocationId(studio.locationId)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${locationId === studio.locationId ? "chip-on" : "border border-[var(--concierge-line)]"}`}
            >
              {studio.name}
            </button>
          ))}
        </div>
      ) : null}
      {groups.length ? (
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--concierge-line)] p-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              data-gafa-concierge-group={group.id}
              onClick={() => setGroupId(group.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${groupId === group.id ? "chip-on" : "border border-[var(--concierge-line)]"}`}
            >
              {group.label}
            </button>
          ))}
        </div>
      ) : null}
      {products.length ? products.map((product, index) => (
        <div key={`${product.type}-${product.id}-${product.locationId}`} className={`flex items-center gap-3 p-3 ${index ? "border-t border-[var(--concierge-line)]" : ""}`}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{product.name}</p>
            <p className="text-[11px] opacity-65">{product.note}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[14px] font-extrabold text-[var(--concierge-accent)]">{product.price}</p>
            <button
              type="button"
              onClick={async () => {
                completeAdapterHandoff(
                  await adapter.buyProduct(product),
                  onHandoff,
                  onStay,
                );
              }}
              className="mt-1 rounded-full bg-[var(--concierge-accent)] px-3 py-1 text-[10px] font-bold uppercase text-[var(--concierge-accent-ink)]"
            >
              Comprar →
            </button>
          </div>
        </div>
      )) : (
        <p className="p-3 text-[12px] opacity-70">{emptyCatalogCopy(config)}</p>
      )}
    </div>
  );
}

function PackagesCard({
  card,
  config,
  adapter,
  onHandoff,
  onStay,
}: {
  card: Extract<ConciergeCardData, { type: "packages" }>;
  config: ConciergePartnerConfig;
  adapter: ConciergeBrowserAdapter;
  onHandoff: () => void;
  onStay: () => void;
}) {
  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--concierge-line)]">
      {card.items.map((item, index) => (
        <div key={`${item.action.productType}-${item.action.productId}`} className={`flex items-center gap-3 p-3 ${index ? "border-t border-[var(--concierge-line)]" : ""}`}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{item.name}</p>
            <p className="text-[11px] opacity-65">{item.note}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[14px] font-extrabold text-[var(--concierge-accent)]">{item.price}</p>
            <button
              type="button"
              onClick={async () => {
                const product = packageFor(config, item.action);
                if (!product) {
                  onStay();
                  return;
                }
                completeAdapterHandoff(
                  await adapter.buyProduct(product),
                  onHandoff,
                  onStay,
                );
              }}
              className="mt-1 rounded-full bg-[var(--concierge-accent)] px-3 py-1 text-[10px] font-bold uppercase text-[var(--concierge-accent-ink)]"
            >
              Comprar →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StudiosCard({ card }: { card: Extract<ConciergeCardData, { type: "studios" }> }) {
  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--concierge-line)]">
      {card.items.map((studio, index) => (
        <a
          key={`${studio.name}-${studio.address}`}
          href={studio.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className={`flex items-start gap-3 p-3 hover:bg-[var(--concierge-soft)] ${index ? "border-t border-[var(--concierge-line)]" : ""}`}
        >
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--concierge-accent)]" />
          <span className="min-w-0 flex-1">
            <strong className="block text-[13px]">{studio.name}</strong>
            <span className="block text-[11px] opacity-65">{studio.city} · {studio.address}</span>
          </span>
          <ArrowUpRight className="h-4 w-4 opacity-50" />
        </a>
      ))}
    </div>
  );
}

function ScheduleCard({
  card,
  adapter,
  onHandoff,
}: {
  card: Extract<ConciergeCardData, { type: "schedule" }>;
  adapter: ConciergeBrowserAdapter;
  onHandoff: () => void;
}) {
  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--concierge-line)]">
      <div className="flex items-center justify-between border-b border-[var(--concierge-line)] bg-[var(--concierge-soft)] px-3 py-2 text-[11px] font-bold uppercase">
        <span>{card.locationName}</span><span className="opacity-60">{card.date}</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {card.items.map((item) => (
          <button
            key={`${item.meetingId ?? item.time}-${item.className}`}
            type="button"
            onClick={async () => {
              completeAdapterHandoff(
                await adapter.reserveMeeting(item),
                onHandoff,
                () => adapter.openCalendar(card.locationId, card.date),
              );
            }}
            className="group flex w-full items-center gap-3 border-b border-[var(--concierge-line)] px-3 py-3 text-left last:border-b-0 hover:bg-[var(--concierge-soft)]"
          >
            <strong className="w-[54px] text-[14px] tabular-nums">{item.time}</strong>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[13px]">{item.className}</strong>
              <span className="block truncate text-[11px] opacity-60">
                {item.coach}{item.availableSpots !== null ? ` · ${item.availableSpots ? `${item.availableSpots} libres` : "Lleno"}` : ""}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
      <button type="button" onClick={() => adapter.openCalendar(card.locationId, card.date)} className="w-full bg-[var(--concierge-soft)] px-3 py-2 text-[10px] font-bold uppercase opacity-70">
        Ver calendario completo →
      </button>
    </div>
  );
}

function Card({
  card,
  config,
  adapter,
  onHandoff,
  onStay,
}: {
  card: ConciergeCardData;
  config: ConciergePartnerConfig;
  adapter: ConciergeBrowserAdapter;
  onHandoff: () => void;
  onStay: () => void;
}) {
  if (card.type === "packages") {
    return <PackagesCard card={card} config={config} adapter={adapter} onHandoff={onHandoff} onStay={onStay} />;
  }
  if (card.type === "studios") return <StudiosCard card={card} />;
  return <ScheduleCard card={card} adapter={adapter} onHandoff={onHandoff} />;
}

export function ConciergeWidget(props: ConciergeWidgetProps) {
  const { config, open, onClose, navigate, sdk, webview, resolveHardPath, ask, catalogNonce = 0 } = props;
  const adapter = useMemo(
    () => createConciergeBrowserAdapter({ config, sdk, webview, navigate, resolveHardPath }),
    [config, sdk, webview, navigate, resolveHardPath],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const history = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const scroll = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const inputElement = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const suppressFocusRestore = useRef(false);
  const shownCatalogNonce = useRef(0);

  useEffect(() => {
    if (!open) return;
    suppressFocusRestore.current = false;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => inputElement.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown, true);
      if (!suppressFocusRestore.current) restoreFocus.current?.focus();
    };
  }, [onClose, open]);

  const handoffToSdkModal = useCallback(() => {
    suppressFocusRestore.current = true;
    onClose();
  }, [onClose]);

  const appendAssistant = useCallback((text: string, extra?: Partial<Omit<ChatMessage, "id" | "role" | "text">>) => {
    setMessages((current) => [...current, { id: ++messageId, role: "assistant", text, ...extra }]);
  }, []);

  const showCatalogInChat = useCallback(() => {
    appendAssistant(packagesIntro(config), { catalog: true });
  }, [appendAssistant, config]);

  const stayInChat = useCallback(() => {
    appendAssistant("El checkout no se abrió. Puedes intentar de nuevo desde el catálogo.");
  }, [appendAssistant]);

  useEffect(() => {
    if (!open || messages.length) return;
    void adapter.getProfile().then((profile) => {
      setMessages([{
        id: ++messageId,
        role: "assistant",
        text: personalizeGreeting(config.copy.greeting, profile?.firstName),
        chips: openingChips(config),
      }]);
    });
  }, [adapter, config, messages.length, open]);

  useEffect(() => {
    if (!open || !catalogNonce || !messages.length) return;
    if (shownCatalogNonce.current === catalogNonce) return;
    shownCatalogNonce.current = catalogNonce;
    showCatalogInChat();
  }, [catalogNonce, messages.length, open, showCatalogInChat]);

  useEffect(() => {
    const node = scroll.current;
    if (!node || typeof node.scrollTo !== "function") return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const runAction = useCallback(async (action: ConciergeActionData) => {
    if (action.kind === "say") {
      setInput(action.text);
      return;
    }
    if (!actionAllowed(config, action)) {
      appendAssistant("Esa acción no está disponible para esta compañía.");
      return;
    }
    if (action.kind === "reservar") return adapter.openCalendar();
    if (action.kind === "comprar") {
      showCatalogInChat();
      return;
    }
    if (action.kind === "horarios_hoy") {
      const date = todayIso(config.timezone);
      const studios = action.locationId
        ? config.studios.filter((studio) => studio.locationId === action.locationId)
        : config.studios;
      appendAssistant(todayIntro(config));
      let shown = 0;
      for (const studio of studios) {
        const result = await adapter.listMeetings(studio.locationId, date);
        if (result.status === "ok" && result.items.length) {
          shown += 1;
          appendAssistant(`${studio.name} · ${date}`, {
            card: {
              type: "schedule",
              locationName: studio.name,
              date,
              locationId: studio.locationId,
              items: result.items,
            },
          });
        }
      }
      if (!shown) appendAssistant("No hay horarios publicados para hoy.");
      return;
    }
    if (action.kind === "whatsapp") return adapter.openWhatsapp();
    if (action.kind === "cuenta") {
      completeAdapterHandoff(adapter.openAccount(), handoffToSdkModal, () => adapter.openWhatsapp());
      return;
    }
    if (!("productType" in action)) return;
    const product = packageFor(config, action);
    if (!product) {
      appendAssistant("No encontré ese producto. El catálogo sigue disponible aquí.", { catalog: true });
      return;
    }
    completeAdapterHandoff(await adapter.buyProduct(product), handoffToSdkModal, stayInChat);
  }, [adapter, appendAssistant, config, handoffToSdkModal, showCatalogInChat, stayInChat]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || typing) return;
    setInput("");
    setMessages((current) => [...current, { id: ++messageId, role: "user", text: message }]);
    setTyping(true);

    const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const requestedStudio = config.studios.find((studio) => {
      const labels = [studio.id, studio.name, studio.city]
        .map((value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      return labels.some((label) => label.length > 2 && normalized.includes(label));
    });
    const localPackages = /precio|paquete|membres|comprar|costo/.test(normalized);
    const localStudios = /sede|ubicacion|direccion|estudio/.test(normalized);
    try {
      if (localPackages && config.capabilities.packages) {
        const items = conciergeProducts(config)
          .filter((product) => !requestedStudio || product.locationId === requestedStudio.locationId)
          .map((product) => ({
          name: product.name,
          price: product.price,
          note: product.note,
          action: { kind: "buy_package" as const, productType: product.type, productId: product.id, brandSlug: product.brandSlug, locationId: product.locationId },
        }));
        setMessages((current) => [...current, items.length
          ? { id: ++messageId, role: "assistant", text: packagesIntro(config), catalog: true }
          : {
              id: ++messageId,
              role: "assistant",
              text: emptyCatalogCopy(config),
              chips: config.fallbacks.packages ? [{ label: "Ver paquetes", action: { kind: "comprar" as const } }] : undefined,
            }]);
      } else if (localStudios) {
        setMessages((current) => [...current, {
          id: ++messageId,
          role: "assistant",
          text: "Estas son nuestras sedes:",
          card: { type: "studios", items: config.studios.map(({ name, city, address, mapsUrl }) => ({ name, city, address, mapsUrl })) },
        }]);
      } else {
        if (!ask) throw new Error("concierge_ask_unavailable");
        const apiResponse = await ask(config.id, {
          partnerId: config.id,
          message,
          history: history.current.slice(-20),
        }, { signal: timeoutSignal(28_000) });
        const parsed = ConciergeResponseSchema.safeParse(apiResponse);
        if (!parsed.success) throw new Error("invalid_concierge_response");
        setMessages((current) => [...current, {
          id: ++messageId,
          role: "assistant",
          text: parsed.data.message,
          card: parsed.data.card,
          chips: parsed.data.chips,
        }]);
        history.current = [
          ...history.current,
          { role: "user" as const, content: message },
          { role: "assistant" as const, content: parsed.data.message },
        ].slice(-20);
      }
    } catch {
      setMessages((current) => [...current, {
        id: ++messageId,
        role: "assistant",
        text: config.copy.fallback,
        chips: [
          ...(config.fallbacks.calendar ? [{ label: "Abrir calendario", action: { kind: "reservar" as const } }] : []),
          ...(config.fallbacks.whatsapp && whatsappAvailable(config) ? [{ label: "WhatsApp", action: { kind: "whatsapp" as const } }] : []),
        ],
      }]);
    } finally {
      setTyping(false);
    }
  }, [ask, config, typing]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  const footerActions = useMemo(() => {
    const chips = openingChips(config);
    const labelFor = (kind: "horarios_hoy" | "comprar" | "cuenta", fallback: string) =>
      chips.find((chip) => chip.action.kind === kind)?.label ?? fallback;
    const actions: Array<{ label: string; action: ConciergeActionData }> = [];
    if (config.capabilities.schedule && config.fallbacks.calendar) {
      actions.push({ label: labelFor("horarios_hoy", "Horarios"), action: { kind: "horarios_hoy" } });
    }
    if (config.capabilities.packages && config.fallbacks.packages) {
      actions.push({ label: labelFor("comprar", "Paquetes"), action: { kind: "comprar" } });
    }
    if (config.capabilities.account && config.fallbacks.account) {
      actions.push({ label: labelFor("cuenta", "Mi cuenta"), action: { kind: "cuenta" } });
    }
    return actions;
  }, [config]);
  const variables = {
    "--concierge-accent": config.theme.accent,
    "--concierge-accent-ink": config.theme.foreground,
    "--concierge-bg": config.theme.mode === "dark" ? "#111111" : "#ffffff",
    "--concierge-ink": config.theme.mode === "dark" ? "#ffffff" : "#111111",
    "--concierge-soft": config.theme.mode === "dark" ? "#202020" : "#f4f4f4",
    "--concierge-line": config.theme.mode === "dark" ? "#353535" : "#e5e5e5",
  } as CSSProperties;

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          ref={dialog}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.12 } }}
          style={variables}
          className={`gafa-concierge gafa-concierge-dialog border border-[var(--concierge-line)] bg-[var(--concierge-bg)] text-[var(--concierge-ink)] shadow-2xl${webview ? " is-webview" : ""}`}
          data-gafa-concierge-dialog={config.id}
          id={`concierge-dialog-${config.id}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`concierge-title-${config.id}`}
        >
          <header className="flex items-center gap-3 p-4" style={{ background: "var(--concierge-accent)", color: "var(--concierge-accent-ink)" }}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-black/5"><Sparkles className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <strong id={`concierge-title-${config.id}`} className="block truncate text-[14px]">{config.copy.title}</strong>
              <span className="block truncate text-[11px] opacity-70">{config.copy.subtitle}</span>
            </span>
            <button type="button" onClick={onClose} aria-label="Cerrar concierge" className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"><X className="h-4 w-4" /></button>
          </header>
          <div ref={scroll} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[86%]" : "mr-auto max-w-[94%]"}>
                <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${message.role === "user" ? "bg-[var(--concierge-accent)] text-[var(--concierge-accent-ink)]" : "bg-[var(--concierge-soft)]"}`}>
                  {message.text}
                </div>
                {message.catalog ? (
                  <CatalogPanel config={config} adapter={adapter} onHandoff={handoffToSdkModal} onStay={stayInChat} />
                ) : null}
                {message.card && (
                  <Card
                    card={message.card}
                    config={config}
                    adapter={adapter}
                    onHandoff={handoffToSdkModal}
                    onStay={stayInChat}
                  />
                )}
                {message.chips?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.chips.map((chip) => (
                      <button key={`${chip.label}-${chip.action.kind}`} type="button" onClick={() => void runAction(chip.action)} className="rounded-full border border-[var(--concierge-line)] px-3 py-1.5 text-[11px] font-semibold hover:bg-[var(--concierge-soft)]">
                        {chip.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {typing && <div className="w-fit rounded-2xl bg-[var(--concierge-soft)] px-4 py-2 text-[12px]" aria-label="Escribiendo">•••</div>}
          </div>
          <div className="flex gap-1.5 overflow-x-auto border-t border-[var(--concierge-line)] px-3 py-2">
            {footerActions.map((item) => {
              const Icon = item.action.kind === "comprar"
                ? ShoppingBag
                : item.action.kind === "cuenta"
                  ? UserRound
                  : CalendarDays;
              return (
                <button
                  key={item.action.kind}
                  type="button"
                  onClick={() => void runAction(item.action)}
                  className="whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] hover:bg-[var(--concierge-soft)]"
                >
                  <Icon className="mr-1 inline h-3.5 w-3.5" /> {item.label}
                </button>
              );
            })}
          </div>
          <form onSubmit={submit} className="flex items-center gap-2 border-t border-[var(--concierge-line)] p-3">
            <label htmlFor={`concierge-input-${config.id}`} className="sr-only">Mensaje para {config.copy.assistantName}</label>
            <input ref={inputElement} id={`concierge-input-${config.id}`} value={input} onChange={(event) => setInput(event.target.value)} maxLength={2000} placeholder="Escribe tu pregunta…" className="min-w-0 flex-1 rounded-full bg-[var(--concierge-soft)] px-4 py-2.5 text-[13px] outline-none ring-[var(--concierge-accent)] focus:ring-2" />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Enviar mensaje" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--concierge-accent)] text-[var(--concierge-accent-ink)] disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </form>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

export function ConciergeCommandBar({
  config,
  navigate,
  open,
  setOpen,
  webview,
  collapsedByDefault,
  extraAction,
  onOpenCatalog,
}: {
  config: ConciergePartnerConfig;
  navigate: (path: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  webview?: boolean;
  collapsedByDefault?: boolean;
  extraAction?: ReactNode;
  onOpenCatalog?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(Boolean(collapsedByDefault));
  const routes = webview ? config.routes.webview : config.routes.web;
  const variables = {
    "--concierge-accent": config.theme.accent,
    "--concierge-accent-ink": config.theme.foreground,
  } as CSSProperties;
  return (
    <div
      className={`gafa-concierge gafa-concierge-bar${webview ? " is-webview" : ""}`}
      data-gafa-concierge-bar={config.id}
      style={variables}
    >
      <AnimatePresence mode="wait" initial={false}>
        {collapsed ? (
          <motion.button
            key="compact"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Mostrar acciones"
            className="gafa-concierge-bar-inner is-compact"
          >
            <Sparkles />
          </motion.button>
        ) : (
          <motion.div
            key="bar"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="gafa-concierge-bar-inner"
          >
            {whatsappAvailable(config) && (
              <button
                type="button"
                onClick={() => window.open(`https://wa.me/${whatsappNumber(config)}`, "_blank", "noopener,noreferrer")}
                aria-label="WhatsApp"
                className="gafa-concierge-bar-icon is-whatsapp"
              >
                <MessageCircle />
              </button>
            )}
            {config.capabilities.schedule && config.fallbacks.calendar && (
              <button type="button" onClick={() => navigate(routes.calendar)} className="gafa-concierge-bar-action">
                <CalendarDays />
                <span>Reservar</span>
              </button>
            )}
            {config.capabilities.packages && config.fallbacks.packages && (
              <button
                type="button"
                onClick={() => onOpenCatalog ? onOpenCatalog() : setOpen(true)}
                className="gafa-concierge-bar-action"
              >
                <ShoppingBag />
                <span>Comprar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="gafa-concierge-bar-cta"
              data-gafa-concierge-cta=""
              aria-expanded={open}
              aria-controls={`concierge-dialog-${config.id}`}
            >
              <Sparkles />
              <span>{open ? "Cerrar" : "Concierge"}</span>
            </button>
            {extraAction ? <span className="gafa-concierge-bar-extra">{extraAction}</span> : null}
            <button type="button" onClick={() => setCollapsed(true)} aria-label="Minimizar acciones" className="gafa-concierge-bar-icon">
              <ChevronDown />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { conciergeProducts };
export type { ConciergeSdkBridge };
