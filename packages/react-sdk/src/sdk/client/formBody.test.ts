import { describe, expect, it } from "vitest";
import { toFormBody } from "./formBody";

describe("toFormBody", () => {
  it("anida objetos como array PHP, no como JSON", () => {
    const form = toFormBody({
      payment_data: {
        stripeToken: "tok_visa",
        card: { id: "card_1", brand: "visa" },
      },
    });

    expect(form.get("payment_data[stripeToken]")).toBe("tok_visa");
    expect(form.get("payment_data[card][id]")).toBe("card_1");
    expect(form.get("payment_data[card][brand]")).toBe("visa");
    expect(form.get("payment_data[card]")).toBeNull();
  });

  it("indexa arrays", () => {
    const form = toFormBody({ combos_id: [7, 9] });

    expect(form.get("combos_id[0]")).toBe("7");
    expect(form.get("combos_id[1]")).toBe("9");
  });

  it("omite null y undefined, conserva 0 y false", () => {
    const form = toFormBody({ a: null, b: undefined, subscribe: 0, set_payment: false });

    expect(form.has("a")).toBe(false);
    expect(form.has("b")).toBe(false);
    expect(form.get("subscribe")).toBe("0");
    expect(form.get("set_payment")).toBe("false");
  });

  it("deja intactas las claves que ya vienen con corchetes", () => {
    const form = toFormBody({ "map_objectsSelected[0][id]": 42 });

    expect(form.get("map_objectsSelected[0][id]")).toBe("42");
  });
});
