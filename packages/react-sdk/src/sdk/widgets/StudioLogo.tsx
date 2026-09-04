import { useQuery } from "@tanstack/react-query";
import type { GafaClient } from "../client/types";
import { useGafaThemeOptional } from "../theme/theme";

/**
 * Logo de la marca para login/registro. Orden: `THEME.logoUrl` del embed, si
 * no el `pic` publico de gafa.fit. Si no hay ninguno, no se pinta nada.
 *
 * Va en `<img>` directo: son wordmarks chicos, no las fotos de 15 MB de coach
 * que sí pasan por Cloudflare Transformations.
 */
export function useStudioLogo(client?: GafaClient, brandSlug?: string): string | undefined {
  const themeLogo = useGafaThemeOptional()?.logoUrl?.trim() || undefined;
  const brandsQuery = useQuery({
    queryKey: ["studio-logo", brandSlug || "*"],
    queryFn: () => client!.listBrands(),
    enabled: Boolean(client) && !themeLogo,
    staleTime: 10 * 60_000,
  });

  if (themeLogo) return themeLogo;
  const brands = brandsQuery.data ?? [];
  const match = brandSlug ? brands.find((brand) => brand.slug === brandSlug) : undefined;
  return match?.logoUrl ?? brands.find((brand) => brand.logoUrl)?.logoUrl;
}

export function StudioLogo({
  client,
  brandSlug,
  alt = "",
}: {
  client?: GafaClient;
  brandSlug?: string;
  alt?: string;
}) {
  const src = useStudioLogo(client, brandSlug);
  if (!src) return null;

  return <img className="gafa-studio-logo" src={src} alt={alt} />;
}
