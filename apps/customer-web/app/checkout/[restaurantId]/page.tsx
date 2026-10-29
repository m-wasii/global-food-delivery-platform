'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../../lib/config';

interface Address {
  id: string;
  label: string | null;
  line1: string;
  city: string;
}

interface PriceBreakdown {
  currency: string;
  itemsSubtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  tax: number;
  total: number;
  lines: Array<{ menuItemId: string; quantity: number; unitPrice: number; lineTotal: number }>;
}

interface PreviewResponse {
  restaurantId: string;
  selectedBranchId: string;
  fulfillment: 'DELIVERY' | 'PICKUP';
  deliveryAddressId: string | null;
  radiusRechecked: boolean;
  pricing: PriceBreakdown;
  canConfirm: boolean;
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

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main style={{ padding: '2rem' }}>Loading checkout…</main>}>
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const params = useParams<{ restaurantId: string }>();
  const searchParams = useSearchParams();
  const restaurantId = params.restaurantId;
  const discoveryAddressId = searchParams.get('discoveryAddressId');

  const [fulfillment, setFulfillment] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(null);
  const [deliveryAddressId, setDeliveryAddressId] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  const loadAddresses = useCallback(async () => {
    const res = await fetch(`${getApiBaseUrl()}/addresses`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(res.status === 401 ? 'Log in first' : 'Could not load addresses');
    }
    const data = (await res.json()) as {
      addresses: Address[];
      defaultAddressId: string | null;
    };
    setAddresses(data.addresses);
    setDefaultAddressId(data.defaultAddressId);
    const initial =
      discoveryAddressId &&
      data.addresses.some((a) => a.id === discoveryAddressId)
        ? discoveryAddressId
        : (data.defaultAddressId ?? data.addresses[0]?.id ?? '');
    setDeliveryAddressId(initial);
  }, [discoveryAddressId]);

  useEffect(() => {
    void (async () => {
      try {
        await loadAddresses();
        setStatus('ready');
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to load');
      }
    })();
  }, [loadAddresses]);

  function checkoutBody() {
    return {
      fulfillment,
      ...(fulfillment === 'DELIVERY' && deliveryAddressId
        ? { deliveryAddressId }
        : {}),
      ...(discoveryAddressId ? { discoveryAddressId } : {}),
    };
  }

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    setStatus('previewing');
    setMessage('');
    setOrderId(null);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/carts/${restaurantId}/checkout/preview`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkoutBody()),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.message === 'string'
            ? data.message
            : data.message?.message ?? 'Preview failed',
        );
      }
      setPreview(data as PreviewResponse);
      setStatus('previewed');
    } catch (error) {
      setPreview(null);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Preview failed');
    }
  }

  async function onConfirm() {
    setStatus('confirming');
    setMessage('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/carts/${restaurantId}/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutBody()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.message === 'string'
            ? data.message
            : data.message?.message ?? 'Checkout failed',
        );
      }
      setOrderId(data.order?.id ?? null);
      setPreview(null);
      setStatus('done');
      setMessage('Order placed (PENDING). Cart cleared.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Checkout failed');
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <p>
        <Link href="/">← Home</Link>
      </p>
      <h1>Checkout</h1>
      <p style={{ color: '#555' }}>Restaurant {restaurantId}</p>

      {status === 'done' && orderId ? (
        <p>
          Order <code>{orderId}</code> created. {message}
        </p>
      ) : (
        <form onSubmit={onPreview}>
          <fieldset style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
            <legend>Fulfillment</legend>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <input
                type="radio"
                name="fulfillment"
                checked={fulfillment === 'DELIVERY'}
                onChange={() => setFulfillment('DELIVERY')}
              />{' '}
              Delivery
            </label>
            <label style={{ display: 'block' }}>
              <input
                type="radio"
                name="fulfillment"
                checked={fulfillment === 'PICKUP'}
                onChange={() => setFulfillment('PICKUP')}
              />{' '}
              Pickup
            </label>
          </fieldset>

          {fulfillment === 'DELIVERY' ? (
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              Delivery address
              <select
                value={deliveryAddressId}
                onChange={(e) => setDeliveryAddressId(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
                required
              >
                {addresses.length === 0 ? (
                  <option value="">No addresses — add one first</option>
                ) : null}
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label ? `${a.label}: ` : ''}
                    {a.line1}, {a.city}
                    {a.id === defaultAddressId ? ' (default)' : ''}
                    {a.id === discoveryAddressId ? ' (browse pin)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button type="submit" disabled={status === 'previewing' || status === 'confirming'}>
            {status === 'previewing' ? 'Pricing…' : 'Show final pricing'}
          </button>
        </form>
      )}

      {preview ? (
        <section style={{ marginTop: '1.5rem', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
          <h2>Pricing summary</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li>Items: {formatMoney(preview.pricing.itemsSubtotal, preview.pricing.currency)}</li>
            <li>Service: {formatMoney(preview.pricing.serviceFee, preview.pricing.currency)}</li>
            <li>Delivery: {formatMoney(preview.pricing.deliveryFee, preview.pricing.currency)}</li>
            <li>Tax: {formatMoney(preview.pricing.tax, preview.pricing.currency)}</li>
            <li>
              <strong>Total: {formatMoney(preview.pricing.total, preview.pricing.currency)}</strong>
            </li>
          </ul>
          <p style={{ fontSize: '0.85rem', color: '#666' }}>
            Radius rechecked: {preview.radiusRechecked ? 'yes' : 'no (same as browse / pickup)'}
          </p>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={status === 'confirming'}
          >
            {status === 'confirming' ? 'Placing…' : 'Place order'}
          </button>
        </section>
      ) : null}

      {message && status !== 'done' ? (
        <p style={{ color: status === 'error' ? '#b00020' : '#333' }}>{message}</p>
      ) : null}

      <p style={{ marginTop: '2rem' }}>
        <Link href="/addresses">Manage addresses</Link>
      </p>
    </main>
  );
}
