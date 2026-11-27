import { afterEach, describe, expect, it } from "vitest";
import { h, ratingComment } from "../public/dom.js";

type FakeNode = { nodeType?: number; textContent?: string; innerHTML?: string; childNodes?: FakeNode[] };

function installFakeDocument() {
  (globalThis as { document?: unknown }).document = {
    createElement(tag: string) {
      const attrs: Record<string, string> = {};
      const childNodes: FakeNode[] = [];
      const el: FakeNode & {
        className: string;
        value: string;
        setAttribute(key: string, value: string): void;
        append(child: FakeNode): void;
        addEventListener(): void;
        tagName: string;
      } = {
        tagName: tag.toUpperCase(),
        className: "",
        innerHTML: "",
        value: "",
        childNodes,
        setAttribute(key, value) {
          attrs[key] = value;
        },
        append(child) {
          childNodes.push(child);
        },
        addEventListener() {},
        get textContent() {
          return childNodes.map((child) => child.textContent ?? "").join("");
        },
      };
      return el;
    },
    createTextNode(text: string) {
      return { nodeType: 3, textContent: String(text) };
    },
  };
}

describe("h() escapa comentarios", () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it("un comentario con HTML malicioso queda como texto, no se interpreta", () => {
    installFakeDocument();
    const evil = '<img src=x onerror="alert(1)">';
    const node = ratingComment(evil) as FakeNode;
    expect(node.innerHTML).toBe("");
    expect(node.childNodes?.[0]?.nodeType).toBe(3);
    expect(node.childNodes?.[0]?.textContent).toBe(evil);
    expect(node.textContent).toBe(evil);
  });

  it("html: sí pinta markup, y el comentario no usa esa vía", () => {
    installFakeDocument();
    const unsafe = h("div", { html: "<b>x</b>" }) as FakeNode;
    expect(unsafe.innerHTML).toBe("<b>x</b>");
    const comment = ratingComment("<b>x</b>") as FakeNode;
    expect(comment.innerHTML).toBe("");
    expect(comment.childNodes?.[0]?.textContent).toBe("<b>x</b>");
  });
});
