import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  bookedActionLabel,
  bookedCopy,
  bookedCardAction,
  bookedPillText,
  cancelAllLabel,
  cancelLockedHint,
  cancellableSpots,
  spotRowLabel,
  type BookedSpot,
  type SdkLang,
} from "./bookedMeeting";
import { firstFocusable, trapTabKey } from "./focusTrap";
import { SdkBodyOverlay } from "./SdkBodyOverlay";
import { CloseIcon } from "./sdkIcons";

function CancelControl({
  locked,
  lang,
  busy,
  className,
  ariaLabel,
  onClick,
  children,
}: {
  locked: boolean;
  lang: SdkLang;
  busy?: boolean;
  className: string;
  ariaLabel: string;
  onClick(): void;
  children: ReactNode;
}) {
  const autoId = useId();
  const hintId = `gafa-cancel-hint-${autoId.replace(/:/g, "")}`;
  const hint = cancelLockedHint(lang);
  const button = (
    <button
      className={className}
      type="button"
      disabled={busy || locked}
      aria-disabled={locked ? true : undefined}
      aria-label={ariaLabel}
      aria-describedby={locked ? hintId : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (locked || busy) return;
        onClick();
      }}
    >
      {children}
    </button>
  );
  if (!locked) return button;
  return (
    <span className="gafa-cancel-tip" tabIndex={0} aria-describedby={hintId}>
      {button}
      <span id={hintId} role="tooltip" className="gafa-cancel-tip__msg">
        {hint}
      </span>
    </span>
  );
}

export function BookedMeetingFooter({
  spots,
  lang,
  compact = false,
  busy = false,
  onCancel,
  onManage,
}: {
  spots: BookedSpot[];
  lang: SdkLang;
  compact?: boolean;
  busy?: boolean;
  onCancel(spots: BookedSpot[]): void;
  onManage(): void;
}) {
  const action = bookedCardAction(spots);
  const pill = bookedPillText(spots, lang);
  const label = bookedActionLabel(action, lang);
  const locked = action === "locked";
  const copy = bookedCopy[lang];

  return (
    <div className="gafa-meeting-card__booked" data-compact={compact ? "true" : undefined}>
      <span className="gafa-availability-pill gafa-availability-pill--reserved">{pill}</span>
      {action === "manage" ? (
        <button
          className="gafa-sdk-button gafa-sdk-button--secondary gafa-meeting-card__cancel"
          type="button"
          disabled={busy}
          aria-label={copy.manageLabel}
          onClick={(event) => {
            event.stopPropagation();
            onManage();
          }}
        >
          {label}
        </button>
      ) : (
        <CancelControl
          lang={lang}
          locked={locked}
          busy={busy}
          className="gafa-sdk-button gafa-sdk-button--secondary gafa-meeting-card__cancel"
          ariaLabel={copy.cancelSpot(spotRowLabel(spots[0], 0, 1, lang))}
          onClick={() => onCancel(cancellableSpots(spots))}
        >
          {label}
        </CancelControl>
      )}
    </div>
  );
}

export function BookedSpotsSheet({
  title,
  lang,
  meta,
  spots,
  busy = false,
  confirming = false,
  onClose,
  onCancel,
  onCancelAll,
}: {
  title: string;
  lang: SdkLang;
  meta?: string;
  spots: BookedSpot[];
  busy?: boolean;
  confirming?: boolean;
  onClose(): void;
  onCancel(spot: BookedSpot): void;
  onCancelAll(spots: BookedSpot[]): void;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const copy = bookedCopy[lang];
  const cancellable = cancellableSpots(spots);
  const cancelAllLocked = cancellable.length !== spots.length;
  const interaction = useRef({ busy, confirming, onClose });
  interaction.current = { busy, confirming, onClose };

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      const state = interaction.current;
      if (state.confirming) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!state.busy) state.onClose();
      } else {
        trapTabKey(sheet, event);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    (firstFocusable(sheet) ?? sheet).focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previous?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!confirming && sheet && !sheet.contains(document.activeElement)) {
      (firstFocusable(sheet) ?? sheet).focus({ preventScroll: true });
    }
  }, [confirming]);

  return (
    <SdkBodyOverlay
      className="gafa-reservation-overlay gafa-booked-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && !confirming) onClose();
      }}
    >
      <div
        className="gafa-reservation-sheet gafa-booked-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={sheetRef}
      >
        <button className="gafa-reservation-close" type="button" aria-label={copy.close} onClick={onClose} disabled={busy || confirming}>
          <CloseIcon />
        </button>
        <div className="gafa-reservation-hero">
          <span className="gafa-eyebrow">{copy.yourSpots}</span>
          <h3 id={titleId}>{title}</h3>
          {meta ? <p>{meta}</p> : null}
        </div>
        <ul className="gafa-booked-sheet__list">
          {spots.map((spot, index) => (
            <li key={String(spot.id)} className="gafa-booked-sheet__row">
              <span>{spotRowLabel(spot, index, spots.length, lang)}</span>
              <CancelControl
                lang={lang}
                locked={!spot.canCancel}
                busy={busy}
                className="gafa-sdk-button gafa-sdk-button--secondary gafa-meeting-card__cancel"
                ariaLabel={copy.cancelSpot(spotRowLabel(spot, index, spots.length, lang))}
                onClick={() => onCancel(spot)}
              >
                {copy.cancel}
              </CancelControl>
            </li>
          ))}
        </ul>
        {spots.length > 1 ? (
          <div className="gafa-booked-sheet__cancel-all">
            <CancelControl
              lang={lang}
              locked={cancelAllLocked}
              busy={busy}
              className="gafa-sdk-button gafa-sdk-button--secondary gafa-sdk-button--danger"
              ariaLabel={cancelAllLabel(spots.length, lang)}
              onClick={() => onCancelAll(cancellable)}
            >
              {cancelAllLabel(spots.length, lang)}
            </CancelControl>
          </div>
        ) : null}
      </div>
    </SdkBodyOverlay>
  );
}
