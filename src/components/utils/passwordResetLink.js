'use strict';

/**
 * Link del correo de "olvidé mi contraseña".
 *
 * gafa.fit (PostmarkUserResetPassword.php) pega `?token=…&email=…` al
 * `return_url` tal cual: no mira si ya hay `?` o `#`, y no codifica el email.
 *
 * Fallos que esto cubre:
 *  - `#horario?token=` / doble `?` (el backend concatena a ciegas)
 *  - `ana+1@x.com` leído como espacio por URLSearchParams
 *  - `&amp;email=` (HTML doble-encode en el mail)
 *  - TOKEN/EMAIL en mayúsculas
 *  - query encoded en el path (`%3Ftoken=`)
 *  - Weglot / TranslatePress / WPML: redirect HTTP que tira el `?query`
 *    (el fragmento `#` NO se manda al server, así que sobrevive)
 *  - el SDK carga async / al final del body: Weglot o el SPA ya limpiaron
 *    location; se lee el snapshot de sessionStorage y PerformanceNavigation
 *  - iframe same-origin (params en el padre)
 */

export var PASSWORD_RESET_HASH_MARKER = 'gafa-pw-reset';
export var PASSWORD_RESET_STORAGE_KEY = 'gafa-sdk-password-reset-link';

function paramRe() {
    return /([?&#])(token|email)=([^&#?]*)/gi;
}

function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    } catch (err) {
        return value;
    }
}

function normalizeBlob(searchAndHash) {
    if (searchAndHash == null) {
        return '';
    }
    var normalized = String(searchAndHash).replace(/&amp;/gi, '&');
    // `?token=` encoded into the path: %3Ftoken%3D…%26email%3D
    if (/%3[Ff]/i.test(normalized) || /%26(?:amp;)?/i.test(normalized) || /%(?:token|email)/i.test(normalized)) {
        try {
            normalized = decodeURIComponent(normalized);
        } catch (err) {
            // encoding roto: se parsea tal cual
        }
        normalized = normalized.replace(/&amp;/gi, '&');
    }
    return normalized;
}

/** Lee `token` + `email` de search/hash/href, aunque el link venga mal armado. */
export function parsePasswordResetLink(searchAndHash) {
    var normalized = normalizeBlob(searchAndHash);
    if (!normalized) {
        return null;
    }
    var token = '';
    var email = '';
    var match;
    var PARAM = paramRe();
    while ((match = PARAM.exec(normalized))) {
        var key = match[2].toLowerCase();
        // `+` es literal: gafa.fit no codifica el email (ana+1@x.com).
        var value = safeDecode(match[3]).trim();
        if (!value) {
            continue;
        }
        if (key === 'token') {
            token = value;
        } else {
            email = value;
        }
    }
    return token && email ? {token: token, email: email} : null;
}

