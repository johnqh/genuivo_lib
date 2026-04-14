import type { History } from '@sudobility/genuivo_types';

/**
 * Calculates the sum of all `value` fields in a list of history entries.
 *
 * @param histories - An array of {@link History} objects to sum
 * @returns The total sum of all `value` fields, or `0` if the array is empty
 *
 * @example
 * ```typescript
 * const histories = [
 *   { id: '1', user_id: 'u1', datetime: '...', value: 50, created_at: null, updated_at: null },
 *   { id: '2', user_id: 'u1', datetime: '...', value: 30, created_at: null, updated_at: null },
 * ];
 * const sum = calculateSum(histories); // 80
 * ```
 */
export const calculateSum = (histories: History[]): number => {
  return histories.reduce((sum, h) => sum + h.value, 0);
};

/**
 * Calculates the percentage that a user's history sum represents
 * of the global total.
 *
 * Formula: `(userSum / globalTotal) * 100`
 *
 * Returns `0` when `globalTotal` is zero or negative to avoid
 * division-by-zero errors.
 *
 * @param histories - An array of {@link History} objects for the current user
 * @param globalTotal - The global sum of all users' history values
 * @returns The user's percentage of the global total, between `0` and `100+`
 *
 * @example
 * ```typescript
 * const histories = [{ ..., value: 25 }, { ..., value: 75 }];
 * const pct = calculatePercentage(histories, 1000); // 10
 * ```
 *
 * @example
 * ```typescript
 * // Division-by-zero guard
 * const pct = calculatePercentage(histories, 0); // 0
 * ```
 */
export const calculatePercentage = (
  histories: History[],
  globalTotal: number
): number => {
  if (globalTotal <= 0) return 0;
  const userSum = calculateSum(histories);
  return (userSum / globalTotal) * 100;
};
