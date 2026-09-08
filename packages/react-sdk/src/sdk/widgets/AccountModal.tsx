import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { GafaClient } from "../client/types";
import type { CaptchaProvider } from "../captcha/CaptchaProvider";
import { subscribeToAuthChanges } from "../client/tokenStorage";
import { defaultExploreClasses, defaultExplorePackages } from "../account/exploreDefaults";
import { AuthWidget } from "./AuthWidget";
import { ProfileWidget } from "./ProfileWidget";
import { SdkBodyOverlay } from "./SdkBodyOverlay";
import { StudioLogo } from "./StudioLogo";

export type AccountModalProps = {
  client?: GafaClient;
  captcha?: CaptchaProvider;
  brandSlug?: string;
  hubUrl?: string;
  companyId?: number;
  open: boolean;
  onClose(): void;
  /** Nombre de la marca para el encabezado del popup. */
  title?: string;
  combineWaitlist?: boolean;
  /**
   * CTA de los estados vacios (Reservar / Comprar). Opcionales: si el sitio no
   * los pasa, el popup se cierra y Reservar va a `/reservar`;
   * Comprar abre el fancy nativo de paquetes / membresías / productos.
   */
  onExploreClasses?(): void;
  onExplorePackages?(): void;
};

/**
 * La cuenta vive en un popup, no en una pagina: el socio no pierde el
 * calendario ni el scroll por entrar a ver sus clases. Mismo patron de overlay
 * que el checkout "fancy" para que se sienta una sola cosa.
 */
export function AccountModal({
  client,
  captcha,
  brandSlug,
  hubUrl,
  companyId,
  open,
  onClose,
  title = "Tu cuenta",
  combineWaitlist = false,
  onExploreClasses,
  onExplorePackages,
}: AccountModalProps) {
  const queryClient = useQueryClient();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    const sync = async () => {
      // Un solo hipo de red (no un token invalido de verdad) no debe verse
      // igual que estar deslogueado: sin este reintento, un fallo transitorio
      // justo al abrir el popup mostraba el login aunque la sesion siguiera
      // viva en el resto del sitio.
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const profile = await client.getProfile();
          if (alive) setSignedIn(Boolean(profile));
          return;
        } catch {
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
        }
      }
      if (alive) setSignedIn(false);
    };
    sync();
    const unsubscribe = subscribeToAuthChanges(() => {
      queryClient.invalidateQueries();
      sync();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [client, queryClient]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    sheetRef.current?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <SdkBodyOverlay
      className="gafa-account-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="gafa-account-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-state={signedIn ? "account" : "auth"}
        ref={sheetRef}
        tabIndex={-1}
      >
        <button className="gafa-account-modal__close" type="button" aria-label="Cerrar" onClick={onClose}>
          <CloseIcon />
        </button>

        {signedIn === null ? (
          <div className="gafa-account-modal__loading">
            <span className="gafa-skeleton gafa-account-modal__loading-bar" />
            <span className="gafa-skeleton gafa-account-modal__loading-bar" />
          </div>
        ) : signedIn ? (
          <ProfileWidget
            client={client}
            brandSlug={brandSlug}
            combineWaitlist={combineWaitlist}
            hubUrl={hubUrl}
            companyId={companyId}
            variant="modal"
            onRequestClose={onClose}
            onExploreClasses={() => {
              onClose();
              queueMicrotask(() => (onExploreClasses ?? defaultExploreClasses)());
            }}
            onExplorePackages={() => {
              onClose();
              queueMicrotask(() => (onExplorePackages ?? defaultExplorePackages)());
            }}
          />
        ) : (
          <div className="gafa-account-modal__auth">
            <StudioLogo client={client} brandSlug={brandSlug} alt="" />
            <AuthWidget client={client} captcha={captcha} brandSlug={brandSlug} initialView="login" />
          </div>
        )}
      </div>
    </SdkBodyOverlay>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
