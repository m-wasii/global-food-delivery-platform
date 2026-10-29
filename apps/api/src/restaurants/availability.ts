const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface WeeklyHoursRule {
  dayOfWeek: number;
  openTimeMinutes: number;
  closeTimeMinutes: number;
  isClosed: boolean;
}

export interface AvailabilityExceptionRule {
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  openTimeMinutes: number | null;
  closeTimeMinutes: number | null;
}

export interface BranchAvailabilityInput {
  temporarilyClosed: boolean;
  timezone: string;
  weeklyHours: WeeklyHoursRule[];
  exceptions: AvailabilityExceptionRule[];
}

export interface ZonedClock {
  dayOfWeek: number;
  minutesFromMidnight: number;
  /** YYYY-MM-DD in branch timezone */
  dateKey: string;
}

export function getZonedClock(now: Date, timeZone: string): ZonedClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const weekday = get('weekday');
  const dayOfWeek = WEEKDAY_TO_INDEX[weekday];
  if (dayOfWeek === undefined) {
    throw new Error(`Unable to resolve weekday for timezone ${timeZone}`);
  }

  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;
  const minute = Number(get('minute'));

  return {
    dayOfWeek,
    minutesFromMidnight: hour * 60 + minute,
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

function dateKeyFromDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isWithinMinutes(
  minutes: number,
  openTimeMinutes: number,
  closeTimeMinutes: number,
): boolean {
  if (closeTimeMinutes <= openTimeMinutes) {
    // Overnight window (e.g. 22:00–02:00)
    return minutes >= openTimeMinutes || minutes < closeTimeMinutes;
  }
  return minutes >= openTimeMinutes && minutes < closeTimeMinutes;
}

export type AvailabilityReason =
  | 'open'
  | 'temporarily_closed'
  | 'exception_closed'
  | 'outside_exception_hours'
  | 'weekly_closed'
  | 'outside_weekly_hours'
  | 'no_hours_configured';

export function evaluateBranchAvailability(
  input: BranchAvailabilityInput,
  now: Date = new Date(),
): { isOpen: boolean; reason: AvailabilityReason } {
  if (input.temporarilyClosed) {
    return { isOpen: false, reason: 'temporarily_closed' };
  }

  const clock = getZonedClock(now, input.timezone || 'UTC');

  const exception = input.exceptions.find((ex) => {
    const start = dateKeyFromDateOnly(ex.startDate);
    const end = dateKeyFromDateOnly(ex.endDate);
    return clock.dateKey >= start && clock.dateKey <= end;
  });

  if (exception) {
    if (exception.isClosed) {
      return { isOpen: false, reason: 'exception_closed' };
    }
    if (
      exception.openTimeMinutes == null ||
      exception.closeTimeMinutes == null
    ) {
      return { isOpen: false, reason: 'exception_closed' };
    }
    const open = isWithinMinutes(
      clock.minutesFromMidnight,
      exception.openTimeMinutes,
      exception.closeTimeMinutes,
    );
    return {
      isOpen: open,
      reason: open ? 'open' : 'outside_exception_hours',
    };
  }

  // Overnight windows (close <= open) continue into the next calendar day's early minutes.
  const previousDayOfWeek = (clock.dayOfWeek + 6) % 7;
  const previousWeekly = input.weeklyHours.find(
    (h) => h.dayOfWeek === previousDayOfWeek,
  );
  if (
    previousWeekly &&
    !previousWeekly.isClosed &&
    previousWeekly.closeTimeMinutes <= previousWeekly.openTimeMinutes &&
    clock.minutesFromMidnight < previousWeekly.closeTimeMinutes
  ) {
    return { isOpen: true, reason: 'open' };
  }

  const weekly = input.weeklyHours.find((h) => h.dayOfWeek === clock.dayOfWeek);
  if (!weekly) {
    return { isOpen: false, reason: 'no_hours_configured' };
  }
  if (weekly.isClosed) {
    return { isOpen: false, reason: 'weekly_closed' };
  }

  const open = isWithinMinutes(
    clock.minutesFromMidnight,
    weekly.openTimeMinutes,
    weekly.closeTimeMinutes,
  );
  return {
    isOpen: open,
    reason: open ? 'open' : 'outside_weekly_hours',
  };
}

/** Structural readiness + not temp-closed. Hours evaluated separately via evaluateBranchAvailability. */
export function isBranchStructurallyOrderable(params: {
  restaurantStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  branchStatus: 'INACTIVE' | 'ACTIVE';
  operatingCityIsActive: boolean;
  temporarilyClosed: boolean;
  latitude: number | null;
  longitude: number | null;
  deliveryRadiusKm: number | null;
}): boolean {
  return (
    params.restaurantStatus === 'ACTIVE' &&
    params.branchStatus === 'ACTIVE' &&
    params.operatingCityIsActive &&
    !params.temporarilyClosed &&
    params.latitude != null &&
    params.longitude != null &&
    params.deliveryRadiusKm != null &&
    params.deliveryRadiusKm > 0
  );
}

export function isMenuItemOrderable(params: {
  isAvailable: boolean;
  menuIsActive: boolean;
}): boolean {
  return params.isAvailable && params.menuIsActive;
}
