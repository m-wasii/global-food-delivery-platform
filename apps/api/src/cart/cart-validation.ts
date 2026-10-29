import { isOfferedAtBranch } from './preferred-branch';

export const MAX_CART_LINE_QUANTITY = 99;

export type CartValidationIssueCode =
  | 'EMPTY_CART'
  | 'BRANCH_NOT_ORDERABLE'
  | 'BRANCH_CLOSED'
  | 'ITEM_NOT_OFFERED'
  | 'ITEM_OUT_OF_STOCK'
  | 'ITEM_UNAVAILABLE'
  | 'MENU_INACTIVE'
  | 'QUANTITY_INVALID'
  | 'CURRENCY_MISMATCH'
  | 'BELOW_MINIMUM_ORDER';

export interface CartValidationIssue {
  code: CartValidationIssueCode;
  message: string;
  menuItemId?: string;
  cartItemId?: string;
}

export interface CartLineForValidation {
  cartItemId: string;
  menuItemId: string;
  quantity: number;
  currency: string;
  unitPriceCents: number;
  menuItemIsAvailable: boolean;
  menuIsActive: boolean;
  branchOffer: { isAvailable: boolean } | null;
}

export interface CartValidationInput {
  cartCurrency: string;
  lines: CartLineForValidation[];
  branch: {
    structurallyOrderable: boolean;
    isOpen: boolean;
    closedReason?: string;
    minimumOrderCents: number | null;
  };
}

export function evaluateCartValidation(input: CartValidationInput): {
  valid: boolean;
  subtotalCents: number;
  issues: CartValidationIssue[];
} {
  const issues: CartValidationIssue[] = [];

  if (input.lines.length === 0) {
    issues.push({
      code: 'EMPTY_CART',
      message: 'Cart has no items',
    });
    return { valid: false, subtotalCents: 0, issues };
  }

  if (!input.branch.structurallyOrderable) {
    issues.push({
      code: 'BRANCH_NOT_ORDERABLE',
      message: 'Selected branch is not available for ordering',
    });
  } else if (!input.branch.isOpen) {
    issues.push({
      code: 'BRANCH_CLOSED',
      message: `Selected branch is not open (${input.branch.closedReason ?? 'closed'})`,
    });
  }

  let subtotalCents = 0;

  for (const line of input.lines) {
    subtotalCents += line.unitPriceCents * line.quantity;

    if (line.quantity < 1 || line.quantity > MAX_CART_LINE_QUANTITY) {
      issues.push({
        code: 'QUANTITY_INVALID',
        message: `Quantity must be between 1 and ${MAX_CART_LINE_QUANTITY}`,
        menuItemId: line.menuItemId,
        cartItemId: line.cartItemId,
      });
    }

    if (line.currency !== input.cartCurrency) {
      issues.push({
        code: 'CURRENCY_MISMATCH',
        message: `Line currency ${line.currency} does not match cart currency ${input.cartCurrency}`,
        menuItemId: line.menuItemId,
        cartItemId: line.cartItemId,
      });
    }

    if (!line.menuIsActive) {
      issues.push({
        code: 'MENU_INACTIVE',
        message: 'Item belongs to an inactive menu',
        menuItemId: line.menuItemId,
        cartItemId: line.cartItemId,
      });
    }

    if (!line.menuItemIsAvailable) {
      issues.push({
        code: 'ITEM_UNAVAILABLE',
        message: 'Menu item is marked unavailable',
        menuItemId: line.menuItemId,
        cartItemId: line.cartItemId,
      });
    }

    if (!line.branchOffer) {
      issues.push({
        code: 'ITEM_NOT_OFFERED',
        message: 'Item is not offered at the selected branch',
        menuItemId: line.menuItemId,
        cartItemId: line.cartItemId,
      });
    } else if (!isOfferedAtBranch(line.branchOffer)) {
      issues.push({
        code: 'ITEM_OUT_OF_STOCK',
        message: 'Item is out of stock at the selected branch',
        menuItemId: line.menuItemId,
        cartItemId: line.cartItemId,
      });
    }
  }

  const minimum = input.branch.minimumOrderCents;
  if (minimum != null && minimum > 0 && subtotalCents < minimum) {
    issues.push({
      code: 'BELOW_MINIMUM_ORDER',
      message: `Subtotal ${subtotalCents} is below branch minimum order ${minimum}`,
    });
  }

  return { valid: issues.length === 0, subtotalCents, issues };
}
