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

  var RAW_VERSION =
    "https://raw.githubusercontent.com/GafaMX/GFtheme/cdn-live/docs/v2-sdk/VERSION.txt";
  var GITHUB_TIP = "https://api.github.com/repos/GafaMX/GFtheme/commits/cdn-live";
  var FALLBACK =
    "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.bundle.js";
  var anchor = typeof document !== "undefined" ? document.currentScript : null;
  var queue = [];
  var loading = false;

  function insert(src, onerror) {
    if (!document) {
      return;
    }
    var s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    if (onerror) {
      s.onerror = onerror;
    }
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(s, anchor.nextSibling);
    } else {
      (document.head || document.documentElement).appendChild(s);
    }
  }

  function loadNext() {
    if (loading) {
      return;
    }
    var src = queue.shift();
    if (!src) {
      return;
    }
    loading = true;
    insert(src, function () {
      loading = false;
      loadNext();
    });
  }

  function enqueue(src) {
    if (!src || queue.indexOf(src) !== -1) {
      return;
    }
    queue.push(src);
    loadNext();
  }

  function parseBundle(text) {
    var bundle = /(?:^|\n)bundle=([A-Za-z0-9._-]+\.js)(?:\r?\n|$)/.exec(text);
    if (!bundle) {
      return null;
    }
    return (
      "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/" + bundle[1]
    );
  }

  function tipBundle() {
    var cached = null;
    try {
      cached = sessionStorage.getItem("gafa-sdk-cdn-sha");
    } catch (e) {}
    if (cached) {
      enqueue(
        "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@" +
          cached +
          "/docs/v2-sdk/gafa-sdk.bundle.js",
      );
      enqueue(FALLBACK);
      return;
    }
    fetch(GITHUB_TIP, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github.sha" },
    })
      .then(function (r) {
        return r.ok ? r.text() : Promise.reject(new Error("tip"));
      })
      .then(function (sha) {
        sha = String(sha).replace(/\s+/g, "");
        if (!/^[0-9a-f]{7,40}$/.test(sha)) {
          throw new Error("sha");
        }
        try {
          sessionStorage.setItem("gafa-sdk-cdn-sha", sha);
        } catch (e2) {}
        enqueue(
          "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@" +
            sha +
            "/docs/v2-sdk/gafa-sdk.bundle.js",
        );
        enqueue(FALLBACK);
      })
      .catch(function () {
        enqueue(FALLBACK);
      });
  }

  fetch(RAW_VERSION, { cache: "no-store" })
    .then(function (r) {
      return r.ok ? r.text() : Promise.reject(new Error("version"));
    })
    .then(function (text) {
      var src = parseBundle(text);
      if (src) {
        enqueue(src);
      }
      tipBundle();
    })
    .catch(function () {
      tipBundle();
    });
})();
