'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  fetchBranchAvailability,
  fetchBranchStockRows,
  formatMinutes,
  formatMoney,
  setBranchTemporarilyClosed,
  setMenuItemInStock,
  WEEKDAY_LABELS,
} from '../../../../../../lib/availability-api';
import type {
  BranchAvailabilitySnapshot,
  StockRow,
} from '../../../../../../lib/availability-types';

export default function HoursPage() {
  const params = useParams<{ restaurantId: string; branchId: string }>();
  const restaurantId = params.restaurantId;
  const branchId = params.branchId;
  const routeKey = `${restaurantId}/${branchId}`;

  const [availability, setAvailability] = useState<BranchAvailabilitySnapshot | null>(null);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [pausePending, setPausePending] = useState(false);
  const [itemPendingId, setItemPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const loading = loadedKey !== routeKey;

  useEffect(() => {
    let cancelled = false;
    const key = `${restaurantId}/${branchId}`;

    void (async () => {
      const [avail, stock] = await Promise.all([
        fetchBranchAvailability(restaurantId, branchId),
        fetchBranchStockRows(restaurantId, branchId),
      ]);
      if (cancelled) return;

      if (!avail) {
        setError('Could not load branch availability.');
        setAvailability(null);
        setStockRows([]);
      } else {
        setError('');
        setAvailability(avail);
        setStockRows(stock);
      }
      setLoadedKey(key);
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, branchId]);

  async function reload() {
    const [avail, stock] = await Promise.all([
      fetchBranchAvailability(restaurantId, branchId),
      fetchBranchStockRows(restaurantId, branchId),
    ]);
    if (!avail) {
      setError('Could not load branch availability.');
      setAvailability(null);
      setStockRows([]);
    } else {
      setError('');
      setAvailability(avail);
      setStockRows(stock);
    }
    setLoadedKey(routeKey);
  }

  async function onPauseToggle(nextClosed: boolean) {
    setPausePending(true);
    setMessage('');
    setError('');
    const result = await setBranchTemporarilyClosed(restaurantId, branchId, nextClosed);
    setPausePending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(
      nextClosed
        ? 'Branch paused — customers will see it closed on the next fetch (no API cache TTL).'
        : 'Branch resumed — open status follows weekly hours on the next customer fetch.',
    );
    await reload();
  }

  async function onStockToggle(row: StockRow, nextInStock: boolean) {
    setItemPendingId(row.menuItemId);
    setMessage('');
    setError('');
    const result = await setMenuItemInStock(
      restaurantId,
      branchId,
      row.menuItemId,
      nextInStock,
    );
    setItemPendingId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(
      nextInStock
        ? `“${row.name}” marked in stock at this branch. Cart/checkout picks this up on the next request.`
        : `“${row.name}” marked out of stock at this branch. Cart/checkout rejects it on the next request.`,
    );
    setStockRows((prev) =>
      prev.map((r) =>
        r.menuItemId === row.menuItemId
          ? { ...r, isOffered: true, inStock: nextInStock }
          : r,
      ),
    );
  }

  if (loading && !availability) {
    return (
      <section>
        <h1>Hours / Availability</h1>
        <p>Loading…</p>
      </section>
    );
  }

  const temporarilyClosed = availability?.temporarilyClosed ?? false;

  return (
    <section>
      <h1>Hours / Availability</h1>
      <p>
        Pause the branch and toggle per-item stock for this location. Weekly hours below are
        read-only. Customer discovery and cart read live from the API (no response cache TTL).
      </p>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <h2>Branch pause</h2>
      <p>
        Status:{' '}
        <strong>{temporarilyClosed ? 'Paused (not accepting orders)' : 'Accepting orders'}</strong>
        {availability?.now
          ? ` · Now: ${availability.now.isOpen ? 'open' : `closed (${availability.now.reason})`}`
          : null}
      </p>
      <label>
        <input
          type="checkbox"
          checked={temporarilyClosed}
          disabled={pausePending || !availability}
          onChange={(e) => void onPauseToggle(e.target.checked)}
        />{' '}
        Stop accepting orders (temporarily closed)
      </label>
      <p>
        <small>
          PATCH temporarilyClosed is owner-only. STAFF see the same control; the API returns an
          error if the session is not OWNER.
        </small>
      </p>

      <h2>Weekly hours</h2>
      {availability ? (
        <>
          <p>
            Timezone: <code>{availability.timezone}</code>
          </p>
          {availability.weeklyHours.length === 0 ? (
            <p>No weekly hours configured yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {availability.weeklyHours.map((entry) => (
                  <tr key={entry.dayOfWeek}>
                    <td>{WEEKDAY_LABELS[entry.dayOfWeek] ?? entry.dayOfWeek}</td>
                    <td>
                      {entry.isClosed
                        ? 'Closed'
                        : `${formatMinutes(entry.openTimeMinutes)}–${formatMinutes(entry.closeTimeMinutes)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {availability.exceptions.length > 0 ? (
            <>
              <h3>Exceptions</h3>
              <ul>
                {availability.exceptions.map((ex) => (
                  <li key={ex.id}>
                    {ex.startDate.slice(0, 10)} → {ex.endDate.slice(0, 10)}:{' '}
                    {ex.isClosed
                      ? 'Closed'
                      : `${formatMinutes(ex.openTimeMinutes ?? 0)}–${formatMinutes(ex.closeTimeMinutes ?? 0)}`}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : (
        <p>Availability unavailable.</p>
      )}

      <h2>Item stock at this branch</h2>
      {stockRows.length === 0 ? (
        <p>No menu items found. Create an active menu first.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>In stock</th>
              <th>Item</th>
              <th>Category</th>
              <th>Price</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {stockRows.map((row) => (
              <tr key={row.menuItemId}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`In stock: ${row.name}`}
                    checked={row.inStock}
                    disabled={itemPendingId === row.menuItemId}
                    onChange={(e) => void onStockToggle(row, e.target.checked)}
                  />
                </td>
                <td>{row.name}</td>
                <td>{row.categoryName}</td>
                <td>{formatMoney(row.priceCents, row.currency)}</td>
                <td>
                  {!row.catalogAvailable
                    ? 'Catalog-unavailable'
                    : row.inStock
                      ? 'Offered'
                      : row.isOffered
                        ? 'Out of stock'
                        : 'Not offered yet'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
