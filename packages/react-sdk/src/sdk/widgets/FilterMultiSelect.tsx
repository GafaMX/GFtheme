import { useEffect, useId, useState } from "react";
import { RemoteImage } from "../images/ImagesProvider";

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
 */
export function FilterMultiSelect({
  label,
  name,
  allLabel = "Todos",
  options,
  selectedIds,
  onChange,
  showAvatars = false,
  countLabel,
}: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.filter((option) => selectedIds.includes(option.id));
  const allSelected = selectedIds.length === 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
    <div className="gafa-multiselect" data-name={name} data-open={open ? "true" : undefined}>
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
                <FilterOptionAvatar key={option.id} name={option.name} photoUrl={option.photoUrl} size={22} />
              ))}
            </span>
          ) : null}
          <span className="gafa-multiselect__summary">{summary}</span>
        </span>
        {selected.length > 1 ? <span className="gafa-multiselect__badge">{selected.length}</span> : null}
        <ChevronIcon />
      </button>

      {open ? (
        <div className="gafa-multiselect__menu" id={listId} role="listbox" aria-label={label} aria-multiselectable="true">
          <button
            type="button"
            className="gafa-multiselect__option"
            role="option"
            aria-selected={allSelected}
            onClick={() => onChange([])}
          >
            <CheckMark checked={allSelected} />
            <span className="gafa-multiselect__name">{allLabel}</span>
          </button>
          {options.map((option) => {
            const checked = selectedIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                className="gafa-multiselect__option"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(option.id)}
              >
                <CheckMark checked={checked} />
                {showAvatars ? <FilterOptionAvatar name={option.name} photoUrl={option.photoUrl} /> : null}
                <span className="gafa-multiselect__name">{option.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function FilterOptionAvatar({
  name,
  photoUrl,
  size = 28,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
}) {
  return (
    <span className="gafa-multiselect__avatar" style={{ width: size, height: size }} aria-hidden="true">
      <span className="gafa-multiselect__initials">{initials(name)}</span>
      <RemoteImage className="gafa-multiselect__photo" src={photoUrl} size={size} gravity="face" alt="" />
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
