/* gafa-sdk loader v1
 * URL pública (NO cambiar en los sitios):
 *   https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js
 * Este archivo es un puntero estable. El IIFE va en gafa-sdk.bundle*.js.
 * No rotar el nombre de la rama ni pedir a los socios que editen el src.
 */
(function () {
  if (typeof window === "undefined" || window.__GAFA_SDK_LOADER__) {
    return;
  }
  window.__GAFA_SDK_LOADER__ = true;

  var VERSION_URLS = [
    "https://raw.githubusercontent.com/GafaMX/GFtheme/cdn-live/docs/v2-sdk/VERSION.txt",
  ];
  var FALLBACK =
    "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.bundle.js";
  var anchor = typeof document !== "undefined" ? document.currentScript : null;

  function load(src) {
    if (!document) {
      return;
    }
    var s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(s, anchor.nextSibling);
    } else {
      (document.head || document.documentElement).appendChild(s);
    }
  }

  function parseBundle(text) {
    var bundle = /(?:^|\n)bundle=([A-Za-z0-9._-]+\.js)(?:\r?\n|$)/.exec(text);
    if (bundle) {
      return (
        "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/" + bundle[1]
      );
    }
    var commit = /(?:^|\n)commit=([0-9a-f]{7,40})(?:\r?\n|$)/.exec(text);
    if (commit) {
      return (
        "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@" +
        commit[1] +
        "/docs/v2-sdk/gafa-sdk.bundle.js"
      );
    }
    return null;
  }

  function tryVersion(i) {
    if (i >= VERSION_URLS.length) {
      load(FALLBACK);
      return;
    }
    fetch(VERSION_URLS[i], { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.text() : Promise.reject(new Error("version"));
      })
      .then(function (text) {
        var src = parseBundle(text);
        if (!src) {
          throw new Error("parse");
        }
        load(src);
      })
      .catch(function () {
        tryVersion(i + 1);
      });
  }

  tryVersion(0);
})();
