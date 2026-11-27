import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomFieldInput } from "./CustomFieldInput";
import { isBirthDateField, isDateFieldType } from "./DateField";

afterEach(() => {
  cleanup();
  document.querySelector(".gafa-reservation-overlay")?.remove();
  document.querySelector(".gafa-datepicker-host")?.remove();
  vi.restoreAllMocks();
});

const dateField = {
  id: 1,
  name: "CUMPLEAÑOS",
  type: "date",
  required: true,
  options: [] as Array<{ id: number; name: string }>,
};

function openDateField(onChange: (value: string) => void = () => undefined) {
  render(<CustomFieldInput field={dateField} name="cf-date" value="" onChange={onChange} />);
  const trigger = document.querySelector(".gafa-acct-datefield__button");
  fireEvent.click(trigger!);
  return trigger;
}

describe("campos de fecha del SDK", () => {
  it("reconoce tipos de calendario, no solo 'date'", () => {
    expect(isDateFieldType("date")).toBe(true);
    expect(isDateFieldType("Date")).toBe(true);
    expect(isDateFieldType("date_picker")).toBe(true);
    expect(isDateFieldType("text")).toBe(false);
    expect(isBirthDateField("CUMPLEAÑOS", "date")).toBe(true);
    expect(isBirthDateField("Teléfono", "date")).toBe(false);
  });

  it("los campos especiales de fecha usan el widget mensual, no el nativo", () => {
    openDateField();

    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(document.querySelector(".gafa-datepicker")).toBeTruthy();
    expect(document.querySelector(".gafa-datepicker__day")).toBeTruthy();
  });

  it("el calendario flota en document.body, no dentro del overlay que recorta", () => {
    const overlay = document.createElement("div");
    overlay.className = "gafa-sdk gafa-reservation-overlay";
    overlay.style.overflow = "hidden";
    overlay.style.transform = "translateZ(0)";
    document.body.appendChild(overlay);

    render(
      <CustomFieldInput field={dateField} name="cf-date" value="" onChange={() => undefined} />,
      { container: overlay },
    );

    fireEvent.click(overlay.querySelector(".gafa-acct-datefield__button")!);
    const popover = document.querySelector(".gafa-datepicker--floating");
    expect(popover).toBeTruthy();
    expect(popover?.parentElement?.classList.contains("gafa-datepicker-host")).toBe(true);
    expect(document.body.contains(popover)).toBe(true);
    expect(overlay.contains(popover)).toBe(false);
  });

  it("al tocar un día se guarda la fecha y se cierra el calendario", () => {
    const onChange = vi.fn();
    openDateField(onChange);

    const day = Array.from(document.querySelectorAll(".gafa-datepicker__day")).find(
      (button) => button.textContent === "15" && !(button as HTMLButtonElement).disabled,
    );
    expect(day).toBeTruthy();
    fireEvent.click(day!);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^\d{4}-01-15$/);
    expect(document.querySelector(".gafa-datepicker")).toBeNull();
  });

  it("cambiar el año no cierra el calendario", () => {
    openDateField();

    const yearSelect = document.querySelector('select[aria-label="Año"]') as HTMLSelectElement;
    expect(yearSelect).toBeTruthy();
    const previous = yearSelect.value;
    const nextYear = String(Number(previous) - 1);
    fireEvent.change(yearSelect, { target: { value: nextYear } });

    expect(document.querySelector(".gafa-datepicker")).toBeTruthy();
    expect(yearSelect.value).toBe(nextYear);
  });

  it("cerca del borde inferior fija top:auto para no heredar el top del datepicker de clases", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function mockRect(
      this: HTMLElement,
    ) {
      if (this.classList.contains("gafa-acct-datefield__button")) {
        return {
          x: 16,
          y: 520,
          top: 520,
          bottom: 568,
          left: 16,
          right: 300,
          width: 284,
          height: 48,
          toJSON() {
            return {};
          },
        };
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON() {
          return {};
        },
      };
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 700 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });

    openDateField();

    const popover = document.querySelector(".gafa-datepicker--floating") as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.style.top).toBe("auto");
    expect(popover.style.bottom).toBe("186px");
    expect(popover.style.transform).toBe("none");
    expect(popover.style.right).toBe("auto");
  });
});
