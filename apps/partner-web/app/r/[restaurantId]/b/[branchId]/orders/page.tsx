'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { fetchPartnerOrders } from '../../../../../../lib/api';
import { formatWaitAge, waitAnchorIso } from '../../../../../../lib/order-wait';
import type { PartnerOrderSummary } from '../../../../../../lib/types';

const POLL_MS = 5_000;

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

function OrderRow({
  order,
  nowMs,
  emphasize,
}: {
  order: PartnerOrderSummary;
  nowMs: number;
  emphasize?: boolean;
}) {
  const age = formatWaitAge(waitAnchorIso(order), nowMs);

  return (
    <li
      style={{
        borderBottom: '1px solid #eee',
        padding: '0.85rem 0',
        background: emphasize ? '#fff8e6' : undefined,
        paddingLeft: emphasize ? '0.5rem' : undefined,
        marginLeft: emphasize ? '-0.5rem' : undefined,
        borderLeft: emphasize ? '3px solid #c47a00' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <strong>#{order.id.slice(0, 8)}</strong>
          <span style={{ color: '#666' }}> · {order.branchName}</span>
          <div style={{ fontSize: '0.9rem', marginTop: 4 }}>
            {order.status}
            {emphasize ? ' · New' : ''} · {order.fulfillmentType} ·{' '}
            {order.itemCount} item{order.itemCount === 1 ? '' : 's'} ·{' '}
            {formatMoney(order.total, order.currency)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 2 }}>
            {age}
            {age ? ' · ' : ''}
            {new Date(order.createdAt).toLocaleString()}
          </div>
        </div>
      </div>
    </li>
  );
}

function OrderSection({
  title,
  orders,
  nowMs,
  emphasize,
  emptyLabel,
}: {
  title: string;
  orders: PartnerOrderSummary[];
  nowMs: number;
  emphasize?: boolean;
  emptyLabel: string;
}) {
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
        {title}{' '}
        <span style={{ color: '#666', fontWeight: 400 }}>({orders.length})</span>
      </h2>
      {orders.length === 0 ? (
        <p style={{ color: '#666' }}>{emptyLabel}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              nowMs={nowMs}
              emphasize={emphasize}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function OrdersPage() {
  const params = useParams<{ restaurantId: string; branchId: string }>();
  const restaurantId = params.restaurantId;
  const branchId = params.branchId;

  const [orders, setOrders] = useState<PartnerOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOnInterval() {
      const result = await fetchPartnerOrders({ restaurantId, branchId });
      if (cancelled) return;
      if (!result.ok) {
        setStatus('error');
        setMessage(result.message);
        return;
      }
      setOrders(result.data.orders);
      setTotal(result.data.total);
      setLastFetchedAt(Date.now());
      setNowMs(Date.now());
      setStatus('ready');
      setMessage('');
    }

    void loadOnInterval();
    const pollId = window.setInterval(() => {
      void loadOnInterval();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [restaurantId, branchId, refreshToken]);

  // Keep wait ages fresh between polls without refetching.
  useEffect(() => {
    const tickId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => window.clearInterval(tickId);
  }, []);

  const { incoming, inProgress } = useMemo(() => {
    const incomingOrders = orders.filter((o) => o.isNew || o.status === 'PENDING');
    const inProgressOrders = orders.filter(
      (o) => !o.isNew && o.status !== 'PENDING',
    );
    return { incoming: incomingOrders, inProgress: inProgressOrders };
  }, [orders]);

  return (
    <section>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Orders</h1>
          <p style={{ margin: '0.35rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            Active kitchen queue · auto-refresh every 5s
            {lastFetchedAt
              ? ` · updated ${new Date(lastFetchedAt).toLocaleTimeString()}`
              : null}
            {total > orders.length ? ` · showing ${orders.length} of ${total}` : null}
          </p>
        </div>
        <button type="button" onClick={() => setRefreshToken((n) => n + 1)}>
          Refresh
        </button>
      </div>

      {status === 'loading' && orders.length === 0 ? <p>Loading queue…</p> : null}
      {status === 'error' ? (
        <p style={{ color: '#b00020' }}>{message}</p>
      ) : null}

      {status === 'ready' || orders.length > 0 ? (
        <>
          <OrderSection
            title="New"
            orders={incoming}
            nowMs={nowMs}
            emphasize
            emptyLabel="No new orders"
          />
          <OrderSection
            title="In progress"
            orders={inProgress}
            nowMs={nowMs}
            emptyLabel="Nothing in progress"
          />
        </>
      ) : null}
    </section>
  );
}
