# AGENTS.md

## Cursor Cloud specific instructions

### What this is
`GFtheme` is a **frontend-only** bundle: React 16 + webpack 4 + Babel 6. It renders theme
components (login/register, calendars, combo/membership/service lists, purchase buttons) into
HTML containers marked with `data-gf-theme="..."`. There is no backend, no database, and no
automated test suite in this repo. Standard scripts live in `package.json` (`dev`, `watch`,
`build`, `start`).

### Running the dev server
- Do NOT use `npm start` in a headless VM: it passes `--open`, which tries to launch a browser
  and is unnecessary here. Instead run the dev server directly:
  `npx webpack-dev-server --mode development --hot --host 0.0.0.0 --port 8080`
  Then open `http://localhost:8080/`. Webpack live-reload/HMR is enabled and works.
- `npm run build` (webpack production) succeeds on the installed Node (v22), despite the old
  webpack 4 toolchain — no `--openssl-legacy-provider` workaround is needed.

### External backend dependency (expected console errors)
- The app requires a global `GafaFitSDK`, loaded via a `<script src=".../sdk/dist/main.js">` tag
  in `src/index.html`. That tag currently points at `http://buq-kinsta.local/` (a non-resolvable
  host). Without a reachable GAFAfit backend **and** valid API credentials
  (`GAFA_FIT_URL`, `COMPANY_ID`, `API_CLIENT`, `API_SECRET`, captcha keys) in the
  `data-gf-options` JSON block of `src/index.html`, the data-driven React components will not
  populate. The browser console will show `GafaFitSDK is not defined` and
  `ERR_NAME_NOT_RESOLVED`. This is expected in an isolated VM and is NOT an environment bug — the
  static theme HTML (header, red "Compra ..." buttons, calendar container) still renders fine.

### Files / gotchas
- `src/index.html` is gitignored but present on disk; it is the webpack HTML template and the
  place to edit API options / the SDK `<script>` URL for local testing.
- `dist/main.min.js` IS tracked in git and `npm run build` overwrites it. Revert it
  (`git checkout -- dist/main.min.js`) if you only built to test and don't intend to commit a
  new bundle.
- There is no linter configured, and `npm test` is a placeholder that just errors — do not treat
  its failure as a real test failure.
