import type { PartnerTransitionTarget } from './types';

export interface PrepAction {
  toStatus: PartnerTransitionTarget;
  label: string;
  busyLabel: string;
}

/** Next kitchen step for in-progress statuses (EAT-42). */
const PREP_ACTIONS: Partial<Record<string, PrepAction>> = {
  CONFIRMED: {
    toStatus: 'PREPARING',
    label: 'Start preparing',
    busyLabel: 'Starting…',
  },
  PREPARING: {
    toStatus: 'READY',
    label: 'Mark ready',
    busyLabel: 'Updating…',
  },
  READY: {
    toStatus: 'COMPLETED',
    label: 'Complete',
    busyLabel: 'Completing…',
  },
};

export function prepActionForStatus(status: string): PrepAction | null {
  return PREP_ACTIONS[status] ?? null;
}
