import { describe, expect, it } from 'vitest';
import { evaluateBranchAvailability, type WeeklyHoursRule } from './availability';

/** Friday 22:00–02:00 overnight (dayOfWeek Fri=5). */
const FRI_OVERNIGHT: WeeklyHoursRule = {
  dayOfWeek: 5,
  openTimeMinutes: 22 * 60,
  closeTimeMinutes: 2 * 60,
  isClosed: false,
};

const SAT_CLOSED: WeeklyHoursRule = {
  dayOfWeek: 6,
  openTimeMinutes: 0,
  closeTimeMinutes: 0,
  isClosed: true,
};

/**
 * Fixed Instant that formats as the given local wall-clock in America/New_York.
 * Uses a known winter offset (EST, UTC-5) so tests stay deterministic.
 */
function atEastern(isoLocal: string): Date {
  // isoLocal: YYYY-MM-DDTHH:mm in Eastern Standard Time (no DST for these fixtures)
  return new Date(`${isoLocal}:00-05:00`);
}

describe('evaluateBranchAvailability overnight weekly hours', () => {
  const input = {
    temporarilyClosed: false,
    timezone: 'America/New_York',
    weeklyHours: [FRI_OVERNIGHT, SAT_CLOSED],
    exceptions: [],
  };

  it('is open Saturday 01:00 inside Friday overnight close', () => {
    // 2024-01-06 is Saturday; 01:00 EST
    const result = evaluateBranchAvailability(input, atEastern('2024-01-06T01:00'));
    expect(result).toEqual({ isOpen: true, reason: 'open' });
  });

  it('is closed Saturday 03:00 after Friday overnight close', () => {
    const result = evaluateBranchAvailability(input, atEastern('2024-01-06T03:00'));
    expect(result).toEqual({ isOpen: false, reason: 'weekly_closed' });
  });

  it('is open Friday 23:00 during Friday overnight window', () => {
    // 2024-01-05 is Friday; 23:00 EST
    const result = evaluateBranchAvailability(input, atEastern('2024-01-05T23:00'));
    expect(result).toEqual({ isOpen: true, reason: 'open' });
  });
});
