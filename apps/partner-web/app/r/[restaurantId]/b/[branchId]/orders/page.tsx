'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { fetchPartnerOrders, transitionPartnerOrder } from '../../../../../../lib/api';
import { formatWaitAge, waitAnchorIso } from '../../../../../../lib/order-wait';
import type { PartnerOrderSummary, RejectReasonCode } from '../../../../../../lib/types';
import { REJECT_REASONS } from '../../../../../../lib/types';

const POLL_MS = 5_000;

const REJECT_LABELS: Record<RejectReasonCode, string> = {
  OUT_OF_STOCK: 'Out of stock',
  TOO_BUSY: 'Too busy',
  CLOSING_SOON: 'Closing soon',
  OTHER: 'Other',
};

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
  busyOrderId,
  actionError,
  rejectDraft,
  onAccept,
  onBeginReject,
  onCancelReject,
  onRejectReasonChange,
  onRejectNoteChange,
  onConfirmReject,
}: {
  order: PartnerOrderSummary;
  nowMs: number;
  emphasize?: boolean;
  busyOrderId: string | null;
  actionError: string | null;
  rejectDraft: {
    orderId: string;
    reason: RejectReasonCode;
    note: string;
  } | null;
  onAccept: (orderId: string) => void;
  onBeginReject: (orderId: string) => void;
  onCancelReject: () => void;
  onRejectReasonChange: (reason: RejectReasonCode) => void;
  onRejectNoteChange: (note: string) => void;
  onConfirmReject: () => void;
}) {
  const age = formatWaitAge(waitAnchorIso(order), nowMs);
  const isPending = order.status === 'PENDING' || order.isNew;
  const isBusy = busyOrderId === order.id;
  const isRejecting = rejectDraft?.orderId === order.id;

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
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

        {isPending ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              disabled={isBusy || !!rejectDraft}
              onClick={() => onAccept(order.id)}
            >
              {isBusy && !isRejecting ? 'Accepting…' : 'Accept'}
            </button>
            <button
              type="button"
              disabled={isBusy || (!!rejectDraft && !isRejecting)}
              onClick={() => onBeginReject(order.id)}
            >
              Reject
            </button>
          </div>
        ) : null}
      </div>

      {isRejecting && rejectDraft ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: '#f7f7f7',
            border: '1px solid #ddd',
          }}
        >
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 4 }}>
            Reject reason (required)
            <select
              value={rejectDraft.reason}
              disabled={isBusy}
              onChange={(e) =>
                onRejectReasonChange(e.target.value as RejectReasonCode)
              }
              style={{ display: 'block', marginTop: 4, minWidth: 200 }}
            >
              {REJECT_REASONS.map((code) => (
                <option key={code} value={code}>
                  {REJECT_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'block', fontSize: '0.9rem', marginTop: 8 }}>
            Note (optional)
            <input
              type="text"
              value={rejectDraft.note}
              disabled={isBusy}
              maxLength={500}
              onChange={(e) => onRejectNoteChange(e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', maxWidth: 360 }}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 10 }}>
            <button type="button" disabled={isBusy} onClick={onConfirmReject}>
              {isBusy ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button type="button" disabled={isBusy} onClick={onCancelReject}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p style={{ color: '#b00020', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
          {actionError}
        </p>
      ) : null}
    </li>
  );
}

function OrderSection({
  title,
  orders,
  nowMs,
  emphasize,
  emptyLabel,
  busyOrderId,
  actionError,
  actionErrorOrderId,
  rejectDraft,
  onAccept,
  onBeginReject,
  onCancelReject,
  onRejectReasonChange,
  onRejectNoteChange,
  onConfirmReject,
}: {
  title: string;
  orders: PartnerOrderSummary[];
  nowMs: number;
  emphasize?: boolean;
  emptyLabel: string;
  busyOrderId: string | null;
  actionError: string | null;
  actionErrorOrderId: string | null;
  rejectDraft: {
    orderId: string;
    reason: RejectReasonCode;
    note: string;
  } | null;
  onAccept: (orderId: string) => void;
  onBeginReject: (orderId: string) => void;
  onCancelReject: () => void;
  onRejectReasonChange: (reason: RejectReasonCode) => void;
  onRejectNoteChange: (note: string) => void;
  onConfirmReject: () => void;
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
              busyOrderId={busyOrderId}
              actionError={
                actionErrorOrderId === order.id ? actionError : null
              }
              rejectDraft={rejectDraft}
              onAccept={onAccept}
              onBeginReject={onBeginReject}
              onCancelReject={onCancelReject}
              onRejectReasonChange={onRejectReasonChange}
              onRejectNoteChange={onRejectNoteChange}
              onConfirmReject={onConfirmReject}
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
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorOrderId, setActionErrorOrderId] = useState<string | null>(
    null,
  );
  const [rejectDraft, setRejectDraft] = useState<{
    orderId: string;
    reason: RejectReasonCode;
    note: string;
  } | null>(null);

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

  function refreshQueue() {
    setRefreshToken((n) => n + 1);
  }

  async function handleAccept(orderId: string) {
    setBusyOrderId(orderId);
    setActionError(null);
    setActionErrorOrderId(null);
    setRejectDraft(null);
    const result = await transitionPartnerOrder({
      orderId,
      toStatus: 'CONFIRMED',
    });
    setBusyOrderId(null);
    if (!result.ok) {
      setActionError(result.message);
      setActionErrorOrderId(orderId);
      return;
    }
    refreshQueue();
  }

  function handleBeginReject(orderId: string) {
    setActionError(null);
    setActionErrorOrderId(null);
    setRejectDraft({
      orderId,
      reason: 'OUT_OF_STOCK',
      note: '',
    });
  }

  async function handleConfirmReject() {
    if (!rejectDraft) return;
    const { orderId, reason, note } = rejectDraft;
    setBusyOrderId(orderId);
    setActionError(null);
    setActionErrorOrderId(null);
    const result = await transitionPartnerOrder({
      orderId,
      toStatus: 'REJECTED',
      rejectReason: reason,
      reason: note,
    });
    setBusyOrderId(null);
    if (!result.ok) {
      setActionError(result.message);
      setActionErrorOrderId(orderId);
      return;
    }
    setRejectDraft(null);
    refreshQueue();
  }

  const sectionProps = {
    nowMs,
    busyOrderId,
    actionError,
    actionErrorOrderId,
    rejectDraft,
    onAccept: handleAccept,
    onBeginReject: handleBeginReject,
    onCancelReject: () => setRejectDraft(null),
    onRejectReasonChange: (reason: RejectReasonCode) =>
      setRejectDraft((d) => (d ? { ...d, reason } : d)),
    onRejectNoteChange: (note: string) =>
      setRejectDraft((d) => (d ? { ...d, note } : d)),
    onConfirmReject: () => {
      void handleConfirmReject();
    },
  };

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
            emphasize
            emptyLabel="No new orders"
            {...sectionProps}
          />
          <OrderSection
            title="In progress"
            orders={inProgress}
            emptyLabel="Nothing in progress"
            {...sectionProps}
          />
        </>
      ) : null}
    </section>
  );
}
