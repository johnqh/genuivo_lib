import { describe, expect, it } from 'vitest';
import type { History } from '@sudobility/genuivo_types';
import { calculatePercentage, calculateSum } from './calculations';

const makeHistory = (overrides: Partial<History> = {}): History => ({
  id: 'hist-1',
  user_id: 'user-1',
  datetime: '2024-01-01T00:00:00Z',
  value: 100,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('calculateSum', () => {
  it('should return 0 for empty array', () => {
    expect(calculateSum([])).toBe(0);
  });

  it('should return the value of a single history', () => {
    expect(calculateSum([makeHistory({ value: 42 })])).toBe(42);
  });

  it('should sum multiple histories', () => {
    const histories = [
      makeHistory({ id: '1', value: 10 }),
      makeHistory({ id: '2', value: 20 }),
      makeHistory({ id: '3', value: 30 }),
    ];
    expect(calculateSum(histories)).toBe(60);
  });

  it('should handle decimal values', () => {
    const histories = [
      makeHistory({ id: '1', value: 10.5 }),
      makeHistory({ id: '2', value: 20.3 }),
    ];
    expect(calculateSum(histories)).toBeCloseTo(30.8);
  });
});

describe('calculatePercentage', () => {
  it('should return 0 when globalTotal is 0', () => {
    const histories = [makeHistory({ value: 50 })];
    expect(calculatePercentage(histories, 0)).toBe(0);
  });

  it('should return 0 when globalTotal is negative', () => {
    const histories = [makeHistory({ value: 50 })];
    expect(calculatePercentage(histories, -100)).toBe(0);
  });

  it('should return 0 for empty histories', () => {
    expect(calculatePercentage([], 1000)).toBe(0);
  });

  it('should calculate correct percentage', () => {
    const histories = [
      makeHistory({ id: '1', value: 25 }),
      makeHistory({ id: '2', value: 75 }),
    ];
    expect(calculatePercentage(histories, 1000)).toBe(10);
  });

  it('should return 100 when user sum equals total', () => {
    const histories = [makeHistory({ value: 500 })];
    expect(calculatePercentage(histories, 500)).toBe(100);
  });

  it('should allow percentages over 100', () => {
    const histories = [makeHistory({ value: 200 })];
    expect(calculatePercentage(histories, 100)).toBe(200);
  });

  it('should handle decimal precision', () => {
    const histories = [makeHistory({ value: 1 })];
    expect(calculatePercentage(histories, 3)).toBeCloseTo(33.333, 2);
  });
});
