'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../../lib/config';

interface OrderSummary {
  id: string;
  status: string;
  restaurantName: string;
  branchName: string;
  fulfillmentType: string;
  currency: string;
  total: number;
  itemCount: number;
  createdAt: string;
  isActive: boolean;
}

interface ListResponse {
  orders: OrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
      amount / 100,
    );
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

function OrderList({
  title,
  orders,
}: {
  title: string;
  orders: OrderSummary[];
}) {
  if (orders.length === 0) {
    return (
      <section style={{ marginBottom: '2rem' }}>
        <h2>{title}</h2>
        <p style={{ color: '#666' }}>None</p>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>{title}</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {orders.map((order) => (
          <li
            key={order.id}
            style={{
              borderBottom: '1px solid #eee',
              padding: '0.75rem 0',
            }}
          >
            <Link href={`/orders/${order.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <strong>{order.restaurantName}</strong>
              <span style={{ color: '#666' }}> · {order.branchName}</span>
              <div style={{ fontSize: '0.9rem', marginTop: 4 }}>
                {order.status} · {order.fulfillmentType} · {order.itemCount} item
                {order.itemCount === 1 ? '' : 's'} ·{' '}
                {formatMoney(order.total, order.currency)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#888' }}>
                {new Date(order.createdAt).toLocaleString()}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function OrdersPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  const load = useCallback(async (pageNum: number) => {
    setStatus('loading');
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/orders?page=${pageNum}&pageSize=20`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'Log in first' : 'Could not load orders');
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const { active, past } = useMemo(() => {
    const orders = data?.orders ?? [];
    return {
      active: orders.filter((o) => o.isActive),
      past: orders.filter((o) => !o.isActive),
    };
  }, [data]);

  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <p>
        <Link href="/">← Home</Link>
      </p>
      <h1>Your orders</h1>

      {status === 'loading' && !data ? <p>Loading…</p> : null}
      {status === 'error' ? <p style={{ color: '#b00020' }}>{message}</p> : null}

      {data ? (
        <>
          <OrderList title="In progress" orders={active} />
          <OrderList title="Past" orders={past} />

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>
              Page {data.page} of {Math.max(1, data.totalPages)} ({data.total} total)
            </span>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}
