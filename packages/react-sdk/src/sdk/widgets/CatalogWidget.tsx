import { useQuery } from "@tanstack/react-query";
import type { CatalogItem, GafaClient } from "../client/types";
import { WidgetShell } from "./WidgetShell";

export type CatalogKind = "packages" | "memberships" | "services" | "staff";

export type CatalogWidgetProps = {
  client?: GafaClient;
  type?: CatalogKind;
  title?: string;
  filterByName?: string | null;
  filterByBrand?: string | null;
};

export function CatalogWidget({ client, type = "packages", title, filterByName, filterByBrand }: CatalogWidgetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["catalog", type, filterByName, filterByBrand],
    queryFn: async () => {
      if (!client) {
        return demoItems(type);
      }

      const brands = await client.listBrands();
      const visibleBrands = filterByBrand
        ? brands.filter((brand) => brand.name.toLowerCase().includes(filterByBrand.toLowerCase()))
        : brands;

      const results = await Promise.all(
        visibleBrands.map(async (brand) => {
          const items = await getItemsForType(client, type, brand.slug);
          return items.map((item) => ({ ...item, brandName: brand.name }));
        }),
      );

      const items = results.flat();
      if (!filterByName) return items;

      return items.filter((item) => item.name.toLowerCase().includes(filterByName.toLowerCase()));
    },
  });

  return (
    <WidgetShell
      eyebrow={getCatalogLabel(type)}
      title={title ?? getCatalogTitle(type)}
      description="Cards mobile-first listas para conectarse al checkout moderno."
    >
      {isLoading ? <p className="gafa-sdk__state">Cargando catalogo...</p> : null}
      {isError ? <p className="gafa-sdk__state gafa-sdk__state--error">No pudimos cargar el catalogo.</p> : null}
      <div className="gafa-sdk__cards">
        {(data ?? []).map((item) => (
          <article className="gafa-sdk__card" key={`${type}-${item.id}`}>
            <div>
              <p className="gafa-sdk__meta">{item.brandName}</p>
              <h3>{item.name}</h3>
              {item.description ? <p>{item.description}</p> : null}
            </div>
            <button className="gafa-sdk__button" type="button">
              Comprar
            </button>
          </article>
        ))}
      </div>
      {!isLoading && !isError && !data?.length ? <p className="gafa-sdk__state">No hay elementos para mostrar.</p> : null}
    </WidgetShell>
  );
}

async function getItemsForType(client: GafaClient, type: CatalogKind, brandSlug: string): Promise<CatalogItem[]> {
  switch (type) {
    case "memberships":
      return client.listMemberships(brandSlug);
    case "services":
      return client.listServices(brandSlug);
    case "staff":
      return client.listStaff(brandSlug);
    case "packages":
    default:
      return client.listCombos(brandSlug);
  }
}

function getCatalogLabel(type: CatalogKind): string {
  switch (type) {
    case "memberships":
      return "Membresias";
    case "services":
      return "Servicios";
    case "staff":
      return "Staff";
    default:
      return "Paquetes";
  }
}

function demoItems(type: CatalogKind): Array<CatalogItem & { brandName: string }> {
  const brandName = "Demo Studio";

  if (type === "memberships") {
    return [
      {
        id: 2,
        name: "Mensual ilimitada",
        description: "Membresia para clientes recurrentes.",
        priceLabel: "$2,400 MXN",
        type: "membership",
        brandName,
      },
    ];
  }

  if (type === "services") {
    return [
      {
        id: 3,
        name: "Functional Training",
        description: "Servicio de fuerza y acondicionamiento.",
        type: "service",
        brandName,
      },
    ];
  }

  if (type === "staff") {
    return [
      {
        id: 4,
        name: "Coach Demo",
        description: "Entrenador principal.",
        type: "staff",
        brandName,
      },
    ];
  }

  return [
    {
      id: 1,
      name: "10 clases",
      description: "Paquete inicial para reservar en cualquier sede.",
      priceLabel: "$1,200 MXN",
      type: "combo",
      brandName,
    },
  ];
}

function getCatalogTitle(type: CatalogKind): string {
  switch (type) {
    case "memberships":
      return "Elige una membresia";
    case "services":
      return "Explora servicios";
    case "staff":
      return "Conoce al staff";
    default:
      return "Compra paquetes";
  }
}
