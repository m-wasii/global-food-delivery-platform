export interface AuthUser {
  id: string;
  email: string;
  name: string;
  capabilities?: string[];
}

export interface MembershipRestaurant {
  membership: {
    id: string;
    role: 'OWNER' | 'STAFF';
    status: string;
  };
  restaurant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
}

export interface BranchSummary {
  id: string;
  name: string;
  status: string;
  temporarilyClosed: boolean;
}

export interface KitchenTiming {
  pendingAt: string | null;
  acceptedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
}

export interface PartnerOrderSummary {
  id: string;
  status: string;
  restaurantId: string;
  restaurantBranchId: string;
  restaurantName: string;
  branchName: string;
  fulfillmentType: string;
  currency: string;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  isNew: boolean;
  timing: KitchenTiming;
}

export interface PartnerOrderListResponse {
  orders: PartnerOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Active kitchen queue statuses (EAT-40 default view). */
export const PARTNER_QUEUE_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
] as const;
