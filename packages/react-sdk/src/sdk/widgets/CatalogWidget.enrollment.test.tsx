import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createMockGafaClient } from "../client/gafaClient";
import { createGafaSdk } from "../runtime";

const COMBO_INSCRIPCION = 3491;
const COMBO_NORMAL = 3492;
const MEMBRESIA = 1272;

function clienteFalso() {
  return {
    ...createMockGafaClient(),
    listBrands: async () => [{ id: 1, slug: "marca", name: "Marca", currency: { prefix: "$", code: "MXN" } }],
    listCombos: async () => [
      { id: COMBO_INSCRIPCION, name: "Cuota de ingreso", price: 500, type: "combo" },
      { id: COMBO_NORMAL, name: "Paquete mensual", price: 900, type: "combo" },
    ],
  };
}

function bloqueHeredado() {
  const script = document.createElement("script");
  script.type = "application/json";
  script.setAttribute("data-gafa-options", "");
  script.textContent = JSON.stringify({
    MEMBERSHIP_ENROLLMENT: { comboId: COMBO_INSCRIPCION, membershipIds: [MEMBRESIA] },
  });
  document.body.appendChild(script);
}

async function montarCatalogo(config: Record<string, unknown>) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const sdk = createGafaSdk(
    { apiBaseUrl: "https://buq.test", companyId: 1, analyticsEnabled: false, ...config },
    { client: clienteFalso() as never },
  );
  sdk.mountCatalog(root, { type: "packages" });
  await waitFor(() => expect(root.textContent).toContain("Paquete mensual"));
  return root;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("CatalogWidget · Inscripción heredada del DOM", () => {
  it("legacyMembershipEnrollment: false no oculta el paquete aunque el DOM traiga MEMBERSHIP_ENROLLMENT", async () => {
    bloqueHeredado();
    const root = await montarCatalogo({ legacyMembershipEnrollment: false });
    expect(root.textContent).toContain("Cuota de ingreso");
    expect(root.textContent).toContain("Paquete mensual");
  });

  it("V2 (sin la opción) sigue ocultando el paquete de Inscripción del DOM", async () => {
    bloqueHeredado();
    const root = await montarCatalogo({});
    expect(root.textContent).not.toContain("Cuota de ingreso");
    expect(root.textContent).toContain("Paquete mensual");
  });
});
