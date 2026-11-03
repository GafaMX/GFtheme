'use strict';

/**
 * Node tests for the password-reset landing-link helper (no webpack).
 * Loads the ES-exported module by stripping `export` so we can require it.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const TOKEN = 'a1b2c3d4e5';
const FILE = path.join(__dirname, 'passwordResetLink.js');

function loadHelper(windowLike) {
    let src = fs.readFileSync(FILE, 'utf8');
    src = src.replace(/export function /g, 'function ');
    src = src.replace(/export var /g, 'var ');
    src = src.replace(/export \{[\s\S]*?\};?/g, '');
    src += `
module.exports = {
  parsePasswordResetLink,
  stripPasswordResetParams,
  passwordResetReturnUrl,
  readPasswordResetLink,
  hasPasswordResetLink,
  clearPasswordResetLink,
  capturePasswordResetLink,
  PASSWORD_RESET_STORAGE_KEY,
  PASSWORD_RESET_HASH_MARKER,
};
`;
    const storage = Object.create(null);
    const sessionStorage = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null),
        setItem: (k, v) => {
            storage[k] = String(v);
        },
        removeItem: (k) => {
            delete storage[k];
        },
    };

    const hrefState = windowLike || {
        origin: 'https://studio.mx',
        pathname: '/',
        search: '',
        hash: '',
        href: 'https://studio.mx/',
        protocol: 'https:',
        host: 'studio.mx',
    };

    function syncHref() {
        hrefState.href =
            (hrefState.origin || 'https://studio.mx') +
            (hrefState.pathname || '/') +
            (hrefState.search || '') +
            (hrefState.hash || '');
    }

    const history = {
        state: null,
        replaceState: function (_state, _title, url) {
            const parsed = new URL(url, hrefState.origin || 'https://studio.mx');
            hrefState.pathname = parsed.pathname;
            hrefState.search = parsed.search;
            hrefState.hash = parsed.hash;
            hrefState.origin = parsed.origin;
            hrefState.host = parsed.host;
            hrefState.protocol = parsed.protocol;
            syncHref();
        },
    };

    const sandbox = {
        module: {exports: {}},
        exports: {},
        console,
        sessionStorage,
        window: {
            location: hrefState,
            history,
            parent: null,
        },
        performance: {
            getEntriesByType: function (type) {
                if (type !== 'navigation') return [];
                return hrefState.navName ? [{name: hrefState.navName}] : [];
            },
        },
    };
    sandbox.window.parent = sandbox.window;
    sandbox.global = sandbox;
    const filename = FILE;
    sandbox.require = Module.createRequire(filename);
    vm.runInNewContext(src, sandbox, {filename});
    return {
        api: sandbox.module.exports,
        location: hrefState,
        sessionStorage,
        setUrl: function (url) {
            const parsed = new URL(url, hrefState.origin || 'https://studio.mx');
            hrefState.pathname = parsed.pathname;
            hrefState.search = parsed.search;
            hrefState.hash = parsed.hash;
            hrefState.origin = parsed.origin;
            hrefState.host = parsed.host;
            hrefState.protocol = parsed.protocol;
            syncHref();
        },
    };
}

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function parseCases() {
    const {api} = loadHelper();
    const parse = function (s) {
        return clone(api.parsePasswordResetLink(s));
    };

    assert.deepStrictEqual(parse('?token=' + TOKEN + '&email=ana@buq.mx'), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });

    assert.deepStrictEqual(parse('#horario?token=' + TOKEN + '&email=ana@buq.mx'), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });

    assert.deepStrictEqual(parse('?location=centro?token=' + TOKEN + '&email=ana@buq.mx'), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });

    assert.deepStrictEqual(
        parse('?location=centro#horario?token=' + TOKEN + '&email=ana@buq.mx'),
        {token: TOKEN, email: 'ana@buq.mx'}
    );

    assert.strictEqual(parse('?token=' + TOKEN + '&email=ana+1@buq.mx').email, 'ana+1@buq.mx');
    assert.strictEqual(parse('?token=' + TOKEN + '&email=ana%2B1%40buq.mx').email, 'ana+1@buq.mx');

    assert.deepStrictEqual(
        parse('?token=viejo&email=x@y.mx?token=' + TOKEN + '&email=ana@buq.mx'),
        {token: TOKEN, email: 'ana@buq.mx'}
    );

    assert.strictEqual(parse('?token=' + TOKEN), null);
    assert.strictEqual(parse('?email=ana@buq.mx'), null);
    assert.strictEqual(parse('?token=&email=ana@buq.mx'), null);
    assert.strictEqual(parse('?buq-env=staging&mytoken=1&email=a@b.mx'), null);
    assert.strictEqual(parse(''), null);

    assert.strictEqual(parse('?token=' + TOKEN + '&email=ana%E0@buq.mx').email, 'ana%E0@buq.mx');

    assert.deepStrictEqual(parse('#gafa-pw-reset?token=' + TOKEN + '&email=ana@buq.mx'), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });

    assert.deepStrictEqual(parse('?token=' + TOKEN + '&amp;email=ana@buq.mx'), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });

    assert.deepStrictEqual(parse('?TOKEN=' + TOKEN + '&EMAIL=ana@buq.mx'), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });

    assert.deepStrictEqual(
        parse('https://studio.mx/es/reservar%3Ftoken%3D' + TOKEN + '%26email%3Dana%40buq.mx'),
        {token: TOKEN, email: 'ana@buq.mx'}
    );

    assert.deepStrictEqual(parse('#/reset?token=' + TOKEN + '&email=ana@buq.mx'), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });
}

function stripCases() {
    const {api} = loadHelper();
    const strip = function (s) {
        return clone(api.stripPasswordResetParams(s));
    };

    assert.deepStrictEqual(strip('?token=' + TOKEN + '&email=a@b.mx'), {search: '', hash: ''});
    assert.deepStrictEqual(strip('?location=centro&token=' + TOKEN + '&email=a@b.mx'), {
        search: '?location=centro',
        hash: '',
    });
    assert.deepStrictEqual(strip('?location=centro?token=' + TOKEN + '&email=a@b.mx'), {
        search: '?location=centro',
        hash: '',
    });
    assert.deepStrictEqual(strip('#horario?token=' + TOKEN + '&email=a@b.mx'), {
        search: '',
        hash: '#horario',
    });
    assert.deepStrictEqual(strip('?brand=fitspin#horario?token=' + TOKEN + '&email=a@b.mx'), {
        search: '?brand=fitspin',
        hash: '#horario',
    });
    assert.deepStrictEqual(strip('#gafa-pw-reset?token=' + TOKEN + '&email=a@b.mx'), {
        search: '',
        hash: '',
    });
    assert.deepStrictEqual(strip('#token=' + TOKEN + '&email=a@b.mx'), {search: '', hash: ''});
}

function returnUrlCases() {
    const {api} = loadHelper();
    assert.strictEqual(
        api.passwordResetReturnUrl({origin: 'https://insight.mx', pathname: '/reservar'}),
        'https://insight.mx/reservar#gafa-pw-reset'
    );
    assert.strictEqual(
        api.passwordResetReturnUrl({
            origin: 'https://kinkin.mx',
            pathname: '/en/reservar',
            protocol: 'https:',
            host: 'kinkin.mx',
        }),
        'https://kinkin.mx/en/reservar#gafa-pw-reset'
    );
}

function windowHelpers() {
    const ctx = loadHelper();
    ctx.setUrl('/reservar?brand=fitspin#horario?token=' + TOKEN + '&email=ana@buq.mx');
    assert.deepStrictEqual(clone(ctx.api.readPasswordResetLink()), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });
    ctx.api.clearPasswordResetLink();
    assert.strictEqual(ctx.location.pathname + ctx.location.search + ctx.location.hash, '/reservar?brand=fitspin#horario');
    assert.strictEqual(ctx.api.readPasswordResetLink(), null);
}

function snapshotSurvivesRewrite() {
    const ctx = loadHelper();
    ctx.setUrl('/?token=' + TOKEN + '&email=ana@buq.mx');
    ctx.api.capturePasswordResetLink();
    // Weglot / TranslatePress / SPA already dropped the query.
    ctx.setUrl('/es/');
    assert.deepStrictEqual(clone(ctx.api.readPasswordResetLink()), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });
}

function navigationEntrySurvivesReplaceState() {
    const ctx = loadHelper();
    ctx.location.navName = 'https://studio.mx/reservar?token=' + TOKEN + '&email=ana@buq.mx';
    ctx.setUrl('/reservar');
    assert.deepStrictEqual(clone(ctx.api.readPasswordResetLink()), {
        token: TOKEN,
        email: 'ana@buq.mx',
    });
}

function plusNotSpaceFromUrlSearchParamsTrap() {
    const ctx = loadHelper();
    ctx.setUrl('/?token=' + TOKEN + '&email=ana+1@buq.mx');
    assert.strictEqual(ctx.api.readPasswordResetLink().email, 'ana+1@buq.mx');
}

parseCases();
stripCases();
returnUrlCases();
windowHelpers();
snapshotSurvivesRewrite();
navigationEntrySurvivesReplaceState();
plusNotSpaceFromUrlSearchParamsTrap();

console.log('passwordResetLink tests: ok');
