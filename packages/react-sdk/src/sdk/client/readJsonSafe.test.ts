import { describe, expect, it } from "vitest";
import { readJsonSafe } from "./httpGafaClient";

describe("readJsonSafe", () => {
  it("rescata el JSON que viene detrás de un Warning de PHP", async () => {
    const res = new Response('<br />\n<b>Warning</b>: Undefined index x in <b>/a.php</b><br />\n{"ok":true}');
    await expect(readJsonSafe(res)).resolves.toEqual({ ok: true });
  });
  it("HTML puro da un mensaje amable, no 'Unexpected token'", async () => {
    const res = new Response("<br /> <b>Fatal error</b>: boom", { status: 200 });
    await expect(readJsonSafe(res)).rejects.toThrow(/problema con el servidor/);
  });
});