function stripHashMarker(hash) {
    if (!hash) {
        return '';
    }
    var marker = PASSWORD_RESET_HASH_MARKER;
    var cleaned = hash
        .replace(new RegExp('#' + marker + '(?=[?&]|$)'), '#')
        .replace(new RegExp('/' + marker + '(?=[?&]|$)'), '/')
        .replace(/^#[?&]+/, '#');
    if (cleaned === '#' || cleaned === '#/' || cleaned === '') {
        return '';
    }
    return cleaned;
}

/** Quita `token` / `email` de `search + hash` y deja el resto bien armado. */
export function stripPasswordResetParams(searchAndHash) {
    var normalized = normalizeBlob(searchAndHash);
    var hashAt = normalized.indexOf('#');
    var search = hashAt === -1 ? normalized : normalized.slice(0, hashAt);
    var hash = hashAt === -1 ? '' : normalized.slice(hashAt);

    search = search.replace(paramRe(), '').replace(/^[?&]+/, '');
    search = search ? '?' + search : '';

    hash = hash.replace(/^#(token|email)=[^&#?]*/i, '#').replace(/([?&])(token|email)=[^&#?]*/gi, '');
    hash = stripHashMarker(hash);

    return {search: search, hash: hash};
}

function addCandidate(out, value) {
    if (!value || out.indexOf(value) !== -1) {
        return;
    }
    out.push(value);
}

function liveLocationBlobs() {
    var out = [];
    if (typeof window === 'undefined' || !window.location) {
        return out;
    }
    addCandidate(out, window.location.search + window.location.hash);
    addCandidate(out, window.location.href);
    try {
        addCandidate(out, decodeURIComponent(window.location.href));
    } catch (err) {
        // ignore
    }
    try {
        if (typeof performance !== 'undefined' && performance.getEntriesByType) {
            var entries = performance.getEntriesByType('navigation');
            var nav = entries && entries[0];
            if (nav && nav.name) {
                addCandidate(out, nav.name);
                try {
                    addCandidate(out, decodeURIComponent(nav.name));
                } catch (err2) {
                    // ignore
                }
            }
        }
    } catch (err3) {
        // ignore
    }
    try {
        if (window.parent && window.parent !== window && window.parent.location) {
            addCandidate(out, window.parent.location.search + window.parent.location.hash);
            addCandidate(out, window.parent.location.href);
        }
    } catch (err4) {
        // iframe cruzado: no se puede leer el padre
    }
    return out;
}

function storedBlob() {
    try {
        if (typeof sessionStorage === 'undefined') {
            return '';
        }
        return sessionStorage.getItem(PASSWORD_RESET_STORAGE_KEY) || '';
    } catch (err) {
        return '';
    }
}

function persistBlob(raw) {
    try {
        if (typeof sessionStorage === 'undefined' || !raw) {
            return;
        }
        sessionStorage.setItem(PASSWORD_RESET_STORAGE_KEY, raw);
    } catch (err) {
        // Safari privado u origen opaco
    }
}

/**
 * Toma token/email YA, antes de que Weglot/SPA/caching reescriban la URL.
 * Llamar en cuanto corre el script (no esperar al API ni a React).
 */
export function capturePasswordResetLink() {
    var live = liveLocationBlobs();
    for (var i = 0; i < live.length; i++) {
        if (parsePasswordResetLink(live[i])) {
            persistBlob(live[i]);
            return parsePasswordResetLink(live[i]);
        }
    }
    return parsePasswordResetLink(storedBlob());
}

export function readPasswordResetLink() {
    var captured = capturePasswordResetLink();
    if (captured) {
        return captured;
    }
    return parsePasswordResetLink(storedBlob());
}

export function hasPasswordResetLink() {
    return readPasswordResetLink() !== null;
}

export function clearPasswordResetLink() {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(PASSWORD_RESET_STORAGE_KEY);
        }
    } catch (err) {
        // ignore
    }
    if (typeof window === 'undefined' || !window.location || !window.history) {
        return;
    }
    var stripped = stripPasswordResetParams(window.location.search + window.location.hash);
    try {
        window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname + stripped.search + stripped.hash
        );
    } catch (err2) {
        // ignore
    }
}

/**
 * `return_url` para `/api/password/email`.
 *
 * gafa.fit concatena `?token=&email=` sin mirar. Si mandamos origin+pathname
 * (query), Weglot/TranslatePress/WPML redirigen `/en/` y se comen el `?`.
 * El `#` no viaja al server: `#gafa-pw-reset` + `?token=` queda
 * `#gafa-pw-reset?token=&email=` y sobrevive el redirect.
 */
export function passwordResetReturnUrl(locationLike) {
    var loc = locationLike;
    if (!loc) {
        if (typeof window === 'undefined') {
            return '';
        }
        loc = window.location;
    }
    var origin = loc.origin;
    if (!origin && loc.protocol && loc.host) {
        origin = loc.protocol + '//' + loc.host;
    }
    if (!origin) {
        return '';
    }
    var pathname = loc.pathname || '/';
    return origin + pathname + '#' + PASSWORD_RESET_HASH_MARKER;
}
