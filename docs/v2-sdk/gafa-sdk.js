/* gafa-sdk loader v1
 * URL pública (NO cambiar en los sitios):
 *   https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js
 * Este archivo es un puntero estable. El IIFE va en gafa-sdk.bundle*.js.
 * No rotar el nombre de la rama ni pedir a los socios que editen el src.
 */
(function () {
  // BEFORE the async bundle fetch: Weglot / TranslatePress / SPA routers
  // rewrite location while VERSION.txt is in flight. Snapshot token+email
  // (query, hash, or encoded path) so the SDK still opens the popup.
  try {
    var KEY = "gafa-sdk-password-reset-link";
    function looksLikeReset(s) {
      if (!s) return false;
      var n = String(s).replace(/&amp;/gi, "&");
      try {
        n = decodeURIComponent(n);
      } catch (e) {}
      return /[?&#]token=/i.test(n) && /[?&#]email=/i.test(n);
    }
    function saveIfReset(s) {
      if (!looksLikeReset(s)) return;
      sessionStorage.setItem(KEY, s);
    }
    if (typeof window !== "undefined" && window.location) {
      saveIfReset((window.location.search || "") + (window.location.hash || ""));
      saveIfReset(window.location.href);
      try {
        var nav = performance.getEntriesByType("navigation")[0];
        if (nav && nav.name) saveIfReset(nav.name);
      } catch (e2) {}
    }
  } catch (e3) {}

  if (typeof window === "undefined" || window.__GAFA_SDK_LOADER__) {
    return;
  }
  window.__GAFA_SDK_LOADER__ = true;

  // Production sites keep @cdn-live. If this file itself is loaded from
  // @staging (or a SHA), follow that ref so QA does not silently pull live.
  var DEFAULT_REF = "cdn-live";
  var anchor = typeof document !== "undefined" ? document.currentScript : null;
  function detectRef() {
    try {
      var src = (anchor && anchor.src) || "";
      var m = /cdn\.jsdelivr\.net\/gh\/GafaMX\/GFtheme@([^/?#]+)/i.exec(src);
      if (m && m[1]) {
        var ref = decodeURIComponent(m[1]);
        if (ref && ref !== "v2") {
          return ref;
        }
      }
    } catch (e) {}
    return DEFAULT_REF;
  }
  var REF = detectRef();
  var RAW_VERSION =
    "https://raw.githubusercontent.com/GafaMX/GFtheme/" + REF + "/docs/v2-sdk/VERSION.txt";
  var GITHUB_TIP = "https://api.github.com/repos/GafaMX/GFtheme/commits/" + REF;
  var FALLBACK =
    "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@" + REF + "/docs/v2-sdk/gafa-sdk.bundle.js";
  var SHA_KEY = "gafa-sdk-cdn-sha:" + REF;
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
      "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@" + REF + "/docs/v2-sdk/" + bundle[1]
    );
  }

  function tipBundle() {
    var cached = null;
    try {
      cached = sessionStorage.getItem(SHA_KEY);
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
          sessionStorage.setItem(SHA_KEY, sha);
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
        return;
      }
      tipBundle();
    })
    .catch(function () {
      tipBundle();
    });
})();
