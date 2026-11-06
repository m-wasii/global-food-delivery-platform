/**
 * EAT-41 accept/reject API smoke against a running API + seeded DB.
 * Prerequisite: node --env-file=.env scripts/eat39-smoke-seed.mjs
 * Run: node --env-file=.env scripts/eat41-smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const pendingId = 'aa111111-1111-4111-8111-111111111111';
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
  // Node < fetch getSetCookie fallback via raw header
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

  const accept = await api('POST', `/orders/${pendingId}/transition`, {
    toStatus: 'CONFIRMED',
  });
  assert(
    accept.status === 200 || accept.status === 201,
    `accept failed: ${accept.status} ${JSON.stringify(accept.json)}`,
  );
  assert(accept.json?.status === 'CONFIRMED', `accept status=${accept.json?.status}`);
  console.log('ACCEPT ok -> CONFIRMED');

  reseed();
  const bad = await api('POST', `/orders/${pendingId}/transition`, {
    toStatus: 'REJECTED',
  });
  assert(bad.status >= 400, `reject without reason should fail, got ${bad.status}`);
  console.log(`REJECT_NO_REASON blocked (${bad.status})`);

  for (const code of ['OUT_OF_STOCK', 'TOO_BUSY', 'CLOSING_SOON', 'OTHER']) {
    reseed();
    const body = { toStatus: 'REJECTED', rejectReason: code };
    const expected = code === 'OTHER' ? 'OTHER: no chicken' : code;
    if (code === 'OTHER') body.reason = '  no chicken  ';

    const rej = await api('POST', `/orders/${pendingId}/transition`, body);
    assert(
      rej.status === 200 || rej.status === 201,
      `reject ${code} failed: ${rej.status} ${JSON.stringify(rej.json)}`,
    );
    assert(rej.json?.status === 'REJECTED', `reject ${code} status=${rej.json?.status}`);
    const hist = (rej.json?.history ?? []).find((h) => h.toStatus === 'REJECTED');
    assert(
      hist?.reason === expected,
      `reject ${code} history expected '${expected}' got '${hist?.reason}'`,
    );
    console.log(`REJECT ${code} ok (history=${hist.reason})`);
  }

  console.log('SMOKE_EAT41_PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
