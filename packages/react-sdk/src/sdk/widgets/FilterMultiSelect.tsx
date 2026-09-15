import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildThumbnailUrl } from "../images/imageProxy";
import { useImagesConfig, useTransformSupport } from "../images/ImagesProvider";
import { normalizeServiceName } from "./calendarServiceQuery";

export type FilterMultiOption = {
  id: number;
  name: string;
  photoUrl?: string;
};

export type FilterMultiSelectProps = {
  label: string;
  /** Nombre estable para tests y analytics (`service`, `staff`). */
  name?: string;
  allLabel?: string;
  options: FilterMultiOption[];
  selectedIds: number[];
  onChange(ids: number[]): void;
  showAvatars?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  countLabel?(count: number): string;
};

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Select multiopción del SDK: no usamos `<select>` nativo. El del OS cambia
 * por dispositivo, no admite fotos ni varias marcas a la vez, y se sale del
 * panel de filtros.
 *
 * El menú flota en absoluto: abrir opciones no estira el panel de Filtros.
 */
export function FilterMultiSelect({
  label,
  name,
  allLabel = "Todos",
  options,
  selectedIds,
  onChange,
  showAvatars = false,
  searchable = false,
  searchPlaceholder = "Buscar",
  countLabel,
}: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.filter((option) => selectedIds.includes(option.id));
  const allSelected = selectedIds.length === 0;

  const visibleOptions = useMemo(() => {
    const needle = normalizeServiceName(query);
    if (!needle) return options;
    return options.filter((option) => normalizeServiceName(option.name).includes(needle));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onPeerOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== name) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("gafa-multiselect-open", onPeerOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("gafa-multiselect-open", onPeerOpen);
    };
  }, [name, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    document.dispatchEvent(new CustomEvent("gafa-multiselect-open", { detail: name }));
    if (searchable) searchRef.current?.focus();
  }, [name, open, searchable]);

  function setIds(next: number[]) {
    onChange(next.length === options.length ? [] : next);
  }

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      setIds(selectedIds.filter((item) => item !== id));
      return;
    }
    setIds([...selectedIds, id]);
  }

  const summary = allSelected
    ? allLabel
    : selected.length === 1
      ? selected[0].name
      : (countLabel?.(selected.length) ?? `${selected.length} seleccionados`);

  return (
    <div
      ref={rootRef}
      className="gafa-multiselect"
      data-name={name}
      data-open={open ? "true" : undefined}
      data-avatars={showAvatars ? "true" : undefined}
    >
      <span className="gafa-multiselect__label">{label}</span>
      <button
        type="button"
        className="gafa-multiselect__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="gafa-multiselect__value">
          {showAvatars && selected.length > 0 ? (
            <span className="gafa-multiselect__stack" aria-hidden="true">
              {selected.slice(0, 3).map((option) => (
                <FilterOptionAvatar key={option.id} name={option.name} photoUrl={option.photoUrl} size={26} />
              ))}
            </span>
          ) : null}
          <span className="gafa-multiselect__summary">{summary}</span>
        </span>
        {selected.length > 1 ? <span className="gafa-multiselect__badge">{selected.length}</span> : null}
        <ChevronIcon />
      </button>

      {open ? (
        <div
          className="gafa-multiselect__menu"
          id={listId}
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
        >
          {searchable ? (
            <label className="gafa-multiselect__search">
              <SearchIcon />
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
              />
            </label>
          ) : null}
          <div className="gafa-multiselect__list">
            <button
              type="button"
              className="gafa-multiselect__option"
              role="option"
              aria-selected={allSelected}
              style={{ ["--gafa-option-i" as string]: 0 }}
              onClick={() => onChange([])}
            >
              <CheckMark checked={allSelected} />
              {showAvatars ? (
                <span
                  className="gafa-multiselect__avatar gafa-multiselect__avatar--blank"
                  style={{ width: 48, height: 48, minWidth: 48, minHeight: 48, ["--gafa-avatar-size" as string]: "48px" }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="gafa-multiselect__name">{allLabel}</span>
            </button>
            {visibleOptions.map((option, index) => {
              const checked = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className="gafa-multiselect__option"
                  role="option"
                  aria-selected={checked}
                  style={{ ["--gafa-option-i" as string]: index + 1 }}
                  onClick={() => toggle(option.id)}
                >
                  <CheckMark checked={checked} />
                  {showAvatars ? <FilterOptionAvatar name={option.name} photoUrl={option.photoUrl} size={48} /> : null}
                  <span className="gafa-multiselect__name">{option.name}</span>
                </button>
              );
            })}
            {visibleOptions.length === 0 ? (
              <p className="gafa-multiselect__empty">Sin coincidencias</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function cssUrl(src: string): string {
  return `url(${JSON.stringify(src)})`;
}

/**
 * Avatar del filtro: no usamos `<img>`. En embeds, Elementor/Hello posicionan
 * las fotos en absoluto y se apilan encima del checkbox. Un span con
 * `background-image` se queda en su columna.
 */
export function FilterOptionAvatar({
  name,
  photoUrl,
  size = 48,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
}) {
  const config = useImagesConfig();
  const transformSupport = useTransformSupport();
  const thumbnail =
    !photoUrl || transformSupport === "unsupported"
      ? null
      : buildThumbnailUrl(
          photoUrl,
          { width: size * 2, height: size * 2, fit: "cover", gravity: "face" },
          config,
        );
  const src = thumbnail ?? (config.allowUnoptimizedOriginals ? photoUrl : null) ?? null;

  return (
    <span
      className="gafa-multiselect__avatar"
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        ["--gafa-avatar-size" as string]: `${size}px`,
      }}
      aria-hidden="true"
    >
      <span className="gafa-multiselect__initials">{initials(name)}</span>
      {src ? (
        <span className="gafa-multiselect__photo" data-photo="true" style={{ backgroundImage: cssUrl(src) }} />
      ) : null}
    </span>
  );
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span className="gafa-multiselect__check" data-checked={checked ? "true" : undefined} aria-hidden="true">
      {checked ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path
            d="M3.5 8.2 6.4 11.2 12.5 4.8"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

function ChevronIcon() {
  return (
    <svg className="gafa-multiselect__chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6.2 8 10.2 12 6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m10.2 10.2 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
