import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GafaClient } from "../client/types";
import { subscribeToAuthChanges } from "../client/tokenStorage";
import { useCartStore } from "../cart/cartStore";
import {
  CHECKOUT_CATALOG_STALE_MS,
  checkoutCatalogQueryKey,
  fetchCheckoutCatalog,
} from "../cart/checkoutCatalog";

export type HeaderControlsProps = {
  client?: GafaClient;
  /** Si false, solo se muestra Mi cuenta (el v1 no tenia carrito en el header). */
  showCart?: boolean;
  onOpenAccount(): void;
  onOpenCart(): void;
};

/**
 * Lo que el socio espera en `[data-gf-theme="login-register"]`: un boton de
 * cuenta en el header que abre el login/perfil completo en popup. El carrito
 * va al lado, mismo patron que el sitio de prueba.
 */
export function HeaderControls({
  client,
  showCart = true,
  onOpenAccount,
  onOpenCart,
}: HeaderControlsProps) {
  const [signedIn, setSignedIn] = useState(false);
  const lines = useCartStore((s) => s.lines);
  const cartCount = lines.reduce((sum, line) => sum + line.amount, 0);
  const cartBrand = lines[0]?.brandSlug;

  useQuery({
    queryKey: checkoutCatalogQueryKey(cartBrand),
    queryFn: () => fetchCheckoutCatalog(client!, cartBrand!),
    enabled: Boolean(client && cartBrand && cartCount > 0),
    staleTime: CHECKOUT_CATALOG_STALE_MS,
  });

  useEffect(() => {
    if (!client) return;
    let alive = true;

    const sync = async () => {
      try {
        const profile = await client.getProfile();
        if (alive) setSignedIn(Boolean(profile));
      } catch {
        if (alive) setSignedIn(false);
      }
    };

    sync();
    return subscribeToAuthChanges(() => {
      sync();
    });
  }, [client]);

  return (
    <div className="gafa-header-controls">
      {showCart && cartCount > 0 ? (
        <button className="gafa-header-cart" type="button" title="Tu carrito" onClick={onOpenCart}>
          <CartIcon />
          <span className="gafa-header-cart__count">{cartCount}</span>
        </button>
      ) : null}

      <button
        className="gafa-header-account"
        type="button"
        title={signedIn ? "Tu cuenta" : "Iniciar sesión"}
        onClick={onOpenAccount}
      >
        <AccountIcon />
        <span className="gafa-header-account__label">{signedIn ? "Mi cuenta" : "Entrar"}</span>
        {signedIn ? <span className="gafa-header-account__dot" aria-hidden="true" /> : null}
      </button>
    </div>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 5h2l2.1 9.6a1.5 1.5 0 0 0 1.47 1.18h7.1a1.5 1.5 0 0 0 1.47-1.17L19.5 8.2H7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.6" cy="19" r="1.3" fill="currentColor" />
      <circle cx="16" cy="19" r="1.3" fill="currentColor" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
