import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { FilterMultiSelect, type FilterMultiOption } from "./FilterMultiSelect";

const SERVICES: FilterMultiOption[] = [
  { id: 10, name: "Pilates Reformer" },
  { id: 11, name: "Barre" },
  { id: 12, name: "Yoga" },
];

const COACHES: FilterMultiOption[] = [
  {
    id: 1,
    name: "Alex Ruiz",
    photoUrl:
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111"/><text x="40" y="52" text-anchor="middle" font-size="32" fill="#fff">AR</text></svg>',
      ),
  },
  { id: 2, name: "Ana Pérez" },
];

function Harness({
  options = SERVICES,
  showAvatars = false,
  initial = [] as number[],
}: {
  options?: FilterMultiOption[];
  showAvatars?: boolean;
  initial?: number[];
}) {
  const [selectedIds, setSelectedIds] = useState(initial);
  return (
    <FilterMultiSelect
      name="service"
      label="Servicio"
      options={options}
      selectedIds={selectedIds}
      showAvatars={showAvatars}
      onChange={setSelectedIds}
    />
  );
}

afterEach(() => cleanup());

describe("FilterMultiSelect", () => {
  it("abre un menú propio, no un select nativo", () => {
    render(<Harness />);
    expect(document.querySelector("select")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Servicio" }));
    expect(screen.getByRole("listbox", { name: "Servicio" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Pilates Reformer" })).toBeTruthy();
  });

  it("deja marcar varios y el resumen cuenta la selección", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Servicio" }));
    fireEvent.click(screen.getByRole("option", { name: "Pilates Reformer" }));
    fireEvent.click(screen.getByRole("option", { name: "Barre" }));
    expect(screen.getByRole("option", { name: "Pilates Reformer" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("option", { name: "Barre" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("2 seleccionados")).toBeTruthy();
  });

  it("Todos vacía la selección", () => {
    render(<Harness initial={[10]} />);
    fireEvent.click(screen.getByRole("button", { name: "Servicio" }));
    fireEvent.click(screen.getByRole("option", { name: "Todos" }));
    expect(screen.getByRole("option", { name: "Todos" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("option", { name: "Pilates Reformer" }).getAttribute("aria-selected")).toBe("false");
  });

  it("en coaches pinta foto si hay y iniciales si no", () => {
    render(<Harness options={COACHES} showAvatars initial={[1, 2]} />);
    fireEvent.click(screen.getByRole("button", { name: "Servicio" }));
    const photos = document.querySelectorAll(".gafa-multiselect__photo");
    expect(photos.length).toBeGreaterThan(0);
    expect(screen.getAllByText("AP").length).toBeGreaterThan(0);
  });
});
