'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../../lib/config';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
}

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

interface RestaurantDetail {
  restaurant: { id: string; name: string; slug: string; status: string };
  isAcceptingOrders: boolean;
  hours: Array<{
    branchId: string;
    branchName: string;
    timezone: string;
    isOpen: boolean;
    reason: string;
    weeklyHours: Array<{
      dayOfWeek: number;
      openTimeMinutes: number;
      closeTimeMinutes: number;
      isClosed: boolean;
    }>;
  }>;
  branches: Array<{
    id: string;
    name: string;
    deliveryRadiusKm: number;
    isOpen: boolean;
    availabilityReason: string;
    operatingCity: { name: string; country: string };
    address: { line1: string; city: string; country: string };
  }>;
  menu: {
    id: string;
    name: string;
    categories: MenuCategory[];
  } | null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default function RestaurantDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!slug) return;

    async function load() {
      setStatus('loading');
      try {
        const res = await fetch(`${getApiBaseUrl()}/discovery/restaurants/${slug}`);
        if (!res.ok) {
          setStatus('error');
          setMessage(res.status === 404 ? 'Restaurant not found' : 'Could not load restaurant');
          setDetail(null);
          return;
        }
        const data = (await res.json()) as RestaurantDetail;
        setDetail(data);
        setStatus('ready');
      } catch {
        setStatus('error');
        setMessage('Could not load restaurant');
        setDetail(null);
      }
    }

    void load();
  }, [slug]);

  if (status === 'loading') {
    return (
      <main>
        <p>
          <Link href="/">← Discover</Link>
        </p>
        <p>Loading…</p>
      </main>
    );
  }

  if (status === 'error' || !detail) {
    return (
      <main>
        <p>
          <Link href="/">← Discover</Link>
        </p>
        <h1>Restaurant</h1>
        <p>{message || 'Not found'}</p>
      </main>
    );
  }

  const selectedItem =
    detail.menu?.categories
      .flatMap((c) => c.items)
      .find((item) => item.id === selectedItemId) ?? null;

  return (
    <main>
      <p>
        <Link href="/">← Discover</Link>
      </p>
      <h1>{detail.restaurant.name}</h1>
      <p>
        Ordering:{' '}
        {detail.isAcceptingOrders ? 'Accepting orders' : 'Not accepting orders right now'}
      </p>

      {detail.hours.length > 0 ? (
        <section>
          <h2>Hours</h2>
          {detail.hours.map((entry) => (
            <div key={entry.branchId}>
              <p>
                {entry.branchName}: {entry.isOpen ? 'Open' : 'Closed'} ({entry.reason}) —{' '}
                {entry.timezone}
              </p>
              <ul>
                {entry.weeklyHours.map((h) => (
                  <li key={h.dayOfWeek}>
                    {DAY_NAMES[h.dayOfWeek]}:{' '}
                    {h.isClosed
                      ? 'Closed'
                      : `${formatMinutes(h.openTimeMinutes)}–${formatMinutes(h.closeTimeMinutes)}`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {detail.branches.length > 0 ? (
        <section>
          <h2>Branches</h2>
          <ul>
            {detail.branches.map((branch) => (
              <li key={branch.id}>
                {branch.name} — {branch.address.line1}, {branch.address.city} (
                {branch.operatingCity.name}, up to {branch.deliveryRadiusKm} km) —{' '}
                {branch.isOpen ? 'Open' : `Closed (${branch.availabilityReason})`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2>{detail.menu ? detail.menu.name : 'Menu'}</h2>
        {!detail.menu ? <p>No active menu yet.</p> : null}
        {detail.menu?.categories.map((category) => (
          <div key={category.id}>
            <h3>{category.name}</h3>
            {category.items.length === 0 ? <p>No items in this category.</p> : null}
            <ul>
              {category.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    disabled={!detail.isAcceptingOrders}
                  >
                    {item.name} — {formatPrice(item.priceCents, item.currency)}
                  </button>
                  {item.description ? <div>{item.description}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {selectedItem ? (
        <section>
          <h2>Selected</h2>
          <p>
            {selectedItem.name} — {formatPrice(selectedItem.priceCents, selectedItem.currency)}
          </p>
          {selectedItem.description ? <p>{selectedItem.description}</p> : null}
          <p>Cart and checkout arrive in Milestone 04.</p>
          <button type="button" onClick={() => setSelectedItemId(null)}>
            Clear selection
          </button>
        </section>
      ) : null}
    </main>
  );
}
