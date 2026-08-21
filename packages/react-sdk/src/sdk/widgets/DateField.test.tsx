import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CustomFieldInput } from "./CustomFieldInput";
import { isBirthDateField, isDateFieldType } from "./DateField";

afterEach(() => cleanup());

const dateField = {
  id: 1,
  name: "CUMPLEAÑOS",
  type: "date",
  required: true,
  options: [] as Array<{ id: number; name: string }>,
};

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
    render(
      <CustomFieldInput field={dateField} name="cf-date" value="" onChange={() => undefined} />,
    );

    expect(document.querySelector('input[type="date"]')).toBeNull();
    const trigger = document.querySelector(".gafa-acct-datefield__button");
    expect(trigger).toBeTruthy();

    fireEvent.click(trigger!);
    expect(document.querySelector(".gafa-datepicker")).toBeTruthy();
    expect(document.querySelector(".gafa-datepicker__day")).toBeTruthy();
  });
});
