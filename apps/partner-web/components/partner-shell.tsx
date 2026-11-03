'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useState } from 'react';
import {
  fetchBranches,
  fetchMe,
  fetchMyRestaurants,
  hasPartnerCapability,
  logout,
  partnerPath,
} from '../lib/api';
import type { BranchSummary, MembershipRestaurant } from '../lib/types';

const NAV_ITEMS = [
  { slug: 'orders', label: 'Orders' },
  { slug: 'menu', label: 'Menu' },
  { slug: 'hours', label: 'Hours/Availability' },
  { slug: 'branches', label: 'Branches' },
  { slug: 'team', label: 'Team' },
] as const;

interface PartnerShellProps {
  children: React.ReactNode;
}

export function PartnerShell({ children }: PartnerShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ restaurantId: string; branchId: string }>();
  const restaurantId = params.restaurantId;
  const branchId = params.branchId;

  const [memberships, setMemberships] = useState<MembershipRestaurant[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function gate() {
      const user = await fetchMe();
      if (!user) {
        router.replace('/login');
        return;
      }
      if (!hasPartnerCapability(user)) {
        setError('Partner capability required.');
        setReady(true);
        return;
      }

      setUserEmail(user.email);
      const mine = await fetchMyRestaurants();
      setMemberships(mine);

      const mineMatch = mine.find((m) => m.restaurant.id === restaurantId);
      if (!mineMatch) {
        setError('You are not a member of this restaurant.');
        setReady(true);
        return;
      }

      const branchList = await fetchBranches(restaurantId);
      setBranches(branchList);
      if (!branchList.some((b) => b.id === branchId)) {
        setError('Branch not found for this restaurant.');
        setReady(true);
        return;
      }

      setReady(true);
    }

    void gate();
  }, [restaurantId, branchId, router]);

  function currentArea(): string {
    const parts = pathname.split('/');
    // /r/:rid/b/:bid/:area
    return parts[5] ?? 'orders';
  }

  function onRestaurantChange(e: ChangeEvent<HTMLSelectElement>) {
    const nextRestaurantId = e.target.value;
    void (async () => {
      const nextBranches = await fetchBranches(nextRestaurantId);
      const nextBranch = nextBranches[0];
      if (!nextBranch) {
        setError('Selected restaurant has no branches.');
        return;
      }
      router.push(partnerPath(nextRestaurantId, nextBranch.id, currentArea()));
    })();
  }

  function onBranchChange(e: ChangeEvent<HTMLSelectElement>) {
    router.push(partnerPath(restaurantId, e.target.value, currentArea()));
  }

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  if (!ready) {
    return (
      <main>
        <p>Loading partner dashboard…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <h1>EatWave Partner</h1>
        <p>{error}</p>
        <p>
          <Link href="/login">Back to login</Link>
        </p>
      </main>
    );
  }

  const area = currentArea();

  return (
    <div>
      <header>
        <p>
          <strong>EatWave Partner</strong>
          {userEmail ? ` — ${userEmail}` : ''}{' '}
          <button type="button" onClick={() => void onLogout()}>
            Log out
          </button>
        </p>

        <label htmlFor="restaurant">Restaurant </label>
        <select id="restaurant" value={restaurantId} onChange={onRestaurantChange}>
          {memberships.map((m) => (
            <option key={m.restaurant.id} value={m.restaurant.id}>
              {m.restaurant.name} ({m.membership.role})
            </option>
          ))}
        </select>

        {' · '}

        <label htmlFor="branch">Branch </label>
        <select id="branch" value={branchId} onChange={onBranchChange}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.status}
              {b.temporarilyClosed ? ', closed' : ''})
            </option>
          ))}
        </select>

        <nav>
          {NAV_ITEMS.map((item, index) => (
            <span key={item.slug}>
              {index > 0 ? ' · ' : null}
              <Link
                href={partnerPath(restaurantId, branchId, item.slug)}
                aria-current={area === item.slug ? 'page' : undefined}
              >
                {area === item.slug ? <strong>{item.label}</strong> : item.label}
              </Link>
            </span>
          ))}
        </nav>
      </header>
      <hr />
      <main>{children}</main>
    </div>
  );
}
