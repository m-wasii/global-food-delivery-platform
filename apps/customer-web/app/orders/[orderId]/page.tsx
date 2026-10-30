'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../../lib/config';

interface OrderDetail {
  id: string;
  status: string;
  restaurantName?: string;
  branchName?: string;
  fulfillmentType: string;
  currency: string;
  total: number;
  createdAt: string;
  deliveryAddress: {
    label: string | null;
    line1: string;
    line2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  pricing?: {
    itemsSubtotal: number;
    discount: number;
    serviceFee: number;
    deliveryFee: number;
    tax: number;
    total: number;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
  allowedTransitions: string[];
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

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/orders/${orderId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? 'Log in first'
              : res.status === 404
                ? 'Order not found'
                : 'Could not load order',
          );
        }
        setOrder((await res.json()) as OrderDetail);
        setStatus('ready');
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to load');
      }
    })();
  }, [orderId]);

  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <p>
        <Link href="/orders">← Orders</Link>
      </p>

      {status === 'loading' ? <p>Loading…</p> : null}
      {status === 'error' ? <p style={{ color: '#b00020' }}>{message}</p> : null}

      {order ? (
        <>
          <h1>{order.restaurantName ?? 'Order'}</h1>
          <p style={{ color: '#555' }}>
            {order.branchName} · {order.fulfillmentType} · <strong>{order.status}</strong>
          </p>
          <p style={{ fontSize: '0.9rem', color: '#888' }}>
            {new Date(order.createdAt).toLocaleString()}
          </p>

          <h2>Items</h2>
          <ul>
            {order.items.map((item) => (
              <li key={item.id}>
                {item.quantity}× {item.name} —{' '}
                {formatMoney(item.lineTotal, order.currency)}
              </li>
            ))}
          </ul>

          {order.pricing ? (
            <>
              <h2>Pricing</h2>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li>Items: {formatMoney(order.pricing.itemsSubtotal, order.currency)}</li>
                <li>Service: {formatMoney(order.pricing.serviceFee, order.currency)}</li>
                <li>Delivery: {formatMoney(order.pricing.deliveryFee, order.currency)}</li>
                <li>Tax: {formatMoney(order.pricing.tax, order.currency)}</li>
                <li>
                  <strong>Total: {formatMoney(order.pricing.total, order.currency)}</strong>
                </li>
              </ul>
            </>
          ) : (
            <p>
              <strong>Total: {formatMoney(order.total, order.currency)}</strong>
            </p>
          )}

          {order.deliveryAddress ? (
            <>
              <h2>Delivery</h2>
              <p>
                {order.deliveryAddress.label ? `${order.deliveryAddress.label}: ` : ''}
                {order.deliveryAddress.line1}
                {order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ''}
                <br />
                {[
                  order.deliveryAddress.city,
                  order.deliveryAddress.region,
                  order.deliveryAddress.postalCode,
                  order.deliveryAddress.country,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </>
          ) : null}

          <h2>Status history</h2>
          <ol>
            {order.history.map((event) => (
              <li key={event.id}>
                {event.fromStatus ?? '—'} → {event.toStatus}
                {event.reason ? ` (${event.reason})` : ''} ·{' '}
                {new Date(event.createdAt).toLocaleString()}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </main>
  );
}
