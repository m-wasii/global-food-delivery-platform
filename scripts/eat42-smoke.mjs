/**
 * EAT-42 preparation workflow smoke against a running API + seeded DB.
 * Prerequisite: node --env-file=.env scripts/eat39-smoke-seed.mjs
 * Run: node --env-file=.env scripts/eat42-smoke.mjs
 *
 * Happy path: CONFIRMED → PREPARING → READY → COMPLETED
 * Plus invalid skip (CONFIRMED → READY) must be rejected.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const confirmedId = 'aa222222-2222-4222-8222-222222222222';
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

async function transition(orderId, toStatus) {
  return api('POST', `/orders/${orderId}/transition`, { toStatus });
}

async function main() {
  reseed();

  const login = await api('POST', '/auth/login', {
    email: 'owner.smoke@eatwave.test',
    password: 'SmokeTest1!',
    rememberMe: true,
  });
  assert(
    login.status === 200 || login.status === 201,
    `login failed: ${login.status} ${JSON.stringify(login.json)}`,
  );
  assert(cookieJar.value.startsWith('session='), 'missing session cookie');
  console.log('LOGIN ok');

  const skip = await transition(confirmedId, 'READY');
  assert(
    skip.status >= 400,
    `CONFIRMED→READY should be rejected, got ${skip.status} ${JSON.stringify(skip.json)}`,
  );
  console.log(`SKIP_BLOCKED CONFIRMED→READY (${skip.status})`);

  const prep = await transition(confirmedId, 'PREPARING');
  assert(
    prep.status === 200 || prep.status === 201,
    `PREPARING failed: ${prep.status} ${JSON.stringify(prep.json)}`,
  );
  assert(prep.json?.status === 'PREPARING', `status=${prep.json?.status}`);
  console.log('PREPARING ok');

  const ready = await transition(confirmedId, 'READY');
  assert(
    ready.status === 200 || ready.status === 201,
    `READY failed: ${ready.status} ${JSON.stringify(ready.json)}`,
  );
  assert(ready.json?.status === 'READY', `status=${ready.json?.status}`);
  console.log('READY ok');

  const done = await transition(confirmedId, 'COMPLETED');
  assert(
    done.status === 200 || done.status === 201,
    `COMPLETED failed: ${done.status} ${JSON.stringify(done.json)}`,
  );
  assert(done.json?.status === 'COMPLETED', `status=${done.json?.status}`);
  console.log('COMPLETED ok');

  const history = done.json?.history ?? [];
  for (const step of [
    ['CONFIRMED', 'PREPARING'],
    ['PREPARING', 'READY'],
    ['READY', 'COMPLETED'],
  ]) {
    const [fromStatus, toStatus] = step;
    const hit = history.find(
      (h) => h.fromStatus === fromStatus && h.toStatus === toStatus,
    );
    assert(hit, `missing history ${fromStatus}→${toStatus}`);
  }
  console.log('HISTORY ok (prep chain)');

  console.log('SMOKE_EAT42_PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
