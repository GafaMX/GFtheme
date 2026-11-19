/** DOM del admin. Los hijos de texto van por createTextNode: comentarios no se interpretan como HTML. */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  let selected = null;
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") el.className = value;
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "value" && (tag === "select" || tag === "textarea")) selected = value == null ? "" : String(value);
    else if (value != null && value !== false) el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  if (selected != null) el.value = selected;
  return el;
}

export function ratingComment(comment) {
  return h("span", { class: "ratings-comment" }, comment);
}
