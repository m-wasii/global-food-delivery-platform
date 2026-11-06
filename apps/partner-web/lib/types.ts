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
