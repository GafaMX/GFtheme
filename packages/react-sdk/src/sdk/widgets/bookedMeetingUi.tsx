import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  bookedActionLabel,
  bookedCopy,
  bookedCardAction,
  bookedPillText,
  cancelAllLabel,
  cancelLockedHint,
  cancellableSpots,
  expiredSpotsMessage,
  spotRowLabel,
  type BookedSpot,
  type SdkLang,
} from "./bookedMeeting";
import { firstFocusable, trapTabKey } from "./focusTrap";
import { SdkBodyOverlay } from "./SdkBodyOverlay";
import { CloseIcon } from "./sdkIcons";

function FloatingCancelHint({ anchor, children }: {
  anchor: RefObject<HTMLButtonElement | null>;
  children: string;
}) {
  const tipRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    function update() {
      const tip = tipRef.current;
      const button = anchor.current;
      if (!tip || !button) return;
      const margin = 8;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const rect = button.getBoundingClientRect();
      const { width, height } = tip.getBoundingClientRect();
      const centered = rect.left + (rect.width - width) / 2;
      const above = rect.top - height - margin;
      const top = above >= margin ? above : rect.bottom + margin;
      tip.style.left = `${Math.max(margin, Math.min(centered, viewportWidth - width - margin))}px`;
      tip.style.top = `${Math.max(margin, Math.min(top, viewportHeight - height - margin))}px`;
    }

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchor, children]);

  return (
    <SdkBodyOverlay className="gafa-cancel-tip-host" lockScroll={false} aria-hidden="true">
      <span className="gafa-cancel-tip__msg" ref={tipRef}>{children}</span>
    </SdkBodyOverlay>
  );
}

function CancelControl({
  locked,
  lang,
  busy,
  className,
  ariaLabel,
  onClick,
  describedBy,
  children,
}: {
  locked: boolean;
  lang: SdkLang;
  busy?: boolean;
  className: string;
  ariaLabel: string;
  onClick(): void;
  describedBy?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const hintId = `gafa-cancel-hint-${autoId.replace(/:/g, "")}`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hint = cancelLockedHint(lang);
  const button = (
    <button
      className={className}
      type="button"
      ref={buttonRef}
      disabled={!locked && busy}
      aria-disabled={locked ? true : undefined}
      aria-label={ariaLabel}
      aria-describedby={locked ? hintId : describedBy}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={(event) => {
        if (locked && event.key === "Escape") {
          setFocused(false);
          setHovered(false);
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (locked) {
          event.currentTarget.focus();
          setFocused(true);
          return;
        }
        if (busy) return;
        onClick();
      }}
    >
      {children}
    </button>
  );
  return (
    <>
      {button}
      {locked && <span id={hintId} role="tooltip" hidden>{hint}</span>}
      {locked && (focused || hovered) && <FloatingCancelHint anchor={buttonRef}>{hint}</FloatingCancelHint>}
    </>
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

export type CancellationFeedback = { message: string; tone: "error" | "success" };

export function CancellationStatus({ feedback }: { feedback?: CancellationFeedback }) {
  return (
    <p
      className={feedback ? `gafa-sdk-state gafa-sdk-state--${feedback.tone}` : "gafa-sr-only"}
      role="status"
      aria-atomic="true"
    >
      {feedback?.message}
    </p>
  );
}

export function BookedSpotsSheet({
  title,
  lang,
  meta,
  spots,
  busy = false,
  confirming = false,
  feedback,
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
  feedback?: CancellationFeedback;
  onClose(): void;
  onCancel(spot: BookedSpot): void;
  onCancelAll(): void;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const copy = bookedCopy[lang];
  const cancellable = cancellableSpots(spots);
  const expiredId = useId();
  const mixed = cancellable.length > 0 && cancellable.length < spots.length;
  const expired = !busy && mixed ? expiredSpotsMessage(spots, lang) : undefined;
  const allLabel = mixed ? copy.cancelAvailable(cancellable.length) : cancelAllLabel(spots.length, lang);
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
        <CancellationStatus feedback={feedback} />
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
        {expired ? <p className="gafa-sdk-state" id={expiredId}>{expired}</p> : null}
        {spots.length > 1 ? (
          <div className="gafa-booked-sheet__cancel-all">
            <CancelControl
              lang={lang}
              locked={cancellable.length === 0}
              busy={busy}
              className="gafa-sdk-button gafa-sdk-button--secondary gafa-sdk-button--danger"
              ariaLabel={allLabel}
              describedBy={expired ? expiredId : undefined}
              onClick={onCancelAll}
            >
              {allLabel}
            </CancelControl>
          </div>
        ) : null}
      </div>
    </SdkBodyOverlay>
  );
}
