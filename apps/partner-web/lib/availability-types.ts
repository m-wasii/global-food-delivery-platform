export interface BranchAvailabilityNow {
  isOpen: boolean;
  reason: string;
}

export interface WeeklyHoursEntry {
  dayOfWeek: number;
  openTimeMinutes: number;
  closeTimeMinutes: number;
  isClosed: boolean;
}

export interface AvailabilityExceptionEntry {
  id: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  openTimeMinutes: number | null;
  closeTimeMinutes: number | null;
}

export interface BranchAvailabilitySnapshot {
  branchId: string;
  temporarilyClosed: boolean;
  timezone: string;
  weeklyHours: WeeklyHoursEntry[];
  exceptions: AvailabilityExceptionEntry[];
  now: BranchAvailabilityNow;
}

export interface BranchMenuOffering {
  menuItemId: string;
  isAvailable: boolean;
  menuItem: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
    isAvailable: boolean;
  };
  updatedAt: string;
}

export interface BranchMenuOfferingsResponse {
  branchId: string;
  offerings: BranchMenuOffering[];
}

export interface MenuListEntry {
  id: string;
  name: string;
  isActive: boolean;
}

export interface MenuItemRow {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  isAvailable: boolean;
  sortOrder: number;
}

export interface MenuCategoryRow {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItemRow[];
}

export interface MenuTree {
  id: string;
  name: string;
  isActive: boolean;
  categories: MenuCategoryRow[];
}

export interface StockRow {
  menuItemId: string;
  name: string;
  categoryName: string;
  priceCents: number;
  currency: string;
  catalogAvailable: boolean;
  /** true when branch has an opt-in row with isAvailable */
  inStock: boolean;
  /** true when a BranchMenuItemAvailability row exists */
  isOffered: boolean;
}
