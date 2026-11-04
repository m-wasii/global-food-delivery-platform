'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchBranches,
  fetchMe,
  fetchMyRestaurants,
  hasPartnerCapability,
  partnerPath,
} from '../lib/api';

export default function HomePage() {
  const router = useRouter();
  const [message, setMessage] = useState('Checking session…');

  useEffect(() => {
    async function bootstrap() {
      const user = await fetchMe();
      if (!user) {
        router.replace('/login');
        return;
      }
      if (!hasPartnerCapability(user)) {
        setMessage('This account has no restaurant membership. Use a partner account.');
        return;
      }

      const memberships = await fetchMyRestaurants();
      const first = memberships[0];
      if (!first) {
        setMessage('No restaurants yet. Onboard a restaurant via the API, then refresh.');
        return;
      }

      const branches = await fetchBranches(first.restaurant.id);
      const branch = branches[0];
      if (!branch) {
        setMessage(
          `Restaurant “${first.restaurant.name}” has no branches yet. Add a branch via the API.`,
        );
        return;
      }

      router.replace(partnerPath(first.restaurant.id, branch.id, 'orders'));
    }

    void bootstrap();
  }, [router]);

  return (
    <main>
      <h1>EatWave Partner</h1>
      <p>{message}</p>
      <p>
        <a href="/login">Login</a>
      </p>
    </main>
  );
}
