/** Local browser regression against a supplied, unmodified Stripe payment IIFE.
 * node tests/stripe-original.browser.mjs /path/to/stripe-payment.iife.js
 * All OAuth, payment, registration and Stripe operations are simulated. No charges.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { rolldown } from 'rolldown';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const original = await readFile(process.argv[2], 'utf8');
const scratch = await mkdtemp(join(tmpdir(), 'gft-stripe-browser-'));
try {
  await writeFile(join(scratch, 'entry.ts'), `export * from ${JSON.stringify(join(root, 'src/sdk/payments/gafaPay.ts'))};
export { stripeSessionStatus, STRIPE_SESSION_PROGRESS_EVENT } from ${JSON.stringify(join(root, 'src/sdk/payments/stripeSessionGuard.ts'))};`);
  const bundle = await rolldown({ input: join(scratch, 'entry.ts') });
  await bundle.write({ file: join(scratch, 'sdk.mjs'), format: 'esm' });
  await bundle.close();
  await writeFile(join(scratch, 'original.js'), original);
  await writeFile(join(scratch, 'test.html'), `<!doctype html><html><head>
<link rel="stylesheet" href="${pathToFileURL(join(root, 'src/sdk/widgets/widgets.css'))}">
</head><body><div class="gafa-sdk"><div id="panel" class="gafa-checkout-paymount" data-method="stripe" data-state="loading"><div id="box" class="gafa-checkout-paymount__island"></div></div></div><pre id="result">pending</pre>
<script>
const fixture = window.fixture = { calls: [], providers: [], registered: [], confirms: [], secret: '', version: 0, instances: 0, requestDelay: 5, registrationDelay: 5, mountDelay: 0 };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
window.fetch = async (input, init) => {
  const url = String(input);
  const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  if (url.endsWith('/token')) return json([{ access_token: 'fixture' }]);
  if (url.endsWith('stripe.credentials')) return json({ current_environment: 'dev', development: { api_key: 'pk_test_fixture' } });
  const path = url.split('stripe.')[1];
  const body = JSON.parse(init.body);
  fixture.calls.push({ path, body });
  if (path === 'completeinitialpayment') return json({ message: 'done' });
  const secret = fixture.secret = 'secret_' + (++fixture.version);
  const hold = fixture.holdNextUpdate && path === 'updateinitialpayment';
  if (hold) { fixture.holdNextUpdate = false; await new Promise(resolve => { fixture.releaseUpdate = resolve; }); }
  await sleep(fixture.requestDelay);
  return json({ message: 'same_token', client_secret: secret });
};
window.Stripe = Object.assign(() => { fixture.instances++; return ({
  elements() {}, createToken() {}, createPaymentMethod() {}, confirmCardPayment() {},
  initCheckoutElementsSdk({ clientSecret }) {
    fixture.providers.push(clientSecret);
    return {
      on() {},
      async loadActions() {
        await sleep(10);
        return clientSecret === fixture.secret ? { type: 'success', actions: {
          getSession: () => ({ canConfirm: true }),
          async confirm() { fixture.confirms.push(clientSecret); return { type: 'success', session: { id: 'fixture', recurring: null } }; },
        } } : { type: 'error', error: { message: 'superseded session' } };
      },
      createPaymentElement() {
        let frame, ready;
        return {
          on(name, callback) { if (name === 'ready') ready = callback; }, off() {}, update() {},
          mount(node) {
            frame = document.createElement('iframe'); frame.name = 'elements-inner-payment';
            frame.style.cssText = 'display:block;width:100%;height:180px;border:0';
            setTimeout(() => { node.appendChild(frame); if (ready) ready(); }, fixture.mountDelay);
          },
          destroy() { if (frame) frame.remove(); },
        };
      },
    };
  },
}); }, { version: 'dahlia' });
</script>
<script type="module">
import * as sdk from './sdk.mjs';
const panel = document.querySelector('#panel'), box = document.querySelector('#box');
const result = document.querySelector('#result');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async predicate => { for (let i=0; i<20000; i++) { if (predicate()) return; await sleep(10); } throw new Error('wait timeout'); };
let runtime;
const checkout = { recurringPayment: true };
let island, holdRegistration = false, releaseRegistration;
const surfaces = [];
const purchase = async data => {
  fixture.registered.push(data.client_secret);
  if (holdRegistration) await new Promise(resolve => { releaseRegistration = resolve; });
  await sleep(fixture.registrationDelay);
};
box.addEventListener(sdk.STRIPE_SESSION_PROGRESS_EVENT, () => {
  const status = sdk.stripeSessionStatus(box);
  if (status?.ready) panel.dataset.state = 'ready';
  else if (status?.phase === 'error') panel.dataset.state = 'error';
});
function mount(quantity) {
  if (island) island.unmount();
  panel.dataset.state = 'loading';
  island = sdk.mountGafaPayWidget(runtime, box, 'stripe', {
    order: { customerName: 'Ana', customerEmail: 'ana@example.test', currency: 'mxn', lineItems: [{ name: 'Membership', quantity, unitPrice: 90 }] },
    apiUrl: 'https://fixture.invalid', clientId: 'fixture', clientSecret: 'fixture', generalData: {},
    hasRecurringPayment: checkout.recurringPayment, paymentFrequency: checkout.recurringPayment ? '30' : null,
    termsAndConditions: true, stripeCheckoutState: checkout,
    onCheckoutOpenAction: purchase, onInitialPaymentUpdated: purchase,
    onStartPayAction() {}, onGafaPaySuccessAction() {}, onGafaPayErrAction(error) { fixture.error = error.message; },
  });
}
async function ready() {
  await sdk.waitForWidgetContent(box, 2000, { requireIframe: true, hideIifeLoading: true });
  panel.dataset.state = 'ready'; await sleep(20);
  const frames = box.querySelectorAll('iframe[name="elements-inner-payment"]');
  assert(frames.length === 1, 'exactly one Payment Element');
  const frame = frames[0], rect = frame.getBoundingClientRect();
  assert(frame.isConnected && rect.height > 50 && rect.width > 50, 'Payment Element with real dimensions');
  for (let ancestor = frame; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
    assert(style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && bounds.height > 0 && bounds.width > 0, 'visible frame and ancestor: ' + ancestor.className);
  }
  assert(fixture.providers.at(-1) === fixture.secret, 'latest secret mounted');
  surfaces.push({ height: rect.height, secret: fixture.secret });
}
try {
  // A1: price/coupon exists before script evaluation, OAuth and the first process.
  assert(!customElements.get('stripe-payment-element'), 'IIFE has not loaded');
  runtime = await sdk.loadGafaPay({ method: 'stripe', clientId: 'fixture', clientSecret: 'fixture', scriptUrl: new URL('./original.js', location.href).href });
  assert(customElements.get('stripe-payment-element'), 'IIFE loaded without awaiting a consumer');
  mount(1); await ready();
  assert(fixture.calls.find(call => call.path === 'processinitialpayment').body.lineItems[0].unitPrice === 90, 'first process uses early coupon price');
  box.querySelector('input[type="checkbox"]').click(); await sleep(100);
  assert(checkout.saveCard === true, 'saveCard persisted');
  checkout.recurringPayment = false;
  for (let repeat=0; repeat<5; repeat++) for (const quantity of [1,2,1]) { mount(quantity); await ready(); }
  holdRegistration = true;
  sdk.notifyStripeDiscountAdded({ checkout_token: 'same_token', client_secret: 'coupon_seed' });
  assert(!await sdk.triggerGafaPayConfirm('stripe', box), 'blocked during coupon preparation');
  const before = fixture.calls.filter(call => call.path === 'completeinitialpayment').length;
  const blocked = await fetch('https://fixture.invalid/api/stripe.completeinitialpayment', { method: 'POST', body: JSON.stringify({ tokenInput: 'same_token' }) });
  assert(blocked.status === 409, 'complete cannot bypass preparation');
  assert(fixture.calls.filter(call => call.path === 'completeinitialpayment').length === before, 'blocked complete never reached network');
  await until(() => releaseRegistration);
  holdRegistration = false; releaseRegistration(); await ready();
  fixture.holdNextUpdate = true;
  mount(1); await until(() => fixture.releaseUpdate);
  sdk.notifyStripeDiscountAdded({ checkout_token: 'same_token', client_secret: 'bootstrap_coupon_seed' });
  assert(!sdk.stripeSessionStatus(box)?.ready, 'new revision waits for old server write');
  fixture.releaseUpdate(); await ready(); await sleep(50);
  assert(box.querySelectorAll('iframe').length === 1, 'late bootstrap cannot replace current form');
  assert(checkout.saveCard === true, 'coupon and remount preserved saveCard');
  // A2: each network/registration step progresses within 30s; the chain exceeds
  // the old 9s budget. A late current Stripe mount recovers the SAME visible node.
  fixture.requestDelay = 6000; fixture.registrationDelay = 6000; fixture.mountDelay = 65000;
  mount(2);
  let expired = false;
  try { await sdk.waitForWidgetContent(box, 9000, { requireIframe: true, hideIifeLoading: true }); }
  catch { expired = true; panel.dataset.state = 'error'; }
  assert(expired && sdk.stripeSessionStatus(box)?.phase === 'ready', 'visual deadline never authorizes payment');
  assert(!await sdk.triggerGafaPayConfirm('stripe', box), 'late form remains gated');
  await until(() => sdk.stripeSessionStatus(box)?.ready); await ready();
  assert(panel.dataset.state === 'ready', 'late ready removes visual error');
  fixture.requestDelay = 5; fixture.registrationDelay = 5; fixture.mountDelay = 0;
  mount(1); await ready();
  assert(fixture.instances === 1, 'one Stripe instance for the publishable key');
  assert(await sdk.triggerGafaPayConfirm('stripe', box), 'one explicit payment'); await sleep(50);
  assert(fixture.confirms.length === 1 && fixture.confirms[0] === fixture.secret, 'one confirmation with final secret');
  const complete = fixture.calls.filter(call => call.path === 'completeinitialpayment');
  assert(complete.length === 1 && complete[0].body.saveCard === true && complete[0].body.recurringPayment === false && complete[0].body.paymentFrequency === null, 'single final complete preserves choices');
  result.textContent = btoa(JSON.stringify({ ok: true, cartCycles: 5, instances: fixture.instances, lateMountRecovered: true, surfaces, confirms: fixture.confirms, complete: complete.length }));
  island.unmount();
} catch (error) { result.textContent = btoa(JSON.stringify({ ok: false, error: String(error), fixture, html: box.innerHTML })); }
</script></body></html>`);
  const browser = spawnSync(process.env.CHROME_BIN || 'google-chrome', [
    '--headless', '--no-sandbox', '--disable-crash-reporter', '--disable-breakpad', '--disable-dev-shm-usage', '--allow-file-access-from-files',
    ...(process.env.CHROME_SINGLE_PROCESS === '1' ? ['--no-zygote', '--single-process'] : []),
    '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${join(scratch, 'chrome')}`, '--virtual-time-budget=300000', '--dump-dom', pathToFileURL(join(scratch, 'test.html')).href,
  ], { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(browser.status, 0, browser.stderr);
  const encoded = browser.stdout.match(/<pre id="result">([^<]+)<\/pre>/)?.[1];
  assert(encoded && encoded !== 'pending', `Browser did not complete: ${browser.stderr}`);
  const report = JSON.parse(Buffer.from(encoded, 'base64').toString());
  console.log(JSON.stringify(report, null, 2));
  assert.equal(report.ok, true);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
