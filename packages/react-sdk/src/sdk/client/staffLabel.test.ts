import { describe, expect, it } from "vitest";
import { staffLabel } from "./staffLabel";

describe("staffLabel", () => {
  it("usa el Título (job) en lugar del nombre legal", () => {
    expect(
      staffLabel({ job: "ISA", name: "Isabel", lastname: "García" }),
    ).toBe("ISA");
  });

  it("acepta el campo apodo si job viene vacío", () => {
    expect(
      staffLabel({ job: "", apodo: "Pollo", name: "Pedro", lastname: "López" }),
    ).toBe("Pollo");
  });

  it("cae al nombre y apellido si no hay Título", () => {
    expect(staffLabel({ name: "Ana", lastname: "Ruiz" })).toBe("Ana Ruiz");
  });

  it("ignora Título en blanco", () => {
    expect(staffLabel({ job: "   ", name: "Ana", lastname: "Ruiz" })).toBe("Ana Ruiz");
  });

  it("devuelve undefined si no hay nada que pintar", () => {
    expect(staffLabel(undefined)).toBeUndefined();
    expect(staffLabel({ job: null, name: "", lastname: "" })).toBeUndefined();
  });
});
