/**
 * EAT-44 kitchen timing smoke against a running API + seeded DB.
 * Prerequisite: API on :3001 with DATABASE_URL.
 * Run: node --env-file=.env scripts/eat44-smoke.mjs
 *
 * Covers: accept / prep / ready timestamps on GET + transition;
 * rejection timestamp on reject path.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const pendingId = 'aa111111-1111-4111-8111-111111111111';
const confirmedId = 'aa222222-2222-4222-8222-222222222222';
const restaurantId = 'c1111111-1111-4111-8111-111111111111';
const cookieJar = { value: '' };

function reseed() {
  const result = spawnSync(
    process.execPath,
    ['--env-file=.env', 'scripts/eat39-smoke-seed.mjs'],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`reseed failed: ${result.stderr || result.stdout}`);
  }
}

async function api(method, pathname, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieJar.value) headers.Cookie = cookieJar.value;
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const raw of setCookie) {
    const pair = raw.split(';')[0];
    if (pair.startsWith('session=')) cookieJar.value = pair;
  }
  if (!cookieJar.value) {
    const single = res.headers.get('set-cookie');
    if (single?.startsWith('session=')) {
      cookieJar.value = single.split(';')[0];
    }
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertIso(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} missing`);
  assert(!Number.isNaN(Date.parse(value)), `${label} not ISO: ${value}`);
}

async function login() {
  const res = await api('POST', '/auth/login', {
    email: 'owner.smoke@eatwave.test',
    password: 'SmokeTest1!',
    rememberMe: true,
  });
  assert(
    res.status === 200 || res.status === 201,
    `login failed: ${res.status} ${JSON.stringify(res.json)}`,
  );
  assert(cookieJar.value.startsWith('session='), 'missing session cookie');
}

async function main() {
  reseed();
  await login();
  console.log('LOGIN ok');

  const accept = await api('POST', `/orders/${pendingId}/transition`, {
    toStatus: 'CONFIRMED',
  });
  assert(
    accept.status === 200 || accept.status === 201,
    `accept failed: ${accept.status} ${JSON.stringify(accept.json)}`,
  );
  assertIso(accept.json?.timing?.acceptedAt, 'accept.timing.acceptedAt');
  assert(accept.json?.timing?.rejectedAt == null, 'accept should not set rejectedAt');
  console.log(`ACCEPT timing.acceptedAt=${accept.json.timing.acceptedAt}`);

  const prep = await api('POST', `/orders/${pendingId}/transition`, {
    toStatus: 'PREPARING',
  });
  assert(
    prep.status === 200 || prep.status === 201,
    `prep failed: ${prep.status} ${JSON.stringify(prep.json)}`,
  );
  assertIso(prep.json?.timing?.acceptedAt, 'prep.timing.acceptedAt');
  assertIso(prep.json?.timing?.preparingAt, 'prep.timing.preparingAt');
  console.log(`PREP timing.preparingAt=${prep.json.timing.preparingAt}`);

  const ready = await api('POST', `/orders/${pendingId}/transition`, {
    toStatus: 'READY',
  });
  assert(
    ready.status === 200 || ready.status === 201,
    `ready failed: ${ready.status} ${JSON.stringify(ready.json)}`,
  );
  assertIso(ready.json?.timing?.readyAt, 'ready.timing.readyAt');
  console.log(`READY timing.readyAt=${ready.json.timing.readyAt}`);

  const detail = await api('GET', `/orders/${pendingId}`);
  assert(
    detail.status === 200,
    `getOrder failed: ${detail.status} ${JSON.stringify(detail.json)}`,
  );
  assertIso(detail.json?.timing?.acceptedAt, 'get.timing.acceptedAt');
  assertIso(detail.json?.timing?.preparingAt, 'get.timing.preparingAt');
  assertIso(detail.json?.timing?.readyAt, 'get.timing.readyAt');
  console.log('GET /orders/:id timing ok');

  const listReady = await api(
    'GET',
    `/partner/orders?restaurantId=${restaurantId}&status=READY`,
  );
  assert(
    listReady.status === 200,
    `partner list failed: ${listReady.status} ${JSON.stringify(listReady.json)}`,
  );
  const listedReady = (listReady.json?.orders ?? []).find((o) => o.id === pendingId);
  assert(listedReady, 'READY order missing from partner list');
  assertIso(listedReady.timing?.acceptedAt, 'list.timing.acceptedAt');
  assertIso(listedReady.timing?.preparingAt, 'list.timing.preparingAt');
  assertIso(listedReady.timing?.readyAt, 'list.timing.readyAt');
  console.log('GET /partner/orders timing ok (READY)');

  reseed();
  cookieJar.value = '';
  await login();

  const reject = await api('POST', `/orders/${pendingId}/transition`, {
    toStatus: 'REJECTED',
    rejectReason: 'TOO_BUSY',
  });
  assert(
    reject.status === 200 || reject.status === 201,
    `reject failed: ${reject.status} ${JSON.stringify(reject.json)}`,
  );
  assertIso(reject.json?.timing?.rejectedAt, 'reject.timing.rejectedAt');
  assert(reject.json?.timing?.acceptedAt == null, 'reject should not set acceptedAt');
  console.log(`REJECT timing.rejectedAt=${reject.json.timing.rejectedAt}`);

  const listRejected = await api(
    'GET',
    `/partner/orders?restaurantId=${restaurantId}&status=REJECTED`,
  );
  assert(
    listRejected.status === 200,
    `partner reject list failed: ${listRejected.status} ${JSON.stringify(listRejected.json)}`,
  );
  const listedRejected = (listRejected.json?.orders ?? []).find((o) => o.id === pendingId);
  assert(listedRejected, 'REJECTED order missing from partner list');
  assertIso(listedRejected.timing?.rejectedAt, 'list.timing.rejectedAt');
  console.log('GET /partner/orders timing ok (REJECTED)');

  // Seeded CONFIRMED order already has acceptedAt from history.
  const confirmed = await api('GET', `/orders/${confirmedId}`);
  assert(
    confirmed.status === 200,
    `confirmed get failed: ${confirmed.status} ${JSON.stringify(confirmed.json)}`,
  );
  assertIso(confirmed.json?.timing?.acceptedAt, 'confirmed.timing.acceptedAt');
  console.log(`SEEDED confirmed timing.acceptedAt=${confirmed.json.timing.acceptedAt}`);

  console.log('SMOKE_EAT44_PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
