'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchBranches,
  fetchMe,
  fetchMyRestaurants,
  hasPartnerCapability,
  login,
  logout,
  partnerPath,
} from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function redirectIfPartner() {
      const user = await fetchMe();
      if (!user || !hasPartnerCapability(user)) return;

      const memberships = await fetchMyRestaurants();
      const first = memberships[0];
      if (!first) return;
      const branches = await fetchBranches(first.restaurant.id);
      const branch = branches[0];
      if (!branch) return;
      router.replace(partnerPath(first.restaurant.id, branch.id, 'orders'));
    }
    void redirectIfPartner();
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setMessage('');

    const result = await login(email, password, rememberMe);
    if (!result.ok) {
      setStatus('error');
      setMessage(result.message);
      return;
    }

    const user = await fetchMe();
    if (!user || !hasPartnerCapability(user)) {
      await logout();
      setStatus('error');
      setMessage(
        'This account is not a restaurant partner. Sign in with an OWNER/STAFF membership account.',
      );
      return;
    }

    const memberships = await fetchMyRestaurants();
    const first = memberships[0];
    if (!first) {
      setStatus('error');
      setMessage('Partner account has no restaurant memberships yet.');
      return;
    }

    const branches = await fetchBranches(first.restaurant.id);
    const branch = branches[0];
    if (!branch) {
      setStatus('error');
      setMessage(`Restaurant “${first.restaurant.name}” has no branches yet.`);
      return;
    }

    router.replace(partnerPath(first.restaurant.id, branch.id, 'orders'));
  }

  return (
    <main>
      <h1>EatWave Partner</h1>
      <p>Sign in with a restaurant OWNER or STAFF account.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <br />
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={status === 'submitting'}
        />
        <br />
        <label htmlFor="password">Password</label>
        <br />
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={status === 'submitting'}
        />
        <br />
        <label>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={status === 'submitting'}
          />{' '}
          Remember me
        </label>
        <br />
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
