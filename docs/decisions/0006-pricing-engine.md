# ADR 0006: Pricing Engine

## Decision

Compute cart/order money with a **pure, deterministic** `priceCart` function. All monetary fields are integers in the currency’s **minor unit** (not floating-point major units). The public breakdown omits a “cents” suffix — `currency` defines the unit system.

## Breakdown contract

| Field | Meaning |
| --- | --- |
| `itemsSubtotal` | Sum of `unitPrice × quantity` |
| `discount` | Applied discount (clamped to items subtotal) |
| `serviceFee` / `deliveryFee` | Customer-facing fees |
| `tax` | Tax on `(itemsSubtotal - discount) + serviceFee + deliveryFee` |
| `taxRateBps` | Rate used (basis points; 1% = 100) |
| `total` | `itemsSubtotal - discount + serviceFee + deliveryFee + tax` |
| `currency` | ISO currency code for all amounts |

Same inputs always produce the same output (integer floor for tax).

## M04 scope vs later

- Defaults for fees/tax come from env (`PRICING_*_MINOR`, `PRICING_TAX_RATE_BPS`); coupons/fee rules/tax jurisdictions are EAT-50 / EAT-49 / EAT-70.
- `GET /carts/:restaurantId/quote` exposes the breakdown; checkout reuses the same engine.

## Consequences

- Persist order totals from this breakdown at order creation (EAT-36), not from client-submitted prices.
- Schema columns that historically use `*Cents` remain storage names; API pricing payloads use the unit-agnostic field names above.
